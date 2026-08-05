import type { RunnableConfig } from "@langchain/core/runnables";
import { z } from "zod";
import { fetchChunksByIds, formatContext } from "../context";
import type { AgentGraphDeps } from "../deps";
import { assessCompressPrompt } from "../prompts";
import type { AgentStateType } from "../state";
import { trackedCall } from "../track";

const AssessCompressOutput = z.object({
	contextScore: z.number().min(0).max(10),
	reason: z.string(),
	compressedContext: z.string(),
});

/**
 * Scores whether the retrieved parents answer the question AND compresses them
 * into a compact context (source labels preserved) in a single LLM call. The
 * answer generator then reads the compressed context instead of raw parents.
 */
export function createAssessCompressNode(deps: AgentGraphDeps) {
	const model = deps.llm.structured(AssessCompressOutput);

	return async (state: AgentStateType, runtimeConfig?: RunnableConfig) => {
		const result = await trackedCall("assessCompress", runtimeConfig, async () => {
			const chunks = await fetchChunksByIds(deps, state.parentChunkIds ?? []);
			const context = formatContext(chunks);
			const prompt = assessCompressPrompt({
				question: state.query,
				context,
			});
			const result = await model.invoke(prompt);
			return {
				inputChars: prompt.length,
				outputChars: JSON.stringify(result).length,
				result,
			};
		});
		return {
			contextScore: result.contextScore,
			contextReason: result.reason,
			compressedContext: result.compressedContext,
		};
	};
}
