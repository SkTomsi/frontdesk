import { z } from "zod";
import type { AgentGraphDeps } from "../deps";
import { assessPrompt } from "../prompts";
import type { AgentStateType } from "../state";

const AssessOutput = z.object({
	contextScore: z.number().min(0).max(10),
	reason: z.string(),
});

export function createAssessNode(deps: AgentGraphDeps) {
	const model = deps.llm.structured(AssessOutput);

	return async (state: AgentStateType) => {
		const context = state.parentChunks.map((c) => c.content).join("\n\n");
		const result = await model.invoke(
			assessPrompt({ question: state.query, context }),
		);
		return {
			contextScore: result.contextScore,
			contextReason: result.reason,
		};
	};
}
