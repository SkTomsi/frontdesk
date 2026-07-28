# Frontdesk

An AI-powered customer support agent built with LangChain and Bun. It answers user questions by retrieving relevant documentation chunks via vector similarity search and generating structured responses with confidence scores.

## What It Does

Frontdesk is a RAG (Retrieval-Augmented Generation) pipeline that:

1. **Ingests** documentation — splits docs into chunks using LangChain's text splitters
2. **Embeds** chunks — generates vector embeddings via Google Gemini (free tier)
3. **Stores** vectors — persists embeddings in an in-memory vector store with cosine similarity search
4. **Retrieves** relevant context — finds the top-K most relevant chunks for a user question
5. **Generates** structured answers — returns a response with confidence level, cited sources, and a human-review flag via Groq-hosted LLM

## Tech Stack

- **Runtime:** Bun
- **LLM Framework:** LangChain.js
- **LLM Provider:** Groq (`openai/gpt-oss-120b`)
- **Embeddings:** Google Gemini (`embedding-001`, 768 dimensions)
- **Schema Validation:** Zod v4
- **Language:** TypeScript (strict mode)

## Project Structure

```
src/
├── index.ts              — Entry point with interactive REPL
├── prompts.ts            — Prompt templates
├── schemas.ts            — Structured output schema (Zod)
└── services/
    ├── llm.ts            — LLM service (Groq)
    ├── embeddings.ts     — Embedding service (Gemini)
    ├── text-splitter.ts  — Document chunking (LangChain)
    └── vector-store.ts   — In-memory vector store with persistence
```

## Getting Started

```bash
bun install
```

Create a `.env` file:

```
GROQ_API_KEY='your-groq-key'
GOOGLE_API_KEY='your-google-key'
```

Run:

```bash
bun src/index.ts
```

First run ingests sample documents and caches embeddings to `data/vector-store.json`. Subsequent runs load from cache.

## Architecture Decisions

- **Modular services** — each concern (LLM, embeddings, splitting, storage) is a standalone class, easy to swap implementations
- **Structured output** — LLM responses are constrained to a Zod schema, ensuring predictable JSON output
- **Prompt separation** — prompts are extracted from logic, making iteration on prompt engineering independent of code changes
- **Retry with backoff** — embedding API calls handle rate limits gracefully
- **Deduplication** — vector store prevents duplicate documents on re-ingestion

## Roadmap

A self-hostable SaaS where users ingest their company docs and deploy intelligent support agents across chat platforms.

---

### Phase 01 — RAG Foundation *(current)*

The core retrieval pipeline. Documents are ingested, split into chunks, embedded into vectors, and stored for similarity search. When a user asks a question, the system retrieves the most relevant chunks and feeds them as context to an LLM, which generates a structured answer with confidence scoring and cited sources.

**Todo:**
- [x] Document ingestion and chunking with LangChain text splitters
- [x] Embedding generation with Google Gemini
- [x] In-memory vector store with cosine similarity search
- [x] Structured LLM output with Zod schemas
- [x] Prompt templates separated from logic
- [x] Retry with exponential backoff on embedding API
- [x] Vector store persistence to disk

**Concepts:** RAG, vector embeddings, cosine similarity, chunking strategies, structured output, prompt engineering

---

### Phase 02 — Agent Graph

Move from single-shot retrieval to a multi-step reasoning agent. Using LangGraph, the agent can plan its approach, retrieve context, reflect on the answer quality, and self-correct if needed. This enables handling complex questions that require synthesizing information from multiple documents or reasoning through multi-hop queries.

**Todo:**
- [ ] Define agent state schema (messages, context, reasoning steps)
- [ ] Build LangGraph graph with retrieve → reason → reflect → answer nodes
- [ ] Add reflection loop — agent evaluates its own answer before responding
- [ ] Implement fallback to human escalation on low confidence
- [ ] Add conversation memory for multi-turn support

**Concepts:** LangGraph, state machines, ReAct pattern, reflection, multi-hop reasoning, conversation memory

---

### Phase 03 — Tool Calling & MCP

