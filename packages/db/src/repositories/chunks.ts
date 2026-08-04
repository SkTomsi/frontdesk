import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { createDb } from "../index";
import { documentChunks } from "../schema";

export interface StoredChunk {
	id: string;
	documentId: string;
	tenantId: string;
	parentId: string | null;
	content: string;
	chunkIndex: number;
	pageNum: number | null;
	embeddingModel: string | null;
	isActive: boolean;
	metadata: Record<string, unknown>;
}

export interface SearchResultRow {
	chunk: StoredChunk;
	score: number;
}

export interface NewChunk {
	id: string;
	documentId: string;
	tenantId: string;
	parentId?: string | null;
	content: string;
	chunkIndex: number;
	pageNum?: number | null;
	embedding?: number[] | null;
	embeddingModel?: string | null;
	isActive?: boolean;
	metadata?: Record<string, unknown>;
}

function toStoredChunk(row: typeof documentChunks.$inferSelect): StoredChunk {
	return {
		id: row.id,
		documentId: row.documentId,
		tenantId: row.tenantId,
		parentId: row.parentId,
		content: row.content,
		chunkIndex: row.chunkIndex,
		pageNum: row.pageNum,
		embeddingModel: row.embeddingModel,
		isActive: row.isActive,
		metadata: (row.metadata ?? {}) as Record<string, unknown>,
	};
}

export class ChunkRepository {
	private db: ReturnType<typeof createDb>["db"];

	constructor(databaseUrl?: string) {
		this.db = createDb(databaseUrl).db;
	}

