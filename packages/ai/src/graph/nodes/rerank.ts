import type { RunnableConfig } from "@langchain/core/runnables";
import { z } from "zod";
import { config } from "../../config";
import { fetchChunksByIds } from "../context";
import type { AgentGraphDeps } from "../deps";
import { rerankPrompt } from "../prompts";
import type { AgentStateType } from "../state";
import { trackedCall } from "../track";

const RerankOutput = z.object({
	topIds: z.array(z.string()),
});

/**
 * LLM-as-reranker: scores the candidate child chunks against the question and
 * keeps the top RERANK_TOP_K. Falls back to vector score order when the model
 * returns an unusable ranking.
 */
export function createRerankNode(deps: AgentGraphDeps) {
	const model = deps.llm.structured(RerankOutput);

	return async (state: AgentStateType, runtimeConfig?: RunnableConfig) => {
		const candidates = state.retrievedResults ?? [];
		if (candidates.length <= config.RERANK_TOP_K) {
			return { retrievedResults: candidates };
		}

		const result = await trackedCall("rerank", runtimeConfig, async () => {
			const chunks = await fetchChunksByIds(
				deps,
				candidates.map((c) => c.id),
			);
			const byId = new Map(chunks.map((c) => [c.id, c]));
			const items = candidates.map((c) => ({
				id: c.id,
				score: c.score,
				snippet: (byId.get(c.id)?.content ?? "").slice(
					0,
					config.RERANK_SNIPPET_CHARS,
				),
			}));
			const prompt = rerankPrompt({
				question: state.query,
				candidates: items,
			});
			const result = await model.invoke(prompt);
			return {
				inputChars: prompt.length,
				outputChars: JSON.stringify(result).length,
				result,
			};
		});

		const selected = new Set(result.topIds ?? []);
		const top = candidates.filter((c) => selected.has(c.id));
		const seen = new Set(top.map((t) => t.id));
		for (const c of candidates) {
			if (top.length >= config.RERANK_TOP_K) break;
			if (!seen.has(c.id)) top.push(c);
		}
		return { retrievedResults: top.slice(0, config.RERANK_TOP_K) };
	};
}
