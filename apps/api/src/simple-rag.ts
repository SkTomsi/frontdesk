import {
	type EmbeddingService,
	formatContext,
	type Llm,
	labelFor,
	supportPrompt,
	TokenTracker,
	type VectorStore,
} from "@frontdesk/ai";
import type { ChunkRepository, StoredChunk } from "@frontdesk/db";
import { createLogger } from "@frontdesk/logger";
import { send } from "./sse";

const log = createLogger("simple-rag");

export interface SimpleRagDeps {
	llm: Llm;
	embeddings: EmbeddingService;
	vectorStore: VectorStore;
	chunkRepository: ChunkRepository;
}

const SIMPLE_TOP_K = 5;

/**
 * One-shot RAG: embed the question once, pull top-k child chunks, use their
 * full parent chunks as context, and make a single LLM call. No classify /
 * rerank / compress / citation / reformulate — the naive baseline used to
 * measure how much input the graph pipeline actually saves.
 */
export async function streamSimpleAnswer(
	deps: SimpleRagDeps,
	question: string,
	tenantId: string,
	controller: ReadableStreamDefaultController,
) {
	const started = performance.now();
	const tracker = new TokenTracker();
	const onToken = (text: string) => {
		send(controller, { type: "assistant_delta", text });
	};

	const embedding = await deps.embeddings.embedQuery(question);

	const retrieveStarted = performance.now();
	const results = await deps.vectorStore.similaritySearch(
		embedding,
		SIMPLE_TOP_K,
		tenantId,
	);
	tracker.record(
		"retrieve",
		question.length,
		0,
		performance.now() - retrieveStarted,
	);

	const parentIds = [
		...new Set(
			results
				.map((r) => r.document.parentId)
				.filter((id): id is string => Boolean(id)),
		),
	];

	let parents: StoredChunk[] = [];
	if (parentIds.length > 0) {
		parents = await deps.chunkRepository.getByIds(parentIds);
	}

	let contextChunks: StoredChunk[];
	if (parents.length > 0) {
		contextChunks = parents;
	} else {
		const childIds = results.map((r) => r.document.id);
		contextChunks =
			childIds.length > 0 ? await deps.chunkRepository.getByIds(childIds) : [];
	}

	const context = formatContext(contextChunks);
	const byId = new Map(parents.map((p) => [p.id, p]));
	const sources = results.map((r) => {
		const parent = r.document.parentId
			? byId.get(r.document.parentId)
			: undefined;
		return {
			id: r.document.id,
			title: parent ? labelFor(parent) : (r.document.parentId ?? r.document.id),
			score: r.score,
		};
	});

	let totalChars = 0;
	for (const s of sources) {
		totalChars += s.title.length;
		send(controller, {
			type: "meta",
			source: s.title,
			chunkSize: 0,
			totalChars,
			score: s.score,
		});
	}

	const prompt = supportPrompt({ context, question });

	const generateStarted = performance.now();
	const stream = await deps.llm.stream(prompt);
	let answer = "";
	for await (const chunk of stream) {
		const text = chunk.content as string;
		if (text) {
			answer += text;
			onToken(text);
		}
	}
	tracker.record(
		"generate",
		prompt.length,
		answer.length,
		performance.now() - generateStarted,
	);

	const usage = tracker.summary();
	log.info(
		{
			event: "simple_rag_completed",
			tenantId,
			question,
			candidateChunks: results.length,
			contextChunks: contextChunks.length,
			contextChars: context.length,
			inputTokens: usage.totalInputTokens,
			outputTokens: usage.totalOutputTokens,
			durationMs: Math.round(performance.now() - started),
			usage,
		},
		"simple rag completed",
	);

	send(controller, { type: "done", usage });
}
