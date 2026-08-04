import { z } from "zod";
import type { AgentGraphDeps } from "../deps";
import { classifyPrompt } from "../prompts";
import type { AgentStateType, QueryType } from "../state";

const ClassifyOutput = z.object({
	queryType: z.enum(["simple_factual", "multi_part", "procedural"]),
	subQuestions: z.array(z.string()).optional(),
});

export function createClassifyNode(deps: AgentGraphDeps) {
	const model = deps.llm.structured(ClassifyOutput);

	return async (state: AgentStateType) => {
		const result = await model.invoke(
			classifyPrompt({ question: state.query }),
		);
		return {
			queryType: result.queryType as QueryType,
			subQuestions: result.subQuestions ?? [],
		};
	};
}
