import {
	config,
	EmbeddingService,
	Llm,
	supportPrompt,
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
const vectorStore = new VectorStore();
const chunkRepository = new ChunkRepository();
const documentRepository = new DocumentRepository();
const r2 = createR2FromEnv();
const ingestQueue = createIngestQueue();

await vectorStore.initialize();

function tenantFrom(req: Request): string {
	return req.headers.get("x-tenant-id") ?? "default";
}

function json(body: unknown, status: number): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
	});
}

function documentPayload(doc: Awaited<ReturnType<DocumentRepository["getById"]>>) {
	if (!doc) return null;
	return {
		documentId: doc.id,
		filename: doc.filename,
		status: doc.status,
		chunkCount: doc.chunkCount,
		error: doc.error,
		createdAt: doc.createdAt,
		completedAt: doc.completedAt,
	};
}

async function streamAnswer(
	question: string,
	tenantId: string,
	controller: ReadableStreamDefaultController,
) {
	const { results, context } = await retrieveContext(
		question,
		embeddings,
		vectorStore,
		chunkRepository,
		tenantId,
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
				const tenantId = tenantFrom(req);
				const { question } = (await req.json()) as { question: string };

				const body = new ReadableStream({
					async start(controller) {
						try {
							await streamAnswer(question, tenantId, controller);
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
			OPTIONS: () => new Response(null, { headers: CORS_HEADERS }),
			GET: async (req) => {
				const tenantId = tenantFrom(req);
				const url = new URL(req.url);
				const status = url.searchParams.get("status");
				const docs = await documentRepository.listByTenant(tenantId, {
					status: (status as "queued" | "processing" | "completed" | "failed") ?? undefined,
				});
				return json({ documents: docs.map((d) => documentPayload(d)) }, 200);
			},
			POST: async (req) => {
				const tenantId = tenantFrom(req);
				try {
					const formData = await req.formData();
					const file = formData.get("file");
					if (!(file instanceof File)) {
						return json({ error: "No 'file' part provided" }, 400);
					}

					const isPdf =
						file.type === "application/pdf" ||
						file.name.toLowerCase().endsWith(".pdf");
					if (!isPdf) {
						return json({ error: "Only PDF files are supported" }, 400);
					}

					const bytes = new Uint8Array(await file.arrayBuffer());
					const contentHash = new Bun.CryptoHasher("sha256")
						.update(bytes)
						.digest("hex");

					const existing = await documentRepository.findActiveByHash(
						tenantId,
						contentHash,
					);
					if (existing && existing.status !== "failed") {
						return json(
							{
								error: "This document has already been ingested",
								documentId: existing.id,
							},
							409,
						);
					}

					const documentId = existing?.id ?? crypto.randomUUID();
					const key = existing?.objectKey ?? objectKey(tenantId, contentHash);

					if (existing) {
						await ingestQueue.remove(documentId);
						await documentRepository.setStatus(documentId, {
							status: "queued",
							error: null,
							completedAt: null,
						});
					} else {
						await documentRepository.create({
							id: documentId,
							tenantId,
							filename: file.name,
							contentType: file.type,
							sizeBytes: bytes.length,
							contentHash,
							objectKey: key,
						});
					}

					await r2.uploadObject(key, bytes, "application/pdf");

					try {
						await ingestQueue.enqueue({ documentId, tenantId, objectKey: key });
					} catch (error) {
						await documentRepository.setStatus(documentId, {
							status: "failed",
							error: error instanceof Error ? error.message : String(error),
						});
						throw error;
					}

					return json(
						{
							documentId,
							status: "queued",
							tenantId,
						},
						202,
					);
				} catch (error) {
					console.error({ event: "ingest_request_failed", error });
					return json({ error: "Failed to ingest document" }, 500);
				}
			},
		},
		"/api/ingest/:id": {
			OPTIONS: () => new Response(null, { headers: CORS_HEADERS }),
			DELETE: async (req) => {
				const tenantId = tenantFrom(req);
				const document = await documentRepository.getById(req.params.id);
				if (!document || document.tenantId !== tenantId) {
					return json({ error: "Not found" }, 404);
				}

				await chunkRepository.deleteByDocumentId(tenantId, document.id);
				await documentRepository.deleteById(tenantId, document.id);
				try {
					await r2.deleteObject(document.objectKey);
				} catch (error) {
					console.error({
						event: "object_delete_failed",
						objectKey: document.objectKey,
						error,
					});
				}

				return new Response(null, {
					status: 204,
					headers: CORS_HEADERS,
				});
			},
		},
		"/api/ingest/status/:id": {
			OPTIONS: () => new Response(null, { headers: CORS_HEADERS }),
			GET: async (req) => {
				const tenantId = tenantFrom(req);
				const document = await documentRepository.getById(req.params.id);
				if (!document || document.tenantId !== tenantId) {
					return json({ error: "Not found" }, 404);
				}
				return json(documentPayload(document), 200);
			},
		},
	},
});

console.log(`Frontdesk API running on http://localhost:${PORT}`);
