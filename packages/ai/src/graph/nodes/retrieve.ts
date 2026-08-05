import type { RunnableConfig } from "@langchain/core/runnables";
import { config } from "../../config";
import type { AgentGraphDeps } from "../deps";
import type { AgentStateType } from "../state";
import { trackerFrom } from "../track";

/**
 * Retrieves candidates via vector similarity. For multi-part questions it
 * embeds and searches each sub-question and merges the results (best score
 * per chunk, capped). Candidate count is dynamic by query type.
 */
export function createRetrieveNode(deps: AgentGraphDeps) {
	return async (state: AgentStateType, runtimeConfig?: RunnableConfig) => {
		const tracker = trackerFrom(runtimeConfig);
		const topK =
			config.RETRIEVE_CANDIDATES[state.queryType] ??
			config.RETRIEVE_CANDIDATES.simple_factual;

		const queries =
			state.queryType === "multi_part" && state.subQuestions.length > 0
				? state.subQuestions
				: [state.reformulatedQuery ?? state.query];

		const merged = new Map<string, { score: number; parentId: string | null }>();

		for (const q of queries) {
			const started = performance.now();
			const embedding = await deps.embeddings.embedQuery(q);
			const results = await deps.vectorStore.similaritySearch(
				embedding,
				topK,
				state.tenantId,
			);
			tracker?.record("retrieve", q.length, 0, performance.now() - started);
			for (const r of results) {
				const existing = merged.get(r.document.id);
				if (!existing || r.score > existing.score) {
					merged.set(r.document.id, {
						score: r.score,
						parentId: r.document.parentId,
					});
				}
			}
		}

		const retrievedResults = [...merged.entries()]
			.map(([id, v]) => ({ id, score: v.score, parentId: v.parentId }))
			.sort((a, b) => b.score - a.score)
			.slice(0, config.MAX_MERGED_CANDIDATES);

		return { retrievedResults };
	};
}
