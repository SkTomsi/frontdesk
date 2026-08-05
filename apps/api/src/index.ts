import {
	buildAgentGraph,
	config,
	EmbeddingService,
	Llm,
	TokenTracker,
	VectorStore,
} from "@frontdesk/ai";
import { ChunkRepository, DocumentRepository } from "@frontdesk/db";
import { createLogger } from "@frontdesk/logger";
import { createIngestQueue } from "@frontdesk/queue";
import { createR2FromEnv, objectKey } from "@frontdesk/storage";
import { streamSimpleAnswer } from "./simple-rag";
import { CORS_HEADERS, STREAM_HEADERS, send } from "./sse";

const PORT = 3003;
const log = createLogger("api");

const llm = new Llm({ model: config.LLM_MODEL });
const embeddings = new EmbeddingService({ model: config.EMBEDDING_MODEL });
const vectorStore = new VectorStore();
const chunkRepository = new ChunkRepository();
const documentRepository = new DocumentRepository();
const r2 = createR2FromEnv();
const ingestQueue = createIngestQueue();
const agentGraph = buildAgentGraph({
	llm,
	embeddings,
	vectorStore,
	chunkRepository,
	logger: log.child({ context: "agent" }),
});

await vectorStore.initialize();
log.info("vector store initialized");

function tenantFrom(req: Request): string {
	return req.headers.get("x-tenant-id") ?? "default";
}

function json(body: unknown, status: number): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
	});
}

async function handle(
	label: string,
	req: Request,
	fn: () => Promise<Response>,
): Promise<Response> {
	const started = performance.now();
	try {
		const res = await fn();
		log.info(
			{
				event: "request",
				label,
				method: req.method,
				path: new URL(req.url).pathname,
				tenant: tenantFrom(req),
				status: res.status,
				durationMs: Math.round(performance.now() - started),
			},
			`${label} -> ${res.status}`,
		);
		return res;
	} catch (error) {
		log.error(
			{
				event: "request_error",
				label,
				method: req.method,
				path: new URL(req.url).pathname,
				tenant: tenantFrom(req),
				durationMs: Math.round(performance.now() - started),
				error,
			},
			`${label} failed`,
		);
		return json({ error: "Internal server error" }, 500);
	}
}

function documentPayload(
	doc: Awaited<ReturnType<DocumentRepository["getById"]>>,
) {
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
	const started = performance.now();
	log.info({ event: "ask_received", tenantId, question }, "question received");

	const tracker = new TokenTracker();
	const sendToken = (text: string) => {
		send(controller, { type: "assistant_delta", text });
	};

	const result = await agentGraph.invoke(
		{ query: question, tenantId },
		{ configurable: { onToken: sendToken, tokenTracker: tracker } },
	);

	const usage = tracker.summary();
	const answer = result.finalAnswer ?? "";
	const retrieved = result.retrievedResults ?? [];
	const sources = result.sources ?? [];
	const citedSources = result.citedSources ?? [];
	const compressedContext = result.compressedContext;

	log.info(
		{
			event: "agent_graph_completed",
			tenantId,
			question,
			resultCount: retrieved.length,
			contextChunks: sources.length,
			compressedContextLength: compressedContext?.length ?? 0,
			iterations: result.iteration,
			contextScore: result.contextScore,
			confidence: result.confidence,
			needsHumanReview: result.needsHumanReview,
			inputTokens: usage.totalInputTokens,
			outputTokens: usage.totalOutputTokens,
			durationMs: Math.round(performance.now() - started),
			usage,
		},
		"agent graph completed",
	);

	const metaSources =
		citedSources.length > 0
			? sources.filter((s) => citedSources.includes(s.title))
			: sources;

	let totalChars = 0;
	for (const s of metaSources) {
		totalChars += s.title.length;
		send(controller, {
			type: "meta",
			source: s.title,
			chunkSize: 0,
			totalChars,
			score: s.score,
		});
	}

	send(controller, { type: "done", usage });
	log.info(
		{
			event: "ask_stream_completed",
			tenantId,
			answerLength: answer.length,
			citedSources: metaSources.length,
			durationMs: Math.round(performance.now() - started),
		},
		"answer streamed",
	);
}

