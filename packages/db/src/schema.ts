import {
	index,
	integer,
	jsonb,
	pgTable,
	text,
	vector,
} from "drizzle-orm/pg-core";

export const documentChunks = pgTable(
	"document_chunks",
	{
		id: text("id").primaryKey(),
		documentId: text("document_id").notNull(),
		tenantId: text("tenant_id").notNull(),
		content: text("content").notNull(),
		chunkIndex: integer("chunk_index").notNull(),
		embedding: vector("embedding", { dimensions: 3072 }).notNull(),
		embeddingModel: text("embedding_model").notNull(),
		metadata: jsonb("metadata").default({}).notNull(),
	},
	(table) => [
		index("chunks_embedding_hnsw_idx").using(
			"hnsw",
			table.embedding.op("vector_cosine_ops"),
		),
		index("chunks_tenant_idx").on(table.tenantId),
		index("chunks_document_idx").on(table.documentId),
	],
);
