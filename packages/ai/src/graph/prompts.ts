import { config } from "../config";

export interface ClassifyInput {
	question: string;
}

export const classifyPrompt = ({ question }: ClassifyInput): string => `You are a query classifier for a support agent that answers from company documents.
Classify the question into exactly one type and return ONLY valid JSON.

Types:
- "simple_factual" — a single, direct factual question answerable from one piece of context.
- "multi_part" — a question with multiple independent sub-parts that need separate answers.
- "procedural" — a "how to" or step-by-step question.

QUESTION:
${question}

Respond with JSON like:
{"queryType": "simple_factual", "subQuestions": []}`;

export interface AssessCompressInput {
	question: string;
	context: string;
}

export const assessCompressPrompt = ({
	question,
	context,
}: AssessCompressInput): string => `You are assessing whether the context below can answer a question, and condensing it for a downstream answer generator.
Return ONLY valid JSON.

1. Rate how well the context covers the question from 0 to 10:
   - 8-10: fully answers the question.
   - 5-7: partially answers, some details missing.
   - 0-4: insufficient or irrelevant.
2. Produce "compressedContext": a condensed version of the context that keeps every fact needed to answer the question. Keep each source's label (e.g. "[Page 3]") attached to its text so the answer generator can cite it. Target ${config.CONTEXT_COMPRESSION_TARGET_TOKENS} tokens or less.
3. "reason": a short explanation of the score.

QUESTION:
${question}

CONTEXT:
${context}

Respond with JSON like:
{"contextScore": 7, "reason": "short explanation", "compressedContext": "condensed context with source labels"}`;

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

export interface RerankCandidate {
	id: string;
	score: number;
	snippet: string;
}

export interface RerankInput {
	question: string;
	candidates: RerankCandidate[];
}

export const rerankPrompt = ({ question, candidates }: RerankInput): string => `You are a retrieval reranker. Rank the candidate snippets by how relevant each is to answering the question.
Return ONLY valid JSON.

Rules:
- Return the top ${config.RERANK_TOP_K} most relevant candidate ids, most relevant first.
- Ignore candidates that are irrelevant to the question.
- Only use exact ids from the candidates list below.

QUESTION:
${question}

CANDIDATES:
${candidates.map((c) => `- id: ${c.id}\n  similarity: ${c.score.toFixed(3)}\n  snippet: ${c.snippet}`).join("\n")}

Respond with JSON like:
{"topIds": ["id1", "id2", "id3", "id4", "id5"]}`;

export interface CitationValidatorInput {
	answer: string;
	sources: string[];
}

export const citationValidatorPrompt = ({
	answer,
	sources,
}: CitationValidatorInput): string => `You are validating the sources used in a support answer.
The assistant answered using the source labels listed below. Return ONLY valid JSON.

- "citedSources": the exact source labels the answer actually drew from. Only include labels that exist in the list below. Empty array if none.
- "confidence": "high" | "medium" | "low" — how confident you are the answer is grounded in the sources.
- "needsHumanReview": true if the answer is unsupported, speculative, or the question is out of scope.
- "score": a number from 0.0 to 1.0 estimating how well the answer is grounded in the sources.

ANSWER:
${answer}

SOURCES:
${sources.map((s) => `- ${s}`).join("\n")}

Respond with JSON like:
{"citedSources": ["source title"], "confidence": "high", "needsHumanReview": false, "score": 0.9}`;
