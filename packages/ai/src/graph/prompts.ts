export interface ClassifyInput {
	question: string;
}

export const classifyPrompt = ({ question }: ClassifyInput): string => `You are a query classifier for a support agent that answers questions from company documents.
Classify the question into exactly one type and return ONLY valid JSON.

Types:
- "simple_factual" — a single, direct factual question answerable from one piece of context.
- "multi_part" — a question with multiple independent sub-parts that need separate answers.
- "procedural" — a "how to" or step-by-step question.

QUESTION:
${question}

Respond with JSON like:
{"queryType": "simple_factual", "subQuestions": []}`;

export interface AssessInput {
	question: string;
	context: string;
}

export const assessPrompt = ({
	question,
	context,
}: AssessInput): string => `You are assessing whether retrieved context can answer a question.
Rate how well the context below covers the question on a scale of 0 to 10.
Return ONLY valid JSON.

- 8-10: fully answers the question.
- 5-7: partially answers, some details missing.
- 0-4: insufficient or irrelevant.

QUESTION:
${question}

CONTEXT:
${context}

Respond with JSON like:
{"contextScore": 7, "reason": "short explanation"}`;

export interface ReformulateInput {
	question: string;
	reason: string;
	iteration: number;
}

export const reformulatePrompt = ({
	question,
	reason,
	iteration,
}: ReformulateInput): string => `You are reformulating a user question to improve retrieval against company documents.
The previous retrieval failed to find sufficient context. Rewrite the question to be more specific,
use keywords likely present in the documents, and clarify ambiguity. Keep it a single question.
Return ONLY valid JSON.

Original question:
${question}

Why the previous attempt was insufficient:
${reason}

Attempt number: ${iteration}

Respond with JSON like:
{"reformulatedQuery": "rewritten question", "reason": "what changed and why"}`;
