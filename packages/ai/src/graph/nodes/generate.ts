import type { RunnableConfig } from "@langchain/core/runnables";
import { supportPrompt } from "../../prompts";
import type { AgentGraphDeps } from "../deps";
import type { AgentStateType } from "../state";

export function createGenerateNode(deps: AgentGraphDeps) {
	return async (state: AgentStateType, config?: RunnableConfig) => {
		const onToken = config?.configurable?.onToken as
			| ((text: string) => void)
			| undefined;

		const context = state.parentChunks
			.map((chunk) => {
				const label =
					(chunk.metadata.title as string) ||
					(chunk.pageNum != null ? `Page ${chunk.pageNum}` : chunk.id);
				return `[${label}]\n${chunk.content}`;
			})
			.join("\n\n");

		const prompt = supportPrompt({
			context,
			question: state.query,
		});

		const stream = await deps.llm.stream(prompt);
		let answer = "";
		for await (const chunk of stream) {
			const text = chunk.content as string;
			if (text) {
				answer += text;
				onToken?.(text);
			}
		}

		return { finalAnswer: answer };
	};
}
