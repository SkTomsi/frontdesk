import type { AgentGraphDeps } from "../deps";
import type { AgentStateType } from "../state";

export function createParentFetchNode(deps: AgentGraphDeps) {
	return async (state: AgentStateType) => {
		const parentIds = [
			...new Set(
				state.retrievedChunks
					.map((r) => r.document.parentId)
					.filter((id): id is string => Boolean(id)),
			),
		];

		const parents = await deps.chunkRepository.getParentsByIds(parentIds);
		const parentChunks =
			parents.length > 0
				? parents
				: state.retrievedChunks.map((r) => r.document);

		return { parentChunks };
	};
}
