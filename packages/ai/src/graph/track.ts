import type { RunnableConfig } from "@langchain/core/runnables";
import type { TokenTracker } from "../services/telemetry/token-tracker";

export function trackerFrom(config?: RunnableConfig): TokenTracker | undefined {
	return config?.configurable?.tokenTracker as TokenTracker | undefined;
}

export interface TrackedResult<T> {
	inputChars: number;
	outputChars: number;
	result: T;
}

/** Runs an LLM call and records its estimated token usage on the request tracker. */
export async function trackedCall<T>(
	node: string,
	config: RunnableConfig | undefined,
	fn: () => Promise<TrackedResult<T>>,
): Promise<T> {
	const started = performance.now();
	const { inputChars, outputChars, result } = await fn();
	trackerFrom(config)?.record(node, inputChars, outputChars, performance.now() - started);
	return result;
}
