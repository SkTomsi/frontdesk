import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";

interface EmbeddingServiceConfig {
	apiKey?: string;
	model?: string;
}

export class EmbeddingService {
	private queryClient: GoogleGenerativeAIEmbeddings;
	private docClient: GoogleGenerativeAIEmbeddings;

	constructor(config: EmbeddingServiceConfig = {}) {
		const apiKey = config.apiKey ?? process.env.GOOGLE_API_KEY;
		const modelName = config.model ?? "gemini-embedding-2";

		this.queryClient = new GoogleGenerativeAIEmbeddings({
			apiKey,
			modelName,
			taskType: TaskType.RETRIEVAL_QUERY,
		});

		this.docClient = new GoogleGenerativeAIEmbeddings({
			apiKey,
			modelName,
			taskType: TaskType.RETRIEVAL_DOCUMENT,
		});
	}

	async embedDocuments(texts: string[]): Promise<number[][]> {
		return withRetry(() => this.docClient.embedDocuments(texts));
	}

	async embedQuery(text: string): Promise<number[]> {
		return withRetry(() => this.queryClient.embedQuery(text));
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
