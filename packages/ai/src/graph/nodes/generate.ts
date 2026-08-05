import type { RunnableConfig } from "@langchain/core/runnables";
import { config } from "../../config";
import { supportPrompt } from "../../prompts";
import { fetchChunksByIds, formatContext } from "../context";
import type { AgentGraphDeps } from "../deps";
import type { AgentStateType } from "../state";
import { trackerFrom } from "../track";

/** Safety floor: never feed generate more than the compression budget. */
function capContext(context: string): string {
	const maxChars = config.CONTEXT_COMPRESSION_TARGET_TOKENS * 4;
	return context.length > maxChars ? context.slice(0, maxChars) : context;
}

export function createGenerateNode(deps: AgentGraphDeps) {
	return async (state: AgentStateType, runtimeConfig?: RunnableConfig) => {
		const onToken = runtimeConfig?.configurable?.onToken as
			| ((text: string) => void)
			| undefined;
		const tracker = trackerFrom(runtimeConfig);

		let context = state.compressedContext ?? "";
		if (!context) {
			const chunks = await fetchChunksByIds(deps, state.parentChunkIds ?? []);
			context = formatContext(chunks);
		}
		context = capContext(context);

		const prompt = supportPrompt({
			context,
			question: state.query,
		});

		const started = performance.now();
		const stream = await deps.llm.stream(prompt);
		let answer = "";
		for await (const chunk of stream) {
			const text = chunk.content as string;
			if (text) {
				answer += text;
				onToken?.(text);
			}
		}
		tracker?.record("generate", prompt.length, answer.length, performance.now() - started);

		return { finalAnswer: answer };
	};
}
