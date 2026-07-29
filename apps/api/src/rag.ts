import type { EmbeddingService, VectorStore, SearchResult } from "@frontdesk/ai";

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
	const context = results
		.map((r) => {
			const label = (r.document.metadata.title as string) || r.document.id;
			return `[${label}] (score: ${r.score.toFixed(3)})\n${r.document.content}`;
		})
		.join("\n\n");
	return { results, context };
}
