export interface PromptVariables {
	context: string;
	question: string;
}

export const supportPrompt = ({
	context,
	question,
}: PromptVariables): string => `You are Northwind support. Answer using ONLY the context below.
If the context doesn't cover the question, say so and set needsHumanReview true.

CONTEXT:
${context}

QUESTION:
${question}`;
