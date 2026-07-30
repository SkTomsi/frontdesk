import {
	config,
	EmbeddingService,
	Llm,
	sampleDocuments,
	supportPrompt,
	TextSplitter,
	VectorStore,
} from "@frontdesk/ai";
import { retrieveContext } from "./rag";
import { CORS_HEADERS, STREAM_HEADERS, send } from "./sse";

const PORT = 3003;

const llm = new Llm({ model: config.LLM_MODEL });
const embeddings = new EmbeddingService({ model: config.EMBEDDING_MODEL });
const splitter = new TextSplitter({
	chunkSize: config.CHUNK_SIZE,
	chunkOverlap: config.CHUNK_OVERLAP,
});
const vectorStore = new VectorStore();

await vectorStore.initialize();
const count = await vectorStore.count();
if (count === 0) {
	const chunks = await splitter.splitDocuments(sampleDocuments);
	const texts = chunks.map((c) => c.text);
	const vectors = await embeddings.embedDocuments(texts);
	await vectorStore.addDocuments(
		chunks.map((chunk, i) => ({
			id: crypto.randomUUID(),
			documentId: "sample-doc",
			tenantId: "default",
			content: chunk.text,
			chunkIndex: i,
			embedding: vectors[i]!,
			embeddingModel: embeddings.modelName,
			metadata: chunk.metadata,
		})),
	);
}

async function streamAnswer(
	question: string,
	controller: ReadableStreamDefaultController,
) {
	const { results, context } = await retrieveContext(
		question,
		embeddings,
		vectorStore,
	);

	const llmStream = await llm.stream(supportPrompt({ context, question }));

	let answer = "";
	for await (const chunk of llmStream) {
		const text = chunk.content as string;
		if (text) {
			answer += text;
			send(controller, { type: "assistant_delta", text });
		}
	}

	const citedSources = results.filter((r) => {
		const title = r.document.metadata.title as string;
		return answer.includes(title);
	});

	let totalChars = 0;
	for (const r of citedSources) {
		totalChars += r.document.content.length;
		send(controller, {
			type: "meta",
			source: r.document.metadata.title as string,
			chunkSize: r.document.content.length,
			totalChars,
			score: r.score,
		});
	}

	send(controller, { type: "done" });
}

Bun.serve({
	port: PORT,
	routes: {
		"/health": { GET: () => new Response("OK OK OK!", { status: 200 }) },
		"/api/ask": {
			OPTIONS: () => new Response(null, { headers: CORS_HEADERS }),
			POST: async (req) => {
				const { question } = (await req.json()) as { question: string };

				const body = new ReadableStream({
					async start(controller) {
						try {
							await streamAnswer(question, controller);
						} catch {
							send(controller, {
								type: "error",
								message: "Something went wrong",
							});
						} finally {
							controller.close();
						}
					},
				});

				return new Response(body, { headers: STREAM_HEADERS });
			},
		},
	},
});

console.log(`Frontdesk API running on http://localhost:${PORT}`);
