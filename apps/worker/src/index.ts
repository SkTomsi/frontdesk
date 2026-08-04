import { EmbeddingService } from "@frontdesk/ai";
import { ChunkRepository, DocumentRepository } from "@frontdesk/db";
import { IngestPipeline } from "@frontdesk/ingest";
import { createIngestWorker } from "@frontdesk/queue";
import { createR2FromEnv } from "@frontdesk/storage";

const r2 = createR2FromEnv();
const chunkRepository = new ChunkRepository();
const documentRepository = new DocumentRepository();
const embeddingService = new EmbeddingService();
const pipeline = new IngestPipeline({
	chunkRepository,
	documentRepository,
	embeddingService,
});

const worker = createIngestWorker(
	async (job) => {
		const { tenantId, documentId, objectKey } = job;
		const pdf = await r2.getObject(objectKey);
		const output = await pipeline.run({ tenantId, documentId, pdf });
		console.log({
			event: "ingest_completed",
			documentId: output.documentId,
			parentCount: output.parentCount,
			childCount: output.childCount,
		});
	},
	{ concurrency: 2 },
);

worker.on("failed", (job, error) => {
	console.error({
		event: "ingest_failed",
		documentId: job?.data.documentId,
		error: error.message,
	});
});

console.log("Frontdesk worker listening on the ingest queue");

const shutdown = async () => {
	await worker.close();
	process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
