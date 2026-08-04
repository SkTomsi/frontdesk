import { describe, expect, test } from "bun:test";
import { assessRouter, classifyRouter } from "./graph";

describe("classifyRouter", () => {
	test("routes multi_part to decompose", () => {
		expect(classifyRouter({ queryType: "multi_part" })).toBe("decompose");
	});

	test("routes simple_factual to retrieve", () => {
		expect(classifyRouter({ queryType: "simple_factual" })).toBe("retrieve");
	});

	test("routes procedural to retrieve", () => {
		expect(classifyRouter({ queryType: "procedural" })).toBe("retrieve");
	});
});

describe("assessRouter", () => {
	test("generates when context is sufficient", () => {
		expect(assessRouter({ contextScore: 7, iteration: 0 })).toBe("generate");
		expect(assessRouter({ contextScore: 9, iteration: 2 })).toBe("generate");
	});

	test("reformulates while under max iterations", () => {
		expect(assessRouter({ contextScore: 3, iteration: 0 })).toBe("reformulate");
		expect(assessRouter({ contextScore: 6, iteration: 2 })).toBe("reformulate");
	});

	test("generates best-effort after max iterations", () => {
		expect(assessRouter({ contextScore: 2, iteration: 3 })).toBe("generate");
		expect(assessRouter({ contextScore: 0, iteration: 4 })).toBe("generate");
	});
});
