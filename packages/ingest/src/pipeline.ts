import type { EmbeddingService } from "@frontdesk/ai";
import type {
	ChunkRepository,
	DocumentRepository,
} from "@frontdesk/db/repositories";
import { createLogger, type Logger } from "@frontdesk/logger";
import { HierarchicalChunker } from "./chunker";
import { parsePdf } from "./parser";

export interface IngestInput {
	tenantId: string;
	documentId: string;
	pdf: Uint8Array;
}

export interface IngestOutput {
	documentId: string;
	tenantId: string;
	parentCount: number;
	childCount: number;
	embeddingModel: string;
}

export interface IngestPipelineDeps {
	chunkRepository: ChunkRepository;
	documentRepository: DocumentRepository;
	embeddingService: EmbeddingService;
	logger?: Logger;
}

export class IngestPipeline {
	private log: Logger;

	constructor(private deps: IngestPipelineDeps) {
		this.log = deps.logger ?? createLogger("ingest");
	}

	async run(input: IngestInput): Promise<IngestOutput> {
		const { chunkRepository, documentRepository, embeddingService } = this.deps;
		const { tenantId, documentId, pdf } = input;
		const log = this.log.child({ tenantId, documentId });

		const started = performance.now();
		await chunkRepository.initialize();
		await documentRepository.setStatus(documentId, { status: "processing" });
		log.info(
			{ event: "status", status: "processing" },
			"marking document as processing",
		);

		try {
			const doc = await documentRepository.getById(documentId);
			const title = doc?.filename ?? documentId;

			const parseStarted = performance.now();
			const parsed = await parsePdf(pdf);
			if (!parsed.fullText.trim()) {
				throw new Error("PDF contains no extractable text");
			}
			log.info(
				{
					event: "pdf_parsed",
					pages: parsed.pages.length,
					characters: parsed.fullText.length,
					durationMs: Math.round(performance.now() - parseStarted),
				},
				"parsed PDF",
			);

			const chunkStarted = performance.now();
			const chunker = new HierarchicalChunker({ embeddingService });
			const { parents, children } = await chunker.split(parsed);
			log.info(
				{
					event: "chunked",
					parents: parents.length,
					children: children.length,
					durationMs: Math.round(performance.now() - chunkStarted),
				},
				"semantic chunking complete",
			);

			const parentRows = parents.map((parent) => ({
				id: parent.id,
				documentId,
				tenantId,
				parentId: null,
				content: parent.content,
				chunkIndex: parent.chunkIndex,
				pageNum: parent.pageNum,
				embedding: null,
				embeddingModel: null,
				isActive: true,
				metadata: { ...parent.metadata, title },
			}));

			const childRows = children.map((child) => ({
				id: child.id,
				documentId,
				tenantId,
				parentId: child.parentId,
				content: child.content,
				chunkIndex: child.chunkIndex,
				pageNum: child.pageNum,
				embedding: child.embedding ?? null,
				embeddingModel: embeddingService.modelName,
				isActive: true,
				metadata: { ...child.metadata, title },
			}));

			const writeStarted = performance.now();
			await chunkRepository.insertMany([...parentRows, ...childRows]);
			log.info(
				{
					event: "chunks_upserted",
					rows: parentRows.length + childRows.length,
					durationMs: Math.round(performance.now() - writeStarted),
				},
				"upserted chunks",
			);

			await documentRepository.setStatus(documentId, {
				status: "completed",
				chunkCount: children.length,
				completedAt: new Date(),
			});

			const output = {
				documentId,
				tenantId,
				parentCount: parents.length,
				childCount: children.length,
				embeddingModel: embeddingService.modelName,
			};

			log.info(
				{
					event: "ingest_completed",
					parentCount: output.parentCount,
					childCount: output.childCount,
					durationMs: Math.round(performance.now() - started),
				},
				"ingest completed",
			);

			return output;
		} catch (error) {
			await documentRepository.setStatus(documentId, {
				status: "failed",
				error: error instanceof Error ? error.message : String(error),
			});
			log.error(
				{
					event: "ingest_failed",
					durationMs: Math.round(performance.now() - started),
					error,
				},
				"ingest failed",
			);
			throw error;
		}
	}
}
