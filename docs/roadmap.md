# Roadmap

A self-hostable SaaS where users ingest their company docs and deploy intelligent support agents across chat platforms.

> **Status:** Phase 01 (RAG Foundation) shipped · Phase 02 (Agent Graph) in progress
> **Architecture reference:** [`docs/build-guide.html`](build-guide.html) — the 8-node agent graph spec
> **Stack:** Bun workspace (`apps/{api,worker,frontend}`, `packages/{ai,db,ingest,queue,storage,logger}`) · pgvector (TimescaleDB pg16) · Cloudflare R2 · BullMQ/Redis · Groq (`openai/gpt-oss-120b`) + Google Gemini embeddings

---

## Phase 01 — RAG Foundation *(current)*

A self-hostable, **distributed** RAG pipeline. PDFs are uploaded through a web UI, stored in Cloudflare R2, and processed asynchronously by a separate BullMQ worker that parses, hierarchically chunks, and embeds them into PostgreSQL/pgvector. When a user asks a question, the system retrieves the most relevant tenant-scoped chunks and feeds parent context to an LLM, which streams an answer with cited sources. Documents can be listed, monitored by status, and deleted.

**Todo:**
- [x] Document ingestion and chunking with LangChain text splitters
- [x] Hierarchical chunking (embedded children matched; parents used as answer context)
- [x] Embedding generation with Google Gemini (`gemini-embedding-001`, 1536-dim)
- [x] PostgreSQL-backed vector store with pgvector via Drizzle ORM
- [x] Structured LLM output with Zod schemas — `SupportAnswer` defined in `packages/ai/src/schemas.ts`, pending wiring into generation
- [x] Prompt templates separated from logic
- [x] Retry with exponential backoff on embedding API
- [x] Docker Compose for database (TimescaleDB with pgvector)
- [x] Drizzle ORM for type-safe database access
- [x] **PDF ingestion pipeline** — upload → R2 → BullMQ queue → worker → parse → chunk → embed → upsert → status polling
- [x] **Cloudflare R2 object storage** for source files
- [x] **Document management workflow** — list, status, and hard delete (chunks + R2 object)
- [x] **Deduplication** by content hash (per tenant) and **retry-after-failure** re-ingest
- [x] **Tenant scoping** via `X-Tenant-ID` header at every layer
- [x] **Document management UI** (upload, list, status polling, delete)
- [x] **Structured logging** (pino: colorized dev output, JSON in prod)
- [ ] Multi-format ingestion (Markdown, HTML, Notion/Confluence export) — only PDF so far
- [ ] Embedding model configuration per workspace
- [ ] Vector index tuning for performance at scale
- [ ] Upload guards (size/page limits) and dedup race hardening

**Concepts:** RAG, vector embeddings, cosine similarity, hierarchical chunking, structured output, prompt engineering, pgvector, Drizzle ORM, BullMQ, Redis, distributed workers, object storage, tenant isolation

---

## Phase 02 — Agent Graph *(current)*

Move from single-shot retrieval to a multi-step reasoning agent. Per the architecture in [`docs/build-guide.html`](build-guide.html) (§09), the query path runs through a **LangGraph** state machine: `classify → (decompose) → retrieve → parentFetch → assess → reformulate-loop → generate → (faithfulness)`. The agent plans its approach, retrieves context, reflects on whether the context is sufficient, and self-corrects by reformulating before answering. Implemented in `packages/ai/src/graph/` (state, prompts, nodes, graph).

**Todo:**
- [x] Streaming responses for real-time UX — SSE (`assistant_delta` / `meta` / `done`), now re-plumbed through the graph via a config-passed `onToken` callback (S2.1)
- [x] Define agent state schema — LangGraph `AgentState` (query, tenantId, queryType, iteration, retrievedChunks, parentChunks, contextScore/reason, finalAnswer, messages) (S2.1)
- [x] Build LangGraph graph — linear `classify → retrieve → parentFetch → generate` skeleton replacing the inline `streamAnswer` path (S2.1)
- [x] Add reflection loop — `assess` node (contextScore 0–10) routing `≥ 7 → generate`, else `reformulate → retrieve` up to 3 iterations; replaces the hard 0.7 similarity gate (S2.2)
- [ ] Multi-part decomposition — `decompose` node retrieves per sub-question (S2.3; node is a pass-through stub)
- [ ] Conversation memory for multi-turn support — `messages` reducer in state, history into the generate prompt (S2.4)
- [ ] Fallback to human escalation on low confidence — `needsHumanReview` flag after max iterations (S2.5)
- [ ] Token usage tracking per conversation turn (S2.6)
- [ ] Hybrid retrieval (dense + sparse/BM25, RRF fusion) — needs `pg_search`/ParadeDB or Qdrant
- [ ] Local reranker — BGE-Reranker-v2-M3 via `@huggingface/transformers` (ONNX) (build-guide §11)
- [ ] Redis semantic cache — embed query, cosine ≥ 0.88, TTL 24h (build-guide §10)
- [ ] Faithfulness check node + eval dataset + Langfuse tracing — see Phase 07 / build-guide Phase 2 (§12–13)
- [ ] Document versioning — soft-delete on re-ingest, version history table

