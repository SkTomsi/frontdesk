import type { RunnableConfig } from "@langchain/core/runnables";
import { z } from "zod";
import type { AgentGraphDeps } from "../deps";
import { classifyPrompt } from "../prompts";
import type { AgentStateType, QueryType } from "../state";
import { trackedCall } from "../track";

const ClassifyOutput = z.object({
	queryType: z.enum(["simple_factual", "multi_part", "procedural"]),
	subQuestions: z.array(z.string()).optional(),
});

export function createClassifyNode(deps: AgentGraphDeps) {
	const model = deps.llm.structured(ClassifyOutput);

	return async (state: AgentStateType, runtimeConfig?: RunnableConfig) => {
		const result = await trackedCall("classify", runtimeConfig, async () => {
			const prompt = classifyPrompt({ question: state.query });
			const result = await model.invoke(prompt);
			return {
				inputChars: prompt.length,
				outputChars: JSON.stringify(result).length,
				result,
			};
		});
		return {
			queryType: result.queryType as QueryType,
			subQuestions: result.subQuestions ?? [],
		};
	};
}
