import { ChunkRepository } from "@frontdesk/db";
import type { SearchResultRow, StoredChunk } from "@frontdesk/db";

export interface StoredDocument {
	id: string;
	documentId: string;
	tenantId: string;
	content: string;
	chunkIndex: number;
	embedding: number[];
	embeddingModel: string;
	metadata: Record<string, unknown>;
}

export interface SearchResult {
	document: StoredChunk;
	score: number;
}

export class VectorStore {
	private chunks: ChunkRepository;

	constructor() {
		this.chunks = new ChunkRepository();
	}

	async initialize() {
		await this.chunks.initialize();
	}

	async addDocuments(docs: StoredDocument[]) {
		await this.chunks.insertMany(
			docs.map((doc) => ({
				id: doc.id,
				documentId: doc.documentId,
				tenantId: doc.tenantId,
				content: doc.content,
				chunkIndex: doc.chunkIndex,
				embedding: doc.embedding,
				embeddingModel: doc.embeddingModel,
				isActive: true,
				metadata: doc.metadata,
			})),
		);
	}

	async similaritySearch(
		queryEmbedding: number[],
		topK: number = 3,
		tenantId?: string,
	): Promise<SearchResult[]> {
		const rows: SearchResultRow[] = await this.chunks.search(
			queryEmbedding,
			topK,
			tenantId,
		);
		return rows.map((row) => ({ document: row.chunk, score: row.score }));
	}

	async count(tenantId?: string): Promise<number> {
		return this.chunks.count(tenantId);
	}

	async close() {
		await this.chunks.close();
	}
}
