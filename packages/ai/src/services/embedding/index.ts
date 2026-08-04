import { createLogger } from "@frontdesk/logger";
import { GoogleEmbeddingProvider } from "./google-embedding-provider";
import type { EmbeddingProvider, EmbeddingServiceConfig } from "./types";

const log = createLogger("ai");

export class EmbeddingService {
	private provider: EmbeddingProvider;

	public readonly modelName: string;

	private batchSize: number;

	private concurrency: number;

	private maxRetries: number;

	private timeoutMs: number;

	constructor(
		config: EmbeddingServiceConfig & { provider?: EmbeddingProvider } = {},
	) {
		const apiKey = config.apiKey ?? process.env.GOOGLE_API_KEY;

		if (!apiKey) {
			throw new Error("GOOGLE_API_KEY is required");
		}

		this.modelName = config.model ?? "gemini-embedding-001";
		this.batchSize = config.batchSize ?? 5;
		this.concurrency = config.concurrency ?? 3;
		this.maxRetries = config.maxRetries ?? 3;
		this.timeoutMs = config.timeoutMs ?? 30_000;

		this.provider =
			config.provider ??
			new GoogleEmbeddingProvider({
				apiKey,
				model: this.modelName,
			});
	}

	async embedDocuments(texts: string[]): Promise<number[][]> {
		if (texts.length === 0) {
			return [];
		}

		const batches = this.createBatches(texts, this.batchSize);

		const results: number[][] = [];

		for (let i = 0; i < batches.length; i += this.concurrency) {
			const batchGroup = batches.slice(i, i + this.concurrency);

			const embeddings = await Promise.all(
				batchGroup.map((batch) => this.embedBatch(batch)),
			);

			for (const batchEmbeddings of embeddings) {
				results.push(...batchEmbeddings);
			}
		}

		return results;
	}

	async embedQuery(text: string): Promise<number[]> {
		if (!text.trim()) {
			throw new Error("Query text cannot be empty");
		}

		return this.executeWithRetry(() =>
			this.withTimeout(this.provider.embedQuery(text)),
		);
	}

	private async embedBatch(texts: string[]): Promise<number[][]> {
		const start = performance.now();

		const embeddings = await this.executeWithRetry(() =>
			this.withTimeout(this.provider.embedDocuments(texts)),
		);

		const duration = performance.now() - start;

		log.info(
			{
				event: "embedding_batch_completed",
				model: this.modelName,
				batchSize: texts.length,
				durationMs: Math.round(duration),
			},
			"embedded batch",
		);

		return embeddings;
	}

	private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
		for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
			try {
				return await fn();
			} catch (error) {
				const isLastAttempt = attempt === this.maxRetries;

				if (isLastAttempt || !this.isRetryableError(error)) {
					throw error;
				}

				const delay = this.calculateBackoff(attempt);

				log.warn(
					{
						event: "embedding_retry",
						attempt: attempt + 1,
						maxRetries: this.maxRetries,
						delayMs: delay,
						error,
					},
					"retrying embedding request",
				);

				await this.sleep(delay);
			}
		}

		throw new Error("Unexpected retry state");
	}

	private calculateBackoff(attempt: number): number {
		const baseDelay = 2 ** attempt * 1_000;
		const jitter = Math.random() * 500;
		return baseDelay + jitter;
	}

	private async withTimeout<T>(promise: Promise<T>): Promise<T> {
		return Promise.race([
			promise,
			new Promise<T>((_, reject) => {
				setTimeout(() => {
					reject(new Error("Embedding request timed out"));
				}, this.timeoutMs);
			}),
		]);
	}

	private isRetryableError(error: unknown): boolean {
		if (!(error instanceof Error)) {
			return true;
		}

		const message = error.message.toLowerCase();

		if (message.includes("429") || message.includes("rate limit")) {
			return true;
		}

		if (
			message.includes("500") ||
			message.includes("502") ||
			message.includes("503") ||
			message.includes("504")
		) {
			return true;
		}

		if (
			message.includes("timeout") ||
			message.includes("network") ||
			message.includes("fetch failed")
		) {
			return true;
		}

		return false;
	}

	private createBatches<T>(items: T[], size: number): T[][] {
		const batches: T[][] = [];

		for (let i = 0; i < items.length; i += size) {
			batches.push(items.slice(i, i + size));
		}

		return batches;
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
