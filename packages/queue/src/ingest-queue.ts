import { Queue } from "bullmq";
import type { Redis } from "ioredis";
import { createRedisConnection } from "./connection";

export interface IngestJob {
	documentId: string;
	tenantId: string;
	objectKey: string;
}

export interface IngestQueue {
	enqueue(job: IngestJob): Promise<{ jobId: string }>;
	close(): Promise<void>;
}

export function createIngestQueue(
	connection: Redis = createRedisConnection(),
): IngestQueue {
	const queue = new Queue<IngestJob>("ingest", { connection });

	return {
		async enqueue(job) {
			const added = await queue.add("ingest", job, {
				jobId: job.documentId,
				attempts: 3,
				backoff: { type: "exponential", delay: 2000 },
				removeOnComplete: 100,
				removeOnFail: 500,
			});
			return { jobId: added.id ?? job.documentId };
		},

		async close() {
			await queue.close();
			connection.disconnect();
		},
	};
}
