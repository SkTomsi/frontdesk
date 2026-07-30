import type {
	EmbeddingService,
	SearchResult,
	VectorStore,
} from "@frontdesk/ai";

const SIMILARITY_THRESHOLD = 0.7;

interface RetrievalResult {
	results: SearchResult[];
	context: string;
}

function normalizeScore(raw: number): number {
	return raw ** 0.45;
}

export async function retrieveContext(
	question: string,
	embeddings: EmbeddingService,
	vectorStore: VectorStore,
): Promise<RetrievalResult> {
	const queryEmbedding = await embeddings.embedQuery(question);
	const results = await vectorStore.similaritySearch(queryEmbedding, 3);

	const normalized = results.map((r) => ({
		...r,
		score: normalizeScore(r.score),
	}));

	const relevant = normalized.filter((r) => r.score >= SIMILARITY_THRESHOLD);
	const context = relevant
		.map((r) => {
			const label = (r.document.metadata.title as string) || r.document.id;
			return `[${label}] (score: ${r.score.toFixed(3)})\n${r.document.content}`;
		})
		.join("\n\n");
	return { results: relevant, context };
}
