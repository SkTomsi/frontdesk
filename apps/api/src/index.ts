import {
	config,
	EmbeddingService,
	Llm,
	sampleDocuments,
	supportPrompt,
	TextSplitter,
	VectorStore,
} from "@frontdesk/ai";
import { ChunkRepository, DocumentRepository } from "@frontdesk/db";
import { createIngestQueue } from "@frontdesk/queue";
import { createR2FromEnv, objectKey } from "@frontdesk/storage";
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
const chunkRepository = new ChunkRepository();
const documentRepository = new DocumentRepository();
const r2 = createR2FromEnv();
const ingestQueue = createIngestQueue();

await vectorStore.initialize();
const count = await vectorStore.count();
console.log(`Vector store contains ${count} chunks`);
if (count === 0) {
	console.log("Splitting documents...");
	const chunks = await splitter.splitDocuments(sampleDocuments);
	const texts = chunks.map((c) => c.text);
	console.log("Embedding texts...");
	const vectors = await embeddings.embedDocuments(texts);
	console.log("Adding chunks to vector store...");
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

function tenantFrom(req: Request): string {
	return req.headers.get("x-tenant-id") ?? "default";
}

async function streamAnswer(
	question: string,
	controller: ReadableStreamDefaultController,
) {
	const { results, context } = await retrieveContext(
		question,
		embeddings,
		vectorStore,
		chunkRepository,
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
		"/api/ingest": {
			POST: async (req) => {
				const tenantId = tenantFrom(req);
				try {
					const formData = await req.formData();
					const file = formData.get("file");
					if (!(file instanceof File)) {
						return Response.json(
							{ error: "No 'file' part provided" },
							{ status: 400 },
						);
					}

					const isPdf =
						file.type === "application/pdf" ||
						file.name.toLowerCase().endsWith(".pdf");
					if (!isPdf) {
						return Response.json(
							{ error: "Only PDF files are supported" },
							{ status: 400 },
						);
					}

					const bytes = new Uint8Array(await file.arrayBuffer());
					const contentHash = new Bun.CryptoHasher("sha256")
						.update(bytes)
						.digest("hex");

					const existing = await documentRepository.findActiveByHash(
						tenantId,
						contentHash,
					);
					if (existing) {
						return Response.json(
							{
								error: "This document has already been ingested",
								documentId: existing.id,
							},
							{ status: 409 },
						);
					}

					const documentId = crypto.randomUUID();
					const key = objectKey(tenantId, contentHash);

					await r2.uploadObject(key, bytes, "application/pdf");

					await documentRepository.create({
						id: documentId,
						tenantId,
						filename: file.name,
						contentType: file.type,
						sizeBytes: bytes.length,
						contentHash,
						objectKey: key,
					});

					try {
						await ingestQueue.enqueue({ documentId, tenantId, objectKey: key });
					} catch (error) {
						await documentRepository.setStatus(documentId, {
							status: "failed",
							error: error instanceof Error ? error.message : String(error),
						});
						throw error;
					}

					return Response.json(
						{
							documentId,
							status: "queued",
							tenantId,
						},
						{ status: 202 },
					);
				} catch (error) {
					console.error({ event: "ingest_request_failed", error });
					return Response.json(
						{ error: "Failed to ingest document" },
						{ status: 500 },
					);
				}
			},
		},
		"/api/ingest/status/:id": {
			GET: async (req) => {
				const tenantId = tenantFrom(req);
				const document = await documentRepository.getById(req.params.id);
				if (!document || document.tenantId !== tenantId) {
					return Response.json({ error: "Not found" }, { status: 404 });
				}
				return Response.json({
					documentId: document.id,
					filename: document.filename,
					status: document.status,
					chunkCount: document.chunkCount,
					error: document.error,
					createdAt: document.createdAt,
					completedAt: document.completedAt,
				});
			},
		},
	},
});

console.log(`Frontdesk API running on http://localhost:${PORT}`);
