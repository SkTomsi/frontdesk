import { EmbeddingService } from "@frontdesk/ai";
import { ChunkRepository, DocumentRepository } from "@frontdesk/db";
import { IngestPipeline } from "@frontdesk/ingest";
import { createLogger } from "@frontdesk/logger";
import { createIngestWorker } from "@frontdesk/queue";
import { createR2FromEnv } from "@frontdesk/storage";

const log = createLogger("worker");

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

const worker = createIngestWorker(
	async (job) => {
		const { tenantId, documentId, objectKey } = job;
		const jobLog = log.child({ tenantId, documentId });
		const started = performance.now();

		jobLog.info({ event: "job_received", objectKey }, "ingest job received");

		const pdf = await r2.getObject(objectKey);
		jobLog.info(
			{
				event: "object_downloaded",
				objectKey,
				bytes: pdf.length,
				durationMs: Math.round(performance.now() - started),
			},
			"downloaded object from R2",
		);

		const output = await pipeline.run({ tenantId, documentId, pdf });

		jobLog.info(
			{
				event: "job_completed",
				parentCount: output.parentCount,
				childCount: output.childCount,
				embeddingModel: output.embeddingModel,
				durationMs: Math.round(performance.now() - started),
			},
			"ingest job completed",
		);
	},
	{ concurrency: 2 },
);

worker.on("failed", (job, error) => {
	log.error(
		{
			event: "job_failed",
			documentId: job?.data.documentId,
			tenantId: job?.data.tenantId,
			error: error.message,
			stack: error.stack,
		},
		"ingest job failed",
	);
});

log.info({ event: "worker_started" }, "worker listening on the ingest queue");

const shutdown = async () => {
	await worker.close();
	process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
