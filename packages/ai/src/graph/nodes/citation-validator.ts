import type { RunnableConfig } from "@langchain/core/runnables";
import { z } from "zod";
import type { AgentGraphDeps } from "../deps";
import { citationValidatorPrompt } from "../prompts";
import type { AgentStateType } from "../state";
import { trackedCall } from "../track";

const CitationOutput = z.object({
	citedSources: z.array(z.string()),
	confidence: z.enum(["high", "medium", "low"]),
	needsHumanReview: z.boolean(),
	score: z.number().min(0).max(1),
});

/**
 * Small structured call that checks which of the available sources the answer
 * actually drew from, plus confidence and human-review flags. Replaces the
 * client-side title string-match for citations.
 */
export function createCitationValidatorNode(deps: AgentGraphDeps) {
	const model = deps.llm.structured(CitationOutput);

	return async (state: AgentStateType, runtimeConfig?: RunnableConfig) => {
		const titles = (state.sources ?? []).map((s) => s.title);
		const result = await trackedCall("citationValidator", runtimeConfig, async () => {
			const prompt = citationValidatorPrompt({
				answer: state.finalAnswer ?? "",
				sources: titles,
			});
			const result = await model.invoke(prompt);
			return {
				inputChars: prompt.length,
				outputChars: JSON.stringify(result).length,
				result,
			};
		});
		return {
			citedSources: result.citedSources,
			confidence: result.confidence,
			needsHumanReview: result.needsHumanReview,
		};
	};
}