Bun.serve({
	port: PORT,
	routes: {
		"/health": { GET: () => new Response("OK OK OK!", { status: 200 }) },
		"/api/ask": {
			OPTIONS: () => new Response(null, { headers: CORS_HEADERS }),
			POST: (req) =>
				handle("ask", req, async () => {
					const tenantId = tenantFrom(req);
					const { question } = (await req.json()) as { question: string };

					const body = new ReadableStream({
						async start(controller) {
							try {
								await streamAnswer(question, tenantId, controller);
							} catch (error) {
								log.error(
									{
										event: "ask_stream_error",
										tenantId,
										error,
									},
									"answer stream failed",
								);
								send(controller, {
									type: "error",
									message:
										error instanceof Error
											? error.message
											: "Something went wrong",
								});
							} finally {
								controller.close();
							}
						},
					});

					return new Response(body, { headers: STREAM_HEADERS });
				}),
		},
		"/api/ask/simple": {
			OPTIONS: () => new Response(null, { headers: CORS_HEADERS }),
			POST: (req) =>
				handle("ask_simple", req, async () => {
					const tenantId = tenantFrom(req);
					const { question } = (await req.json()) as { question: string };

					const body = new ReadableStream({
						async start(controller) {
							try {
								await streamSimpleAnswer(
									{ llm, embeddings, vectorStore, chunkRepository },
									question,
									tenantId,
									controller,
								);
							} catch (error) {
								log.error(
									{
										event: "ask_simple_stream_error",
										tenantId,
										error,
									},
									"simple answer stream failed",
								);
								send(controller, {
									type: "error",
									message:
										error instanceof Error
											? error.message
											: "Something went wrong",
								});
							} finally {
								controller.close();
							}
						},
					});

					return new Response(body, { headers: STREAM_HEADERS });
				}),
		},
		"/api/ingest": {
			OPTIONS: () => new Response(null, { headers: CORS_HEADERS }),
			GET: (req) =>
				handle("list_documents", req, async () => {
					const tenantId = tenantFrom(req);
					const url = new URL(req.url);
					const status = url.searchParams.get("status");
					const docs = await documentRepository.listByTenant(tenantId, {
						status:
							(status as "queued" | "processing" | "completed" | "failed") ??
							undefined,
					});
					log.info(`listed ${docs.length} document(s)`);
					return json({ documents: docs.map((d) => documentPayload(d)) }, 200);
				}),
			POST: (req) =>
				handle("ingest_document", req, async () => {
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
							log.warn(
								{
									event: "ingest_rejected",
									tenantId,
									filename: file.name,
									contentType: file.type,
								},
								"rejected non-PDF upload",
							);
							return json({ error: "Only PDF files are supported" }, 400);
						}

						const bytes = new Uint8Array(await file.arrayBuffer());
						const contentHash = new Bun.CryptoHasher("sha256")
							.update(bytes)
							.digest("hex");

						log.info(
							{
								event: "ingest_received",
								tenantId,
								filename: file.name,
								sizeBytes: bytes.length,
								contentHash: contentHash.slice(0, 12),
							},
							"upload received",
						);

						const existing = await documentRepository.findActiveByHash(
							tenantId,
							contentHash,
						);
						if (existing && existing.status !== "failed") {
							log.info(
								{
									event: "ingest_dedup_hit",
									tenantId,
									documentId: existing.id,
								},
								"duplicate upload, returning existing document",
							);
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
							log.info("re-ingesting previously failed document");
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
							log.info("document row created");
						}

						const uploadStarted = performance.now();
						await r2.uploadObject(key, bytes, "application/pdf");
						log.info(
							{
								event: "object_uploaded",
								tenantId,
								documentId,
								objectKey: key,
								sizeBytes: bytes.length,
								durationMs: Math.round(performance.now() - uploadStarted),
							},
							"uploaded object to R2",
						);

						try {
							const { jobId } = await ingestQueue.enqueue({
								documentId,
								tenantId,
								objectKey: key,
							});
							log.info(
								{ event: "ingest_enqueued", tenantId, documentId, jobId },
								"ingest job enqueued",
							);
						} catch (error) {
							await documentRepository.setStatus(documentId, {
								status: "failed",
								error: error instanceof Error ? error.message : String(error),
							});
							log.error(
								{ event: "ingest_enqueue_failed", tenantId, documentId, error },
								"failed to enqueue ingest job",
							);
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
						log.error(
							{ event: "ingest_request_failed", tenantId, error },
							"ingest request failed",
						);
						return json({ error: "Failed to ingest document" }, 500);
					}
				}),
		},
		"/api/ingest/:id": {
			OPTIONS: () => new Response(null, { headers: CORS_HEADERS }),
			DELETE: (req) =>
				handle("delete_document", req, async () => {
					const tenantId = tenantFrom(req);
					const document = await documentRepository.getById(req.params.id);
					if (!document || document.tenantId !== tenantId) {
						return json({ error: "Not found" }, 404);
					}

					const deletedChunks = await chunkRepository.deleteByDocumentId(
						tenantId,
						document.id,
					);
					const deleted = await documentRepository.deleteById(
						tenantId,
						document.id,
					);
					try {
						await r2.deleteObject(document.objectKey);
					} catch (error) {
						log.error(
							{
								event: "object_delete_failed",
								tenantId,
								documentId: document.id,
								objectKey: document.objectKey,
								error,
							},
							"failed to delete object from R2",
						);
					}

					log.info(
						{
							event: "document_deleted",
							tenantId,
							documentId: document.id,
							filename: document.filename,
							chunksDeleted: deletedChunks,
							objectKey: document.objectKey,
							rowDeleted: deleted,
						},
						"document deleted",
					);

					return new Response(null, {
						status: 204,
						headers: CORS_HEADERS,
					});
				}),
		},
		"/api/ingest/status/:id": {
			OPTIONS: () => new Response(null, { headers: CORS_HEADERS }),
			GET: (req) =>
				handle("document_status", req, async () => {
					const tenantId = tenantFrom(req);
					const document = await documentRepository.getById(req.params.id);
					if (!document || document.tenantId !== tenantId) {
						return json({ error: "Not found" }, 404);
					}
					return json(documentPayload(document), 200);
				}),
		},
	},
});

log.info(`API listening on :${PORT}`);