Give agents the ability to take actions beyond retrieval. Tools let the agent look up live data from APIs, query databases, search the web, or access internal wikis. MCP (Model Context Protocol) provides a standardized way to connect to external data sources and services, making integrations pluggable and portable across deployments.

**Todo:**
- [ ] Define tool interface and registry
- [ ] Implement core tools: API lookup, database query, web search
- [ ] MCP client for connecting to external data sources
- [ ] Agent decides when to call tools vs. answer from context
- [ ] Tool result injection into prompt context
- [ ] Tool execution sandboxing and timeout handling

**Concepts:** Function calling, tool use, MCP protocol, API integration, sandboxed execution, dynamic context assembly

---

### Phase 04 — Triage & Routing

Classify incoming messages by intent, urgency, and domain before the agent processes them. Routine questions get auto-answered instantly, complex or sensitive ones escalate to human agents, and domain-specific queries route to specialized agents with tailored tools and knowledge. This reduces latency for simple cases and ensures expertise for hard ones.

**Todo:**
- [ ] Intent classifier (question, complaint, feature request, billing, etc.)
- [ ] Urgency scorer (low, medium, high, critical)
- [ ] Routing rules engine — map intent + urgency to agent or human queue
- [ ] Specialized agent configs (billing agent, technical agent, etc.)
- [ ] Escalation pipeline with handoff context
- [ ] Fallback agent for unmatched intents

**Concepts:** Intent classification, priority scoring, routing rules, agent specialization, escalation pipelines, handoff protocols

---

### Phase 05 — Multi-Tenant & Auth

Each organization gets its own isolated workspace with独立 document ingestion, agent configuration, and vector storage. Users authenticate, manage API keys, invite team members, and control access levels. Tenant isolation ensures one customer's data never leaks into another's retrieval context.

**Todo:**
- [ ] User authentication (email/password, OAuth, SSO)
- [ ] Organization and workspace management
- [ ] Per-tenant vector store isolation
- [ ] API key generation and rotation
- [ ] Role-based access control (owner, admin, member, viewer)
- [ ] Usage quotas and billing integration
- [ ] Audit logging for compliance

**Concepts:** Multi-tenancy, RBAC, OAuth2, SSO, data isolation, API key management, audit trails

---

### Phase 06 — Chat Platform Integrations

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

**Concepts:** Webhooks, OAuth bot tokens, message adapters, platform APIs, threading models, real-time messaging

---

### Phase 07 — Evaluation & Analytics

Measure and improve agent quality systematically. Automated evaluation pipelines score answers on precision, recall, hallucination rate, and response time. Dashboards track resolution rates, user satisfaction, and escalation patterns. A/B testing lets you compare prompt versions and model configurations with real traffic.

**Todo:**
- [ ] Eval dataset builder — create ground-truth Q&A pairs from docs
- [ ] Automated scoring: precision, recall, faithfulness, hallucination
- [ ] Response time and latency tracking
- [ ] Resolution rate and escalation rate dashboards
- [ ] User feedback collection (thumbs up/down, comments)
- [ ] A/B testing framework for prompts and models
- [ ] Cost tracking per query (tokens used, API calls)

**Concepts:** LLM evals, faithfulness scoring, hallucination detection, A/B testing, observability, cost analysis

---

### Phase 08 — Self-Hosted Deployment

One-command deployment for teams that want to run Frontdesk on their own infrastructure. Docker Compose orchestrates the app, vector backend, and database. Configuration covers model provider selection, vector store backend (SQLite for small scale, Postgres/pgvector for production), storage paths, and environment-specific settings.

**Todo:**
- [ ] Dockerfile for the application
- [ ] Docker Compose with app + Postgres/pgvector + Redis
- [ ] Environment configuration template (.env.example)
- [ ] Vector store backend abstraction (SQLite → pgvector migration path)
- [ ] Health checks and graceful shutdown
- [ ] Backup and restore scripts for vector store and config
- [ ] Deployment documentation and quickstart guide
- [ ] Helm chart for Kubernetes deployments

**Concepts:** Docker, Docker Compose, containerization, pgvector, infrastructure as code, Helm, CI/CD
