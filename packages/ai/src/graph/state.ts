import { Annotation } from "@langchain/langgraph";
import type { BaseMessage } from "@langchain/core/messages";
import type { StoredChunk } from "@frontdesk/db";
import type { SearchResult } from "../services/vector-store";

export const QueryType = {
	simple_factual: "simple_factual",
	multi_part: "multi_part",
	procedural: "procedural",
} as const;

export type QueryType = keyof typeof QueryType;

export const AgentState = Annotation.Root({
	query: Annotation<string>,
	tenantId: Annotation<string>,
	queryType: Annotation<QueryType>,
	subQuestions: Annotation<string[]>,
	reformulatedQuery: Annotation<string | null>,
	iteration: Annotation<number>({
		reducer: (_prev, next) => next,
		default: () => 0,
	}),

	retrievedChunks: Annotation<SearchResult[]>,
	parentChunks: Annotation<StoredChunk[]>,
	contextScore: Annotation<number>,
	contextReason: Annotation<string>,

	finalAnswer: Annotation<string>,
	needsHumanReview: Annotation<boolean>,

	messages: Annotation<BaseMessage[]>({
		reducer: (left, right) => left.concat(right),
		default: () => [],
	}),
});

export type AgentStateType = typeof AgentState.State;
