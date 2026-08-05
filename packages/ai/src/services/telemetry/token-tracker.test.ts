import { describe, expect, test } from "bun:test";
import { TokenTracker } from "./token-tracker";

describe("TokenTracker", () => {
	test("estimates tokens at chars / 4 and aggregates per node", () => {
		const tracker = new TokenTracker();
		tracker.record("classify", 800, 40, 100);
		tracker.record("generate", 2000, 3200, 900);
		tracker.record("generate", 2000, 1600, 1100);

		const summary = tracker.summary();
		expect(summary.totalInputTokens).toBe(1200);
		expect(summary.totalOutputTokens).toBe(1210);
		expect(summary.nodes["generate"]).toEqual({
			node: "generate",
			inputTokens: 1000,
			outputTokens: 1200,
			durationMs: 2000,
			calls: 2,
		});
		expect(summary.nodes["classify"]!.calls).toBe(1);
	});
});