**Concepts:** LangGraph, state machines, ReAct pattern, reflection, multi-hop reasoning, conversation memory, streaming

---

## Phase 03 — Tool Calling & MCP

Give agents the ability to take actions beyond retrieval. Tools let the agent look up live data from APIs, query databases, search the web, or access internal wikis. MCP (Model Context Protocol) provides a standardized way to connect to external data sources and services, making integrations pluggable and portable across deployments.

**Todo:**
- [ ] Define tool interface and registry
- [ ] Implement core tools: API lookup, database query, web search
- [ ] MCP client for connecting to external data sources
- [ ] Agent decides when to call tools vs. answer from context
- [ ] Tool result injection into prompt context
- [ ] Tool execution sandboxing and timeout handling
- [ ] Tool usage analytics and cost tracking

**Concepts:** Function calling, tool use, MCP protocol, API integration, sandboxed execution, dynamic context assembly

---

## Phase 04 — Triage & Routing

Classify incoming messages by intent, urgency, and domain before the agent processes them. Routine questions get auto-answered instantly, complex or sensitive ones escalate to human agents, and domain-specific queries route to specialized agents with tailored tools and knowledge. This reduces latency for simple cases and ensures expertise for hard ones.

**Todo:**
- [ ] Intent classifier (question, complaint, feature request, billing, etc.)
- [ ] Urgency scorer (low, medium, high, critical)
- [ ] Routing rules engine — map intent + urgency to agent or human queue
- [ ] Specialized agent configs (billing agent, technical agent, etc.)
- [ ] Escalation pipeline with handoff context
- [ ] Fallback agent for unmatched intents
- [ ] A/B testing for routing rules

**Concepts:** Intent classification, priority scoring, routing rules, agent specialization, escalation pipelines, handoff protocols

---

## Phase 05 — Multi-Tenant & Auth

Each organization gets its own isolated workspace with independent document ingestion, agent configuration, and vector storage. Users authenticate, manage API keys, invite team members, and control access levels. Tenant isolation ensures one customer's data never leaks into another's retrieval context.

**Todo:**
- [ ] User authentication (email/password, OAuth, SSO)
- [ ] Organization and workspace management
- [ ] Per-tenant vector store isolation (schema-per-tenant or row-level security)
- [ ] API key generation and rotation
- [ ] Role-based access control (owner, admin, member, viewer)
- [ ] Usage quotas and billing integration
- [ ] Audit logging for compliance
- [ ] Invite flow with role assignment

**Concepts:** Multi-tenancy, RBAC, OAuth2, SSO, data isolation, API key management, audit trails

---

## Phase 06 — Chat Platform Integrations

Deploy agents where users already communicate. Each integration handles platform-specific message formatting, threading, file attachments, and rate limits. The agent appears as a native participant in the conversation, responding in context and maintaining thread continuity.

**Todo:**
- [ ] Slack bot integration (channels, threads, app mentions)
- [ ] Discord bot integration (servers, threads, embeds)
- [ ] WhatsApp Business API integration
- [ ] Telegram bot integration
- [ ] Intercom / Zendesk widget integration
- [ ] Web chat widget (embeddable iframe)
- [ ] Unified message adapter interface across platforms
- [ ] Platform-specific rate limit handling
- [ ] File and media upload handling per platform

**Concepts:** Webhooks, OAuth bot tokens, message adapters, platform APIs, threading models, real-time messaging

---

## Phase 07 — Evaluation & Analytics

Measure and improve agent quality systematically. Automated evaluation pipelines score answers on precision, recall, hallucination rate, and response time. Dashboards track resolution rates, user satisfaction, and escalation patterns. A/B testing lets you compare prompt versions and model configurations with real traffic.

**Todo:**
- [ ] Eval dataset builder — create ground-truth Q&A pairs from docs
- [ ] Automated scoring: precision, recall, faithfulness, hallucination
- [ ] Response time and latency tracking
- [ ] Resolution rate and escalation rate dashboards
- [ ] User feedback collection (thumbs up/down, comments)
- [ ] A/B testing framework for prompts and models
- [ ] Cost tracking per query (tokens used, API calls)
- [ ] Alerting on quality degradation

**Concepts:** LLM evals, faithfulness scoring, hallucination detection, A/B testing, observability, cost analysis

---

## Phase 08 — Self-Hosted Deployment

One-command deployment for teams that want to run Frontdesk on their own infrastructure. Docker Compose orchestrates the app, vector backend, and database. Configuration covers model provider selection, vector store backend, storage paths, and environment-specific settings.

**Todo:**
- [x] Docker Compose with TimescaleDB/pgvector
- [x] Environment configuration template (.env.example)
- [ ] Dockerfile for the application
- [ ] Vector store backend abstraction (pgvector migration path)
- [ ] Health checks and graceful shutdown for app container
- [ ] Backup and restore scripts for vector store and config
- [ ] Deployment documentation and quickstart guide
- [ ] Helm chart for Kubernetes deployments
- [ ] CI/CD pipeline for automated deployments
- [ ] Monitoring and logging stack (Prometheus, Grafana, Loki)

**Concepts:** Docker, Docker Compose, containerization, pgvector, infrastructure as code, Helm, CI/CD, observability
