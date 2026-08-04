import { z } from "zod";
import type { AgentGraphDeps } from "../deps";
import { reformulatePrompt } from "../prompts";
import type { AgentStateType } from "../state";

const ReformulateOutput = z.object({
	reformulatedQuery: z.string(),
	reason: z.string(),
});

export function createReformulateNode(deps: AgentGraphDeps) {
	const model = deps.llm.structured(ReformulateOutput);

	return async (state: AgentStateType) => {
		const result = await model.invoke(
			reformulatePrompt({
				question: state.query,
				reason: state.contextReason,
				iteration: state.iteration + 1,
			}),
		);
		return {
			reformulatedQuery: result.reformulatedQuery,
			iteration: state.iteration + 1,
		};
	};
}
