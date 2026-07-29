# Roadmap

A self-hostable SaaS where users ingest their company docs and deploy intelligent support agents across chat platforms.

---

## Phase 01 — RAG Foundation *(current)*

The core retrieval pipeline. Documents are ingested, split into chunks, embedded into vectors, and stored in PostgreSQL with pgvector for similarity search. When a user asks a question, the system retrieves the most relevant chunks and feeds them as context to an LLM, which generates a structured answer with confidence scoring and cited sources.

**Todo:**
- [x] Document ingestion and chunking with LangChain text splitters
- [x] Embedding generation with Google Gemini
- [x] PostgreSQL-backed vector store with pgvector via Drizzle ORM
- [x] Structured LLM output with Zod schemas
- [x] Prompt templates separated from logic
- [x] Retry with exponential backoff on embedding API
- [x] Docker Compose for database (TimescaleDB with pgvector)
- [x] Drizzle ORM for type-safe database access
- [ ] Multi-document ingestion from various formats (PDF, Markdown, HTML)
- [ ] Document deletion and re-ingestion workflow
- [ ] Embedding model configuration per workspace
- [ ] Vector index tuning for performance at scale

**Concepts:** RAG, vector embeddings, cosine similarity, chunking strategies, structured output, prompt engineering, pgvector, Drizzle ORM

---

## Phase 02 — Agent Graph

Move from single-shot retrieval to a multi-step reasoning agent. Using LangGraph, the agent can plan its approach, retrieve context, reflect on the answer quality, and self-correct if needed. This enables handling complex questions that require synthesizing information from multiple documents or reasoning through multi-hop queries.

**Todo:**
- [ ] Define agent state schema (messages, context, reasoning steps)
- [ ] Build LangGraph graph with retrieve → reason → reflect → answer nodes
- [ ] Add reflection loop — agent evaluates its own answer before responding
- [ ] Implement fallback to human escalation on low confidence
- [ ] Add conversation memory for multi-turn support
- [ ] Streaming responses for real-time UX
- [ ] Token usage tracking per conversation turn

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