	/** Idempotent dev bootstrap: creates the vector extension, tables, and indexes. */
	async initialize(): Promise<void> {
		await this.db.execute(sql.raw("CREATE EXTENSION IF NOT EXISTS vector"));

		await this.db.execute(
			sql.raw(`CREATE TABLE IF NOT EXISTS "document_chunks" (
			"id" text PRIMARY KEY,
			"document_id" text NOT NULL,
			"tenant_id" text NOT NULL,
			"parent_id" text,
			"content" text NOT NULL,
			"chunk_index" integer NOT NULL,
			"page_num" integer,
			"embedding" vector(1536),
			"embedding_model" text,
			"is_active" boolean NOT NULL DEFAULT true,
			"metadata" jsonb DEFAULT '{}' NOT NULL
		)`),
		);

		await this.db.execute(
			sql.raw(`CREATE TABLE IF NOT EXISTS "documents" (
			"id" text PRIMARY KEY,
			"tenant_id" text NOT NULL,
			"filename" text NOT NULL,
			"content_type" text NOT NULL,
			"size_bytes" integer NOT NULL,
			"content_hash" text NOT NULL,
			"object_key" text NOT NULL,
			"status" text NOT NULL DEFAULT 'queued',
			"chunk_count" integer,
			"error" text,
			"is_active" boolean NOT NULL DEFAULT true,
			"created_at" timestamp NOT NULL DEFAULT now(),
			"completed_at" timestamp
		)`),
		);

		// Reconcile tables created by an older dev schema.
		await this.db.execute(
			sql.raw(`ALTER TABLE "document_chunks" ALTER COLUMN "embedding" DROP NOT NULL`),
		);
		await this.db.execute(
			sql.raw(
				`ALTER TABLE "document_chunks" ALTER COLUMN "embedding_model" DROP NOT NULL`,
			),
		);
		await this.db.execute(
			sql.raw(
				`ALTER TABLE "document_chunks" ADD COLUMN IF NOT EXISTS "parent_id" text`,
			),
		);
		await this.db.execute(
			sql.raw(
				`ALTER TABLE "document_chunks" ADD COLUMN IF NOT EXISTS "page_num" integer`,
			),
		);
		await this.db.execute(
			sql.raw(
				`ALTER TABLE "document_chunks" ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true`,
			),
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
		await this.db.execute(
			sql.raw(
				`CREATE INDEX IF NOT EXISTS "chunks_parent_idx" ON "document_chunks" ("parent_id")`,
			),
		);
		await this.db.execute(
			sql.raw(
				`CREATE INDEX IF NOT EXISTS "chunks_is_active_idx" ON "document_chunks" ("is_active")`,
			),
		);
		await this.db.execute(
			sql.raw(
				`CREATE UNIQUE INDEX IF NOT EXISTS "documents_tenant_hash_idx" ON "documents" ("tenant_id", "content_hash")`,
			),
		);
		await this.db.execute(
			sql.raw(
				`CREATE INDEX IF NOT EXISTS "documents_status_idx" ON "documents" ("status")`,
			),
		);
	}

	async insertMany(chunks: NewChunk[]): Promise<void> {
		if (chunks.length === 0) return;
		for (const chunk of chunks) {
			await this.db
				.insert(documentChunks)
				.values({
					id: chunk.id,
					documentId: chunk.documentId,
					tenantId: chunk.tenantId,
					parentId: chunk.parentId ?? null,
					content: chunk.content,
					chunkIndex: chunk.chunkIndex,
					pageNum: chunk.pageNum ?? null,
					embedding: chunk.embedding ?? null,
					embeddingModel: chunk.embeddingModel ?? null,
					isActive: chunk.isActive ?? true,
					metadata: chunk.metadata ?? {},
				})
				.onConflictDoUpdate({
					target: documentChunks.id,
					set: {
						documentId: chunk.documentId,
						tenantId: chunk.tenantId,
						parentId: chunk.parentId ?? null,
						content: chunk.content,
						chunkIndex: chunk.chunkIndex,
						pageNum: chunk.pageNum ?? null,
						embedding: chunk.embedding ?? null,
						embeddingModel: chunk.embeddingModel ?? null,
						isActive: chunk.isActive ?? true,
						metadata: chunk.metadata ?? {},
					},
				});
		}
	}

	async search(
		queryEmbedding: number[],
		topK: number = 3,
		tenantId?: string,
	): Promise<SearchResultRow[]> {
		const similarity = sql<number>`1 - (${documentChunks.embedding} <=> ${JSON.stringify(queryEmbedding)}::vector)`;

		const conditions = [
			eq(documentChunks.isActive, true),
			isNotNull(documentChunks.embedding),
		];
		if (tenantId) {
			conditions.push(eq(documentChunks.tenantId, tenantId));
		}

		const rows = await this.db
			.select({
				id: documentChunks.id,
				documentId: documentChunks.documentId,
				tenantId: documentChunks.tenantId,
				parentId: documentChunks.parentId,
				content: documentChunks.content,
				chunkIndex: documentChunks.chunkIndex,
				pageNum: documentChunks.pageNum,
				embeddingModel: documentChunks.embeddingModel,
				isActive: documentChunks.isActive,
				metadata: documentChunks.metadata,
				score: similarity,
			})
			.from(documentChunks)
			.where(and(...conditions))
			.orderBy(desc(similarity))
			.limit(topK);

		return rows.map((row) => ({
			chunk: {
				id: row.id,
				documentId: row.documentId,
				tenantId: row.tenantId,
				parentId: row.parentId,
				content: row.content,
				chunkIndex: row.chunkIndex,
				pageNum: row.pageNum,
				embeddingModel: row.embeddingModel,
				isActive: row.isActive,
				metadata: (row.metadata ?? {}) as Record<string, unknown>,
			},
			score: row.score,
		}));
	}

	async getParentsByIds(ids: string[]): Promise<StoredChunk[]> {
		if (ids.length === 0) return [];
		const rows = await this.db
			.select()
			.from(documentChunks)
			.where(inArray(documentChunks.id, ids));
		return rows.map(toStoredChunk);
	}

	async count(tenantId?: string): Promise<number> {
		const conditions = [eq(documentChunks.isActive, true)];
		if (tenantId) {
			conditions.push(eq(documentChunks.tenantId, tenantId));
		}
		const [row] = await this.db
			.select({ count: sql<number>`count(*)::int` })
			.from(documentChunks)
			.where(and(...conditions));
		return row?.count ?? 0;
	}

	async deactivateByDocumentId(
		tenantId: string,
		documentId: string,
	): Promise<void> {
		await this.db
			.update(documentChunks)
			.set({ isActive: false })
			.where(
				and(
					eq(documentChunks.tenantId, tenantId),
					eq(documentChunks.documentId, documentId),
				),
			);
	}

	async deleteByDocumentId(
		tenantId: string,
		documentId: string,
	): Promise<number> {
		const rows = await this.db
			.delete(documentChunks)
			.where(
				and(
					eq(documentChunks.tenantId, tenantId),
					eq(documentChunks.documentId, documentId),
				),
			)
			.returning({ id: documentChunks.id });
		return rows.length;
	}

	async close(): Promise<void> {
		createDb().client.close();
	}
}
