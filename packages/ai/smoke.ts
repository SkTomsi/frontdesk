import { buildAgentGraph, EmbeddingService, Llm, TokenTracker, VectorStore } from "./src/index";
import { ChunkRepository } from "@frontdesk/db";

const llm = new Llm();
const embeddings = new EmbeddingService();
const vectorStore = new VectorStore();
const chunkRepository = new ChunkRepository();

const graph = buildAgentGraph({ llm, embeddings, vectorStore, chunkRepository });

console.log("graph compiled; nodes:");
for (const node of Object.keys(graph.getGraph().nodes)) console.log(" -", node);

await vectorStore.initialize();
const total = await vectorStore.count("default");
console.log(`chunks for tenant "default": ${total}`);

if (total > 0) {
	const tracker = new TokenTracker();
	const started = performance.now();
	try {
		const result = await graph.invoke(
			{ query: "What is the core idea of the meal prep system, and what are the two fixed components and the rotating one?", tenantId: "default" },
			{ configurable: { tokenTracker: tracker } },
		);
		console.log("\n--- result ---");
		console.log("queryType:", result.queryType);
		console.log("contextScore:", result.contextScore);
		console.log("parents:", result.parentChunkIds?.length, "sources:", result.sources?.length);
		console.log("compressedContext chars:", result.compressedContext?.length);
		console.log("finalAnswer chars:", result.finalAnswer?.length);
		console.log("citedSources:", result.citedSources);
		console.log("confidence:", result.confidence, "needsHumanReview:", result.needsHumanReview);
	} catch (err) {
		console.log("\ninvoke failed:", String(err).slice(0, 300));
	} finally {
		console.log("usage:", JSON.stringify(tracker.summary(), null, 2));
		console.log("total duration:", Math.round(performance.now() - started), "ms");
	}
} else {
	console.log("no documents ingested for tenant 'default' — skipping LLM invoke");
}

process.exit(0);
