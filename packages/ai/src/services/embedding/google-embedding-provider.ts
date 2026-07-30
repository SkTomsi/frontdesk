import { TaskType } from "@google/generative-ai";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

import type { EmbeddingProvider } from "./types";

export class GoogleEmbeddingProvider implements EmbeddingProvider {
	private queryClient: GoogleGenerativeAIEmbeddings;
	private documentClient: GoogleGenerativeAIEmbeddings;

	public readonly modelName: string;

	constructor(config: { apiKey: string; model: string }) {
		this.modelName = config.model;

		this.queryClient = new GoogleGenerativeAIEmbeddings({
			apiKey: config.apiKey,
			modelName: config.model,
			taskType: TaskType.RETRIEVAL_QUERY,
		});

		this.documentClient = new GoogleGenerativeAIEmbeddings({
			apiKey: config.apiKey,
			modelName: config.model,
			taskType: TaskType.RETRIEVAL_DOCUMENT,
		});
	}

	async embedDocuments(texts: string[]): Promise<number[][]> {
		return this.documentClient.embedDocuments(texts);
	}

	async embedQuery(text: string): Promise<number[]> {
		return this.queryClient.embedQuery(text);
	}
}
