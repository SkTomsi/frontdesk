import type { AgentGraphDeps } from "../deps";
import type { AgentStateType } from "../state";

/**
 * Entry point for multi-part questions. `classify` already populated
 * `subQuestions`; `retrieve` fans out per sub-question and merges the results,
 * so this node just signals the path transition.
 */
export function createDecomposeNode(_deps: AgentGraphDeps) {
	return async (_state: AgentStateType) => ({});
}
