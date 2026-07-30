CREATE TABLE "document_chunks" (
	"id" text PRIMARY KEY,
	"document_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"content" text NOT NULL,
	"chunk_index" integer NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"embedding_model" text NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE INDEX "chunks_embedding_hnsw_idx" ON "document_chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "chunks_tenant_idx" ON "document_chunks" ("tenant_id");--> statement-breakpoint
CREATE INDEX "chunks_document_idx" ON "document_chunks" ("document_id");