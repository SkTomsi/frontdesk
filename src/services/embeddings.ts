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
		return this.client.embedDocuments(texts);
	}

	async embedQuery(text: string): Promise<number[]> {
		return this.client.embedQuery(text);
	}
}
