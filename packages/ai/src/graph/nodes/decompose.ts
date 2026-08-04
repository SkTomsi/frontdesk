import type { AgentGraphDeps } from "../deps";
import type { AgentStateType } from "../state";

/**
 * Placeholder for multi-part decomposition (S2.3). For now it is a pass-through:
 * `classify` already stores sub-questions, and `retrieve` runs against the full
 * query. Fleshed out when per-sub-question retrieval lands.
 */
export function createDecomposeNode(_deps: AgentGraphDeps) {
	return async (_state: AgentStateType) => ({});
}
