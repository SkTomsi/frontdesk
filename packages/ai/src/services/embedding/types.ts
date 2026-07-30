export interface EmbeddingProvider {
	embedDocuments(texts: string[]): Promise<number[][]>;
	embedQuery(text: string): Promise<number[]>;
}

export interface EmbeddingServiceConfig {
	apiKey?: string;
	model?: string;
	batchSize?: number;
	concurrency?: number;
	maxRetries?: number;
	timeoutMs?: number;
}

export interface EmbeddingMetadata {
	model: string;
	dimensions: number;
	taskType: "RETRIEVAL_QUERY" | "RETRIEVAL_DOCUMENT";
}

export interface EmbeddingResult {
	embeddings: number[][];
	metadata: EmbeddingMetadata;
}
