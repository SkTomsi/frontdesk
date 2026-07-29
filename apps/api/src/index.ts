import type { SearchResult } from "@frontdesk/ai";
import {
	config,
	EmbeddingService,
	Llm,
	SupportAnswer,
	sampleDocuments,
	supportPrompt,
	TextSplitter,
	VectorStore,
} from "@frontdesk/ai";

const PORT = 3003;

const llm = new Llm({ model: config.LLM_MODEL });
const embeddings = new EmbeddingService({ model: config.EMBEDDING_MODEL });
const splitter = new TextSplitter({
	chunkSize: config.CHUNK_SIZE,
	chunkOverlap: config.CHUNK_OVERLAP,
});
const vectorStore = new VectorStore();

const structuredModel = llm.withStructuredOutput(SupportAnswer, {
	name: "support-answer",
});

async function ingestDocuments() {
	await vectorStore.initialize();

	const count = await vectorStore.count();
	if (count > 0) return;

	const chunks = await splitter.splitDocuments(sampleDocuments);
	const vectors = await embeddings.embedDocuments(chunks.map((c) => c.text));

	await vectorStore.addDocuments(
		chunks.map((chunk, i) => ({
			id: `doc-${i}`,
			content: chunk.text,
			embedding: vectors[i]!,
			metadata: chunk.metadata,
		})),
	);
}

async function answerQuestion(question: string) {
	const queryEmbedding = await embeddings.embedQuery(question);
	const results = await vectorStore.similaritySearch(queryEmbedding, 3);

	const context = results
		.map((r) => {
			const label = (r.document.metadata.title as string) || r.document.id;
			return `[${label}] (score: ${r.score.toFixed(3)})\n${r.document.content}`;
		})
		.join("\n\n");

	const prompt = supportPrompt({ context, question });
	const answer = await structuredModel.invoke(prompt);
	return { answer, results };
}

function sourcesPayload(results: SearchResult[]) {
	return results.map((r) => ({
		title: r.document.metadata.title as string,
		score: r.score,
	}));
}

await ingestDocuments();

Bun.serve({
	port: PORT,
	routes: {
		"/health": {
			GET: () => new Response("OK", { status: 200 }),
		},
		"/api/ask": {
			POST: async (req) => {
				const { question } = (await req.json()) as { question: string };
				const { answer, results } = await answerQuestion(question);
				return new Response(
					JSON.stringify({
						answer: answer.answer,
						confidence: answer.confidence,
						needsHumanReview: answer.needsHumanReview,
						score: answer.score,
						citedSources: answer.citedSources,
						sources: sourcesPayload(results),
					}),
					{ headers: { "Content-Type": "application/json" } },
				);
			},
		},
	},
});

console.log(`Frontdesk API running on http://localhost:${PORT}`);
