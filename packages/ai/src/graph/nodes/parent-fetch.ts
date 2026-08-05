import type { StoredChunk } from "@frontdesk/db";
import type { RunnableConfig } from "@langchain/core/runnables";
import { labelFor } from "../context";
import type { AgentGraphDeps } from "../deps";
import type { AgentStateType, SourceRef } from "../state";
import { trackerFrom } from "../track";

/**
 * Maps the top child chunks to their parent chunks (full context for the
 * answer). Only chunk ids travel in state; content is fetched on demand by
 * the nodes that need it.
 */
export function createParentFetchNode(deps: AgentGraphDeps) {
	return async (state: AgentStateType, runtimeConfig?: RunnableConfig) => {
		const started = performance.now();
		const children = state.retrievedResults ?? [];
		const parentIds = [
			...new Set(
				children
					.map((c) => c.parentId)
					.filter((id): id is string => Boolean(id)),
			),
		];

		let parents: StoredChunk[] = [];
		if (parentIds.length > 0) {
			parents = await deps.chunkRepository.getByIds(parentIds);
		}

		const parentChunkIds =
			parents.length > 0 ? parentIds : children.map((c) => c.id);
		const byId = new Map(parents.map((p) => [p.id, p]));

		const sources: SourceRef[] = children.map((c) => {
			const parent = c.parentId ? byId.get(c.parentId) : undefined;
			return {
				id: c.id,
				title: parent ? labelFor(parent) : c.parentId ?? c.id,
				score: c.score,
			};
		});

		trackerFrom(runtimeConfig)?.record(
			"parentFetch",
			0,
			0,
			performance.now() - started,
		);
		return { parentChunkIds, sources };
	};
}
