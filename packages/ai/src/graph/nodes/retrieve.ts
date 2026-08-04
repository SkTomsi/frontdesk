import type { AgentGraphDeps } from "../deps";
import type { AgentStateType } from "../state";

const TOP_K = 8;

export function createRetrieveNode(deps: AgentGraphDeps) {
	return async (state: AgentStateType) => {
		const query = state.reformulatedQuery ?? state.query;
		const embedding = await deps.embeddings.embedQuery(query);
		const results = await deps.vectorStore.similaritySearch(
			embedding,
			TOP_K,
			state.tenantId,
		);
		return { retrievedChunks: results };
	};
}
