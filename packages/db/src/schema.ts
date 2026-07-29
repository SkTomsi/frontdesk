import { index, jsonb, pgTable, text, vector } from "drizzle-orm/pg-core";

export const documents = pgTable(
	"documents",
	{
		id: text("id").primaryKey(),
		content: text("content").notNull(),
		embedding: vector("embedding", { dimensions: 3072 }).notNull(),
		metadata: jsonb("metadata").default({}).notNull(),
	},
	(table) => [
		index("documents_embedding_idx").using(
			"hnsw",
			table.embedding.op("vector_cosine_ops"),
		),
	],
);
