import type { RunnableConfig } from "@langchain/core/runnables";
import { z } from "zod";
import type { AgentGraphDeps } from "../deps";
import { reformulatePrompt } from "../prompts";
import type { AgentStateType } from "../state";
import { trackedCall } from "../track";

const ReformulateOutput = z.object({
	reformulatedQuery: z.string(),
	reason: z.string(),
});

export function createReformulateNode(deps: AgentGraphDeps) {
	const model = deps.llm.structured(ReformulateOutput);

	return async (state: AgentStateType, runtimeConfig?: RunnableConfig) => {
		const result = await trackedCall("reformulate", runtimeConfig, async () => {
			const prompt = reformulatePrompt({
				question: state.query,
				reason: state.contextReason,
				iteration: state.iteration + 1,
			});
			const result = await model.invoke(prompt);
			return {
				inputChars: prompt.length,
				outputChars: JSON.stringify(result).length,
				result,
			};
		});
		return {
			reformulatedQuery: result.reformulatedQuery,
			iteration: state.iteration + 1,
		};
	};
}
