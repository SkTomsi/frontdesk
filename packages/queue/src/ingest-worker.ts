import { Worker } from "bullmq";
import type { Redis } from "ioredis";
import { createRedisConnection } from "./connection";
import type { IngestJob } from "./ingest-queue";

export interface IngestWorkerOptions {
	concurrency?: number;
}

export function createIngestWorker(
	handler: (job: IngestJob) => Promise<void>,
	options: IngestWorkerOptions = {},
	connection: Redis = createRedisConnection(),
): Worker<IngestJob> {
	const { concurrency = 2 } = options;

	return new Worker<IngestJob>(
		"ingest",
		async (job) => {
			await handler(job.data);
		},
		{
			connection,
			concurrency,
		},
	);
}
