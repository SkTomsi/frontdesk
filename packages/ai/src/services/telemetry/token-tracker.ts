export interface NodeUsage {
	node: string;
	inputTokens: number;
	outputTokens: number;
	durationMs: number;
	calls: number;
}

export interface UsageSummary {
	totalInputTokens: number;
	totalOutputTokens: number;
	totalDurationMs: number;
	nodes: Record<string, NodeUsage>;
}

const CHARS_PER_TOKEN = 4;

/**
 * Per-request LLM usage accounting. Nodes record the character sizes of the
 * prompts they send and the outputs they receive; tokens are estimated at
 * chars / 4 so every node is measured consistently and we can compute
 * optimization % per phase without depending on provider usage reporting.
 */
export class TokenTracker {
	private nodes = new Map<string, NodeUsage>();
	private startedAt = performance.now();

	record(node: string, inputChars: number, outputChars: number, durationMs: number): void {
		const prev =
			this.nodes.get(node) ??
			({ node, inputTokens: 0, outputTokens: 0, durationMs: 0, calls: 0 } satisfies NodeUsage);
		this.nodes.set(node, {
			node,
			inputTokens: prev.inputTokens + Math.round(inputChars / CHARS_PER_TOKEN),
			outputTokens: prev.outputTokens + Math.round(outputChars / CHARS_PER_TOKEN),
			durationMs: Math.round(prev.durationMs + durationMs),
			calls: prev.calls + 1,
		});
	}

	summary(): UsageSummary {
		let totalInputTokens = 0;
		let totalOutputTokens = 0;
		for (const n of this.nodes.values()) {
			totalInputTokens += n.inputTokens;
			totalOutputTokens += n.outputTokens;
		}
		return {
			totalInputTokens,
			totalOutputTokens,
			totalDurationMs: Math.round(performance.now() - this.startedAt),
			nodes: Object.fromEntries(this.nodes),
		};
	}
}
