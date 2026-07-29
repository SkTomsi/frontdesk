import type {
	EmbeddingService,
	SearchResult,
	VectorStore,
} from "@frontdesk/ai";

const SIMILARITY_THRESHOLD = 0.5;

interface RetrievalResult {
	results: SearchResult[];
	context: string;
}

export async function retrieveContext(
	question: string,
	embeddings: EmbeddingService,
	vectorStore: VectorStore,
): Promise<RetrievalResult> {
	const queryEmbedding = await embeddings.embedQuery(question);
	const results = await vectorStore.similaritySearch(queryEmbedding, 3);
	console.log(results);
	const relevant = results.filter((r) => r.score >= SIMILARITY_THRESHOLD);
	const context = relevant
		.map((r) => {
			const label = (r.document.metadata.title as string) || r.document.id;
			return `[${label}] (score: ${r.score.toFixed(3)})\n${r.document.content}`;
		})
		.join("\n\n");
	console.log(context);
	return { results: relevant, context };
}
