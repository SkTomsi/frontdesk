import { createDb } from "@frontdesk/db";
import { documentChunks } from "@frontdesk/db/schema";
import { desc, sql } from "drizzle-orm";

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
	document: StoredDocument;
	score: number;
}

interface VectorStoreConfig {
	databaseUrl?: string;
}

export class VectorStore {
	private client: ReturnType<typeof createDb>["client"];
	private db: ReturnType<typeof createDb>["db"];

	constructor(config: VectorStoreConfig = {}) {
		const { client, db } = createDb(config.databaseUrl);
		this.client = client;
		this.db = db;
	}

	async initialize() {
		await this.db.execute(sql.raw("CREATE EXTENSION IF NOT EXISTS vector"));
		await this.db.execute(
			sql.raw(`CREATE TABLE IF NOT EXISTS "document_chunks" (
			"id" text PRIMARY KEY,
			"document_id" text NOT NULL,
			"tenant_id" text NOT NULL,
			"content" text NOT NULL,
			"chunk_index" integer NOT NULL,
			"embedding" vector(1536) NOT NULL,
			"embedding_model" text NOT NULL,
			"metadata" jsonb DEFAULT '{}' NOT NULL
		)`),
		);
		await this.db.execute(
			sql.raw(
				`CREATE INDEX IF NOT EXISTS "chunks_embedding_hnsw_idx" ON "document_chunks" USING hnsw ("embedding" vector_cosine_ops)`,
			),
		);
		await this.db.execute(
			sql.raw(
				`CREATE INDEX IF NOT EXISTS "chunks_tenant_idx" ON "document_chunks" ("tenant_id")`,
			),
		);
		await this.db.execute(
			sql.raw(
				`CREATE INDEX IF NOT EXISTS "chunks_document_idx" ON "document_chunks" ("document_id")`,
			),
		);
	}

	async addDocuments(docs: StoredDocument[]) {
		for (const doc of docs) {
			await this.db
				.insert(documentChunks)
				.values({
					id: doc.id,
					documentId: doc.documentId,
					tenantId: doc.tenantId,
					content: doc.content,
					chunkIndex: doc.chunkIndex,
					embedding: doc.embedding,
					embeddingModel: doc.embeddingModel,
					metadata: doc.metadata,
				})
				.onConflictDoUpdate({
					target: documentChunks.id,
					set: {
						documentId: doc.documentId,
						tenantId: doc.tenantId,
						content: doc.content,
						chunkIndex: doc.chunkIndex,
						embedding: doc.embedding,
						embeddingModel: doc.embeddingModel,
						metadata: doc.metadata,
					},
				});
		}
	}

	async similaritySearch(
		queryEmbedding: number[],
		topK: number = 3,
		tenantId?: string,
	): Promise<SearchResult[]> {
		const similarity = sql<number>`1 - (${documentChunks.embedding} <=> ${JSON.stringify(queryEmbedding)}::vector)`;

		const query = this.db
			.select({
				id: documentChunks.id,
				documentId: documentChunks.documentId,
				tenantId: documentChunks.tenantId,
				content: documentChunks.content,
				chunkIndex: documentChunks.chunkIndex,
				embeddingModel: documentChunks.embeddingModel,
				metadata: documentChunks.metadata,
				score: similarity,
			})
			.from(documentChunks)
			.orderBy(desc(similarity))
			.limit(topK);

		if (tenantId) {
			query.where(sql`${documentChunks.tenantId} = ${tenantId}`);
		}

		const rows = await query;

		return rows.map((row) => ({
			document: {
				id: row.id,
				documentId: row.documentId,
				tenantId: row.tenantId,
				content: row.content,
				chunkIndex: row.chunkIndex,
				embedding: [],
				embeddingModel: row.embeddingModel,
				metadata: row.metadata as Record<string, unknown>,
			},
			score: row.score,
		}));
	}

	async count(tenantId?: string): Promise<number> {
		const query = this.db
			.select({ count: sql<number>`count(*)::int` })
			.from(documentChunks);

		if (tenantId) {
			query.where(sql`${documentChunks.tenantId} = ${tenantId}`);
		}

		const [row] = await query;
		return row?.count ?? 0;
	}

	async close() {
		await this.client.close();
	}
}
