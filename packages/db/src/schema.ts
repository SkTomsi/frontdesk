import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	vector,
} from "drizzle-orm/pg-core";

export const documentChunks = pgTable(
	"document_chunks",
	{
		id: text("id").primaryKey(),
		documentId: text("document_id").notNull(),
		tenantId: text("tenant_id").notNull(),
		parentId: text("parent_id"),
		content: text("content").notNull(),
		chunkIndex: integer("chunk_index").notNull(),
		pageNum: integer("page_num"),
		embedding: vector("embedding", { dimensions: 1536 }),
		embeddingModel: text("embedding_model"),
		isActive: boolean("is_active").notNull().default(true),
		metadata: jsonb("metadata").default({}).notNull(),
	},
	(table) => [
		index("chunks_embedding_hnsw_idx").using(
			"hnsw",
			table.embedding.op("vector_cosine_ops"),
		),
		index("chunks_tenant_idx").on(table.tenantId),
		index("chunks_document_idx").on(table.documentId),
		index("chunks_parent_idx").on(table.parentId),
		index("chunks_is_active_idx").on(table.isActive),
	],
);

export const documents = pgTable(
	"documents",
	{
		id: text("id").primaryKey(),
		tenantId: text("tenant_id").notNull(),
		filename: text("filename").notNull(),
		contentType: text("content_type").notNull(),
		sizeBytes: integer("size_bytes").notNull(),
		contentHash: text("content_hash").notNull(),
		objectKey: text("object_key").notNull(),
		status: text("status").notNull().default("queued"),
		chunkCount: integer("chunk_count"),
		error: text("error"),
		isActive: boolean("is_active").notNull().default(true),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		completedAt: timestamp("completed_at"),
	},
	(table) => [
		uniqueIndex("documents_tenant_hash_idx").on(table.tenantId, table.contentHash),
		index("documents_status_idx").on(table.status),
		index("documents_tenant_idx").on(table.tenantId),
	],
);
