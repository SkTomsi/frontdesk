import type { ChunkRepository } from "@frontdesk/db";
import type { Logger } from "@frontdesk/logger";
import type { EmbeddingService } from "../services/embedding";
import type { Llm } from "../services/llm";
import type { VectorStore } from "../services/vector-store";

export interface AgentGraphDeps {
	llm: Llm;
	embeddings: EmbeddingService;
	vectorStore: VectorStore;
	chunkRepository: ChunkRepository;
	logger?: Logger;
}
