/**
 * Re-ingests every completed document for a tenant through the ingest pipeline
 * (used to rebuild the index after a chunker/embedding change).
 *
 * Usage:  bun run reindex          (worker app)
 * Env:    TENANT_ID (default "default"), DATABASE_URL, R2_*, GOOGLE_API_KEY
 */
import { EmbeddingService } from "@frontdesk/ai";
import { ChunkRepository, DocumentRepository } from "@frontdesk/db";
import { IngestPipeline } from "@frontdesk/ingest";
import { createLogger } from "@frontdesk/logger";
import { createR2FromEnv } from "@frontdesk/storage";

const log = createLogger("reindex");
const tenantId = process.env.TENANT_ID ?? "default";

const r2 = createR2FromEnv();
const chunkRepository = new ChunkRepository();
const documentRepository = new DocumentRepository();
const embeddingService = new EmbeddingService();
const pipeline = new IngestPipeline({
	chunkRepository,
	documentRepository,
	embeddingService,
	logger: log.child({ context: "ingest" }),
});

await chunkRepository.initialize();

const docs = await documentRepository.listByTenant(tenantId, {
	status: "completed",
});
log.info({ tenantId, count: docs.length }, "reindexing completed documents");

let ok = 0;
let failed = 0;

for (const doc of docs) {
	const start = performance.now();
	try {
		await chunkRepository.deleteByDocumentId(tenantId, doc.id);
		const pdf = await r2.getObject(doc.objectKey);
		const output = await pipeline.run({
			tenantId,
			documentId: doc.id,
			pdf,
		});
		ok += 1;
		log.info(
			{
				event: "reindex_completed",
				documentId: doc.id,
				filename: doc.filename,
				parents: output.parentCount,
				children: output.childCount,
				durationMs: Math.round(performance.now() - start),
			},
			"reindexed document",
		);
	} catch (error) {
		failed += 1;
		log.error(
			{
				event: "reindex_failed",
				documentId: doc.id,
				filename: doc.filename,
				error,
			},
			"reindex failed for document",
		);
	}
}

log.info({ tenantId, ok, failed }, "reindex finished");
process.exit(failed > 0 ? 1 : 0);
