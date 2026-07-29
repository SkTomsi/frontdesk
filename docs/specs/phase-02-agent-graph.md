# Phase 02 — Agent Graph

## Problem Statement

The current RAG pipeline is single-shot: embed question → retrieve top-K chunks → answer. This fails for multi-topic questions that need separate retrievals, and has no conversation memory — each question is answered in isolation with no awareness of prior exchanges.

## Solution

Replace the single-shot pipeline with a LangGraph-based agent that maintains a persistent state across turns. The agent detects question complexity, dispatches parallel retrievals for multi-topic questions, deduplicates results, and accumulates context across conversation turns.

## User Stories

1. As a user, I want to ask a multi-topic question (e.g. "How do I export to PDF and what are the team limits?"), so that both topics are answered in a single response.
2. As a user, I want the agent to detect when my question is simple and skip unnecessary parallelism, so that I get fast responses for straightforward queries.
3. As a user, I want the agent to remember our previous exchanges, so that I can ask follow-up questions without repeating context.
4. As a user, I want to see which sources the agent used and their similarity scores, so that I can assess answer reliability.
5. As a user, I want the agent to proceed with partial results if one retrieval fails, so that I still get an answer even during transient failures.
6. As a developer, I want the number of parallel queries to be configurable per bot, so that I can tune latency vs. coverage.
7. As a developer, I want a single integration test that exercises the full graph, so that I can validate changes without manual REPL testing.

## Implementation Decisions

### Agent State

```ts
interface AgentState {
  messages: BaseMessage[];         // full conversation history
  queries: string[];               // sub-queries generated for the current turn
  context: StoredDocument[];       // accumulated retrieved chunks (deduplicated)
  reasoning: string;               // agent's reasoning chain for the current turn
  answer: SupportAnswer | null;    // final answer once the graph terminates
}
```

### Graph Structure

```
User input → detectComplexity ──simple──→ retrieve (single query) → reason → answer
                              └─complex─→ generateQueries (N) → parallelRetrieve (N) → deduplicate → merge → reason → answer
```

### Nodes

1. **detectComplexity** — Given the latest user message and conversation history, decide whether the question is simple (one topic) or complex (multiple topics). A simple question fires a single retrieval. A complex question triggers sub-query generation.

2. **generateQueries** — Given a complex question, generate N sub-queries (default: 2) that each target a distinct aspect of the question. Output: `queries[]`.

3. **retrieve** — Embed a single query string and run `similaritySearch` against pgvector. Output: appended to `context[]`.

4. **parallelRetrieve** — Fire N `retrieve` calls concurrently. Each call is independent. If one fails, proceed with partial results from successful calls. Failed queries are logged for background retry (retry not implemented in this phase — logged only).

5. **deduplicate** — Filter `context[]` to unique chunks by `id`. First occurrence wins.

6. **reason** — Given accumulated context, conversation history, and the user question, produce a reasoning string. No answer yet — this is the agent's internal monologue before generating the final answer.

7. **answer** — Given context, reasoning, history, and question, produce a `SupportAnswer` via the structured output LLM. This is the terminal node.

### Edge Conditions

- **Simple question**: `detectComplexity` routes directly to `retrieve` (single), skipping `generateQueries` and `parallelRetrieve`. The single `retrieve` uses the original user question as the query.
- **All retrievals fail**: `parallelRetrieve` returns empty context. The `answer` node still runs — the prompt instructs the LLM to set `needsHumanReview: true` when context is insufficient.
- **Empty context after deduplication**: Same as above — proceed to answer with no context.
- **First turn vs. follow-up**: On first turn, `messages` contains only the user message. On follow-ups, previous turns' messages are included. The agent can refer to prior context.

### Conversation Memory

Messages accumulate in `AgentState.messages`. The last N messages (configurable, default: 10) are included in prompts. No summarization or sliding window in this phase.

### Prompt Changes

The single-shot `supportPrompt` is replaced by multiple prompts (one per node). Each prompt receives only the relevant slice of state:

- **detectComplexity prompt**: Given question + history, classify as simple or complex.
- **generateQueries prompt**: Given question, output N sub-queries as a JSON array of strings.
- **reason prompt**: Given context + question + history, produce reasoning.
- **answer prompt**: Given context + reasoning + question + history, produce `SupportAnswer`. Similar to the existing `supportPrompt` but includes reasoning as additional signal.

### Config Changes

Add to `config.ts`:
```
PARALLEL_QUERIES: number  (default: 2)
MAX_HISTORY: number       (default: 10)
```

### Dependency Changes

Add `@langchain/langgraph` to `package.json`. No other new external dependencies.

### Graph Location

The graph lives in `src/graph/agent.ts`. Node implementations live in `src/graph/nodes/*.ts`. The graph exports a compiled `CompiledStateGraph` that is invoked from `src/index.ts` in place of the current `answerQuestion` function.

## Testing Decisions

**What makes a good test**: Tests should exercise the graph's external contract — given a question and optional history, produce an answer with sources. They should NOT test LangGraph's internal routing logic (that's LangGraph's job). Pure functions (deduplicate, detectComplexity output parsing) are good candidates for unit tests since they have no dependencies.

**Seams**:
1. **Graph integration test** (highest seam) — Build a test graph with mocked LLM (returns deterministic responses) and an in-memory vector store with seeded documents. Call `graph.invoke({ messages: [userMessage] })` and assert the final state contains a valid `SupportAnswer` with cited sources. This is the single seam that covers the full flow.
2. **Deduplicate unit test** — Test that `deduplicate` removes chunks with matching IDs and keeps the first occurrence. Pure function, trivial to test.

**No existing test files** exist in the codebase. This phase introduces the first tests. Use `bun test` (built-in, no runner dependency needed).

**Mocking strategy**:
- LLM: Wrap `Llm` in an interface that can be swapped for a deterministic mock that returns predefined JSON matching the `SupportAnswer` schema.
- Vector store: Use the existing `VectorStore` interface. For tests, either seed the real database and clean up, or introduce a lightweight interface swap. Prefer the interface swap — define an `Embedder` interface (embed query → number[]) and a `Retriever` interface (query embedding → SearchResult[]) that both the real and mock implementations satisfy.

## Out of Scope

- Reflection loop (agent self-correcting its answer) — deferred to a sub-phase.
- Streaming responses — deferred.
- Token usage tracking — deferred.
- Background retry of failed parallel retrievals — logged but not implemented.
- Conversation summarization for long histories — simple truncation to N messages only.
- Multi-bot workspace support (Phase 05 concern).
- Document upload UI (Phase 01 enhancement, separate from graph work).

## Further Notes

- The graph replaces `answerQuestion` in `src/index.ts`. The REPL UI and document ingestion remain unchanged.
- The existing `VectorStore` and `EmbeddingService` classes are unchanged. They satisfy the `Retriever` and `Embedder` interfaces respectively.
- `@langchain/langgraph` v2 is the target (latest stable as of July 2026). The graph uses `StateGraph` with `MessageGraph` for the conversation channel.
- Node prompts are co-located with their node implementation files, not in `prompts.ts`, to keep prompt iteration close to the logic that uses them.
