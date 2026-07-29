import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

interface EmbeddingServiceConfig {
	apiKey?: string;
	model?: string;
}

export class EmbeddingService {
	private client: GoogleGenerativeAIEmbeddings;

	constructor(config: EmbeddingServiceConfig = {}) {
		this.client = new GoogleGenerativeAIEmbeddings({
			apiKey: config.apiKey ?? process.env.GOOGLE_API_KEY,
			modelName: config.model ?? "embedding-001",
		});
	}

	async embedDocuments(texts: string[]): Promise<number[][]> {
		return withRetry(() => this.client.embedDocuments(texts));
	}

	async embedQuery(text: string): Promise<number[]> {
		return withRetry(() => this.client.embedQuery(text));
	}
}

async function withRetry<T>(
	fn: () => Promise<T>,
	maxRetries: number = 3,
): Promise<T> {
	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			return await fn();
		} catch (err) {
			const isLast = attempt === maxRetries;
			if (isLast) throw err;

			const delay = 2 ** attempt * 1000;
			console.warn(
				`Embedding failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`,
			);
			await new Promise((r) => setTimeout(r, delay));
		}
	}
	throw new Error("unreachable");
}
