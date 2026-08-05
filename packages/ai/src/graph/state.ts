import { Annotation } from "@langchain/langgraph";

export const QueryType = {
	simple_factual: "simple_factual",
	multi_part: "multi_part",
	procedural: "procedural",
} as const;

export type QueryType = keyof typeof QueryType;

/** Lightweight retrieval hit — no chunk content travels through graph state. */
export interface RetrievedResult {
	id: string;
	score: number;
	parentId: string | null;
}

export interface SourceRef {
	id: string;
	title: string;
	score: number;
}

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

	retrievedResults: Annotation<RetrievedResult[]>,
	parentChunkIds: Annotation<string[]>,
	sources: Annotation<SourceRef[]>,
	compressedContext: Annotation<string | null>,
	contextScore: Annotation<number>,
	contextReason: Annotation<string>,

	finalAnswer: Annotation<string>,
	citedSources: Annotation<string[]>,
	confidence: Annotation<string>,
	needsHumanReview: Annotation<boolean>,
});

export type AgentStateType = typeof AgentState.State;
