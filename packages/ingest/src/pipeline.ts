import type { EmbeddingService } from "@frontdesk/ai";
import type {
	ChunkRepository,
	DocumentRepository,
} from "@frontdesk/db/repositories";
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
}

export class IngestPipeline {
	constructor(private deps: IngestPipelineDeps) {}

	async run(input: IngestInput): Promise<IngestOutput> {
		const { chunkRepository, documentRepository, embeddingService } = this.deps;
		const { tenantId, documentId, pdf } = input;

		await chunkRepository.initialize();
		await documentRepository.setStatus(documentId, { status: "processing" });

		try {
			const parsed = await parsePdf(pdf);
			if (!parsed.fullText.trim()) {
				throw new Error("PDF contains no extractable text");
			}

			const chunker = new HierarchicalChunker();
			const { parents, children } = await chunker.split(parsed);

			const embeddings = await embeddingService.embedDocuments(
				children.map((child) => child.content),
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
				metadata: parent.metadata,
			}));

			const childRows = children.map((child, index) => ({
				id: child.id,
				documentId,
				tenantId,
				parentId: child.parentId,
				content: child.content,
				chunkIndex: child.chunkIndex,
				pageNum: child.pageNum,
				embedding: embeddings[index] ?? null,
				embeddingModel: embeddingService.modelName,
				isActive: true,
				metadata: child.metadata,
			}));

			await chunkRepository.insertMany([...parentRows, ...childRows]);

			await documentRepository.setStatus(documentId, {
				status: "completed",
				chunkCount: children.length,
				completedAt: new Date(),
			});

			return {
				documentId,
				tenantId,
				parentCount: parents.length,
				childCount: children.length,
				embeddingModel: embeddingService.modelName,
			};
		} catch (error) {
			await documentRepository.setStatus(documentId, {
				status: "failed",
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	}
}
