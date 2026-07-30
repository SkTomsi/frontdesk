import { GoogleGenAI } from "@google/genai";

import type { EmbeddingProvider } from "./types";

export class GoogleEmbeddingProvider implements EmbeddingProvider {
	private client: GoogleGenAI;

	public readonly modelName: string;

	private dimensions: number;

	constructor(config: { apiKey: string; model: string; dimensions?: number }) {
		this.client = new GoogleGenAI({ apiKey: config.apiKey });
		this.modelName = config.model;
		this.dimensions = config.dimensions ?? 1536;
	}

	async embedDocuments(texts: string[]): Promise<number[][]> {
		const res = await this.client.models.embedContent({
			model: this.modelName,
			contents: texts,
			config: {
				taskType: "RETRIEVAL_DOCUMENT",
				outputDimensionality: this.dimensions,
			},
		});
		return (res.embeddings ?? []).map((e) => e.values ?? []);
	}

	async embedQuery(text: string): Promise<number[]> {
		const res = await this.client.models.embedContent({
			model: this.modelName,
			contents: text,
			config: {
				taskType: "RETRIEVAL_QUERY",
				outputDimensionality: this.dimensions,
			},
		});
		return res.embeddings?.[0]?.values ?? [];
	}
}
