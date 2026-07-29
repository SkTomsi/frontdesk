CREATE TABLE "documents" (
	"id" text PRIMARY KEY,
	"content" text NOT NULL,
	"embedding" vector(3072) NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE INDEX "documents_embedding_idx" ON "documents" USING hnsw ("embedding" vector_cosine_ops);