import { END, StateGraph } from "@langchain/langgraph";
import type { AgentGraphDeps } from "./deps";
import { createAssessCompressNode } from "./nodes/assess-compress";
import { createCitationValidatorNode } from "./nodes/citation-validator";
import { createClassifyNode } from "./nodes/classify";
import { createDecomposeNode } from "./nodes/decompose";
import { createGenerateNode } from "./nodes/generate";
import { createParentFetchNode } from "./nodes/parent-fetch";
import { createReformulateNode } from "./nodes/reformulate";
import { createRerankNode } from "./nodes/rerank";
import { createRetrieveNode } from "./nodes/retrieve";
import { AgentState, type AgentStateType } from "./state";

export const CONTEXT_SCORE_THRESHOLD = 7;
export const MAX_REFORMULATE_ITERATIONS = 3;

export function classifyRouter(
	state: Pick<AgentStateType, "queryType">,
): string {
	return state.queryType === "multi_part" ? "decompose" : "retrieve";
}

export function assessRouter(
	state: Pick<AgentStateType, "contextScore" | "iteration">,
): string {
	if (state.contextScore >= CONTEXT_SCORE_THRESHOLD) return "generate";
	if (state.iteration < MAX_REFORMULATE_ITERATIONS) return "reformulate";
	return "generate";
}

export function buildAgentGraph(deps: AgentGraphDeps) {
	return new StateGraph(AgentState)
		.addNode("classify", createClassifyNode(deps))
		.addNode("decompose", createDecomposeNode(deps))
		.addNode("retrieve", createRetrieveNode(deps))
		.addNode("rerank", createRerankNode(deps))
		.addNode("parentFetch", createParentFetchNode(deps))
		.addNode("assessCompress", createAssessCompressNode(deps))
		.addNode("reformulate", createReformulateNode(deps))
		.addNode("generate", createGenerateNode(deps))
		.addNode("citationValidator", createCitationValidatorNode(deps))

		.addEdge("__start__", "classify")

		.addConditionalEdges("classify", classifyRouter)
		.addEdge("decompose", "retrieve")
		.addEdge("retrieve", "rerank")
		.addEdge("rerank", "parentFetch")
		.addEdge("parentFetch", "assessCompress")

		.addConditionalEdges("assessCompress", assessRouter)
		.addEdge("reformulate", "retrieve")
		.addEdge("generate", "citationValidator")
		.addEdge("citationValidator", END)

		.compile();
}
