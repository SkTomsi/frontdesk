import { z } from "zod";

export const SupportAnswer = z.object({
	answer: z.string().describe("A direct answer to the user's question."),
	confidence: z.enum(["high", "medium", "low"]),
	citedSources: z
		.array(z.string())
		.describe("Doc titles or IDs the answer relied on."),
	needsHumanReview: z.boolean(),
});
export type SupportAnswer = z.infer<typeof SupportAnswer>;
