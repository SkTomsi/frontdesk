const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;
const EMBEDDING_MODEL = "gemini-embedding-001";
const LLM_MODEL = "llama-3.3-70b-versatile";

// Phase B: candidate count pulled from the vector store before reranking.
const RETRIEVE_CANDIDATES = {
	simple_factual: 15,
	multi_part: 30,
	procedural: 30,
} as const;

const MAX_MERGED_CANDIDATES = 30;
const RERANK_TOP_K = 5;
const RERANK_SNIPPET_CHARS = 200;
const CONTEXT_COMPRESSION_TARGET_TOKENS = 600;

// Phase D: semantic chunker bounds (chars).
const SEMANTIC_PARENT = { target: 1500, min: 1000, max: 2200, threshold: 0.7 };
const SEMANTIC_CHILD = { target: 400, min: 250, max: 700, threshold: 0.75 };

export const config = {
	CHUNK_SIZE,
	CHUNK_OVERLAP,
	EMBEDDING_MODEL,
	LLM_MODEL,
	RETRIEVE_CANDIDATES,
	MAX_MERGED_CANDIDATES,
	RERANK_TOP_K,
	RERANK_SNIPPET_CHARS,
	CONTEXT_COMPRESSION_TARGET_TOKENS,
	SEMANTIC_PARENT,
	SEMANTIC_CHILD,
};
