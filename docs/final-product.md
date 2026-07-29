# Frontdesk — Enterprise AI Agent Platform

> *Not a chatbot. An autonomous operations layer for the enterprise.*

---

## The Problem

Corporations run on fragmented systems. A customer reports a billing issue in Slack, the support agent searches three knowledge bases, checks Salesforce for account status, queries Stripe for payment history, and then manually creates a Jira ticket for engineering — all while the customer waits. This is the reality of enterprise operations: **humans acting as glue between silos**.

The market is flooded with "AI chatbots" that regurgitate documentation. They answer "What is your return policy?" but can't check if the order was shipped, refund the customer, and notify the warehouse. Enterprises don't need another FAQ bot. They need **agents that act**.

---

## The Product

Frontdesk is an **autonomous operations agent platform** — a self-hosted system where:

1. Agents connect to an organization's real data sources (databases, APIs, SaaS tools, wikis)
2. They triage incoming work by intent, urgency, and domain
3. They resolve issues autonomously — not just answer questions, but take actions
4. They escalate to humans only when confidence is low or human judgment is required
5. Everything is observable: every action, every reasoning step, every cost metric

It deploys *inside* the enterprise network via Docker Compose, connects to the tools the organization already uses, and becomes an autonomous operator — not a search engine with a chat UI.

---

## Architecture (FDE-Ready)

```
┌─────────────────────────────────────────────────────────┐
│                    Enterprise Boundary                    │
│                                                          │
│  ┌─────────────┐    ┌────────────────────────────────┐   │
│  │   Ingress    │    │        Frontdesk Server        │   │
│  │  (Slack,     │───▶│  ┌──────────────┐             │   │
│  │   Web,       │    │  │  Orchestrator │──▶ Agent 1 │   │
│  │   Email,     │    │  │  (LangGraph)  │──▶ Agent 2 │   │
│  │   Webhook)   │    │  │              │──▶ Agent 3 │   │
│  └─────────────┘    │  └──────┬───────┘             │   │
│                     │         │                       │   │
│  ┌─────────────┐    │  ┌──────┴───────┐              │   │
│  │  Data Layer  │◀───│──│ Tool Registry │              │   │
│  │  (Postgres,  │    │  │──────────────│              │   │
│  │   APIs,      │    │  │ • RAG Retriever             │   │
│  │   SaaS)      │    │  │ • DB Query Tool             │   │
│  └─────────────┘    │  │ • API Client                 │   │
│                     │  │ • Jira Create                │   │
│                     │  │ • Slack Notify               │   │
│                     │  │ • Email Send                 │   │
│                     │  │ • Escalation                 │   │
│                     │  └──────────────────────────────┘   │
│                     │                                      │
│                     │  ┌──────────────┐  ┌──────────────┐ │
│                     │  │  Eval Engine  │  │  Audit Log    │ │
│                     │  │  (Precision,  │  │  (Every       │ │
│                     │  │   Recall,     │  │   Action      │ │
│                     │  │   Halluc.)    │  │   Recorded)   │ │
│                     │  └──────────────┘  └──────────────┘ │
│                     └────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### Key Design Decisions

| Decision | Rationale | FDE Relevance |
|---|---|---|
| **Self-hosted (Docker Compose)** | Deploys inside customer VPC, no data leaves their network | Every enterprise security team demands this |
| **Tool-calling agents, not Q&A bots** | Agents take actions (create tickets, update records, send messages) | This is what separates demo from production |
| **Intent classification before routing** | Different problems need different specialized agents | Reduces hallucination, improves accuracy |
| **LangGraph orchestration** | Agents reason in loops — plan, act, observe, reflect | FDEs need to debug agent decision-making |
| **Audit log for every action** | Every decision is recorded for compliance review | Non-negotiable in regulated industries |
| **Pluggable tool registry** | Each customer has different tools; tools are configured per deployment | The core FDE skill: adapting to the customer's stack |
| **SSE streaming** | Users see agent reasoning in real-time | Builds trust through transparency |

---

## Agent Workflows (What Makes It Real)

### 1. Billing Resolution Agent

**Trigger:** User in Slack says "I was charged twice for my Pro plan."

**Agent execution:**
1. **Classify intent:** billing → route to Billing Agent
2. **Retrieve customer:** query Salesforce/Stripe for user's account
3. **Check invoices:** query billing DB for duplicate charges
4. **Validate policy:** look up refund policy (RAG on docs)
5. **Take action:** initiate refund via Stripe API, send confirmation email
6. **Log:** record action in audit trail with refund ID and approval reference
7. **Respond:** "I found a duplicate charge from June 15. I've issued a refund of $28. You'll see it in 3-5 business days."

**If confidence < threshold:** Escalate to human with full context — account info, policy citation, audit trail, draft response.

### 2. Infrastructure Incident Triage Agent

**Trigger:** PagerDuty alert → webhook into Frontdesk.

**Agent execution:**
1. **Read alert:** parse PagerDuty payload
2. **Check runbook:** RAG on incident response docs
3. **Query metrics:** check Datadog/Grafana for current state
4. **Check recent changes:** query GitHub for recent deployments
5. **Determine severity:** if CPU > 90% AND recent deploy → likely rollback candidate
6. **Take action:** create Jira ticket with severity, assign to on-call, post in Slack #incidents with runbook link
7. **Escalate if critical:** page on-call via PagerDuty with context

### 3. Employee Onboarding Agent

**Trigger:** HR system webhook → new hire created.

**Agent execution:**
1. **Provision accounts:** call Okta/Workday API to create user
2. **Assign groups:** add to Slack channels, GitHub teams, email lists
3. **Create tasks:** assign onboarding checklist tasks to hiring manager
4. **Send welcome:** email new hire with instructions and day-1 schedule
5. **Log:** record all provisioned accounts in audit trail

### 4. Contract Intelligence Agent

**Trigger:** Sales team asks "What's our renewal date with Acme Corp?"

**Agent execution:**
1. **Query CRM:** find Acme Corp account in Salesforce
2. **Retrieve document:** RAG on uploaded contract PDF in Google Drive
3. **Extract terms:** identify renewal date, auto-renewal clause, notice period
4. **Cross-reference:** check if notice period expires within 30 days
5. **Respond:** "Acme Corp renews on Oct 15, 2026 (auto-renew, 60-day notice). The notice window opens Aug 16."

---

## FDE Resume Positioning

### The Narrative

This project demonstrates the *core FDE competency*: deploying autonomous AI into messy enterprise environments and making it actually work.

| What Most Candidates Have | What This Shows |
|---|---|
| "Built a RAG chatbot" | "Built an autonomous operations agent that connects to enterprise systems and takes actions" |
| "Used LangChain" | "Designed a multi-agent system with LangGraph, tool-calling, intent routing, and human-in-the-loop escalation" |
| "Deployed on Vercel" | "Self-hosted Docker deployment inside customer VPC with audit logging and tenant isolation" |
| "Built a demo" | "Interviewed customer ops teams, designed workflows, deployed incrementally, measured impact" |

### Key talking points for interviews

| Question | Answer |
|---|---|
| "Tell me about a project you designed from scratch" | Walk through the architecture: why self-hosted, why tool-calling agents over RAG-only, how you handle escalation, how you audit decisions |
| "How do you handle hallucination?" | Confidence scoring with threshold-based escalation + eval pipeline that scores precision/recall on ground-truth datasets |
| "How do you adapt to different customers?" | Plugable tool registry — each deployment configures which tools (Jira, Stripe, Salesforce) the agent has access to |
| "How do you debug when the agent does something wrong?" | Full audit log of every reasoning step + observability into token usage, tool call latency, and confidence scores |
| "How does this handle scale?" | Multi-tenant vector store isolation, async processing, cost tracking per query, streaming response for UX |

### The Technical Stack

- **Runtime:** Bun (fast cold start, low memory, ideal for containerized deployments)
- **Agent Framework:** LangGraph (state machines for reliable multi-step reasoning)
- **LLM:** Groq (fast inference, structured output via Zod)
- **Embeddings:** Google Gemini (3072-dim vectors, strong semantic retrieval)
- **Vector Store:** PostgreSQL + pgvector (production battle-tested, no separate infra)
- **ORM:** Drizzle ORM (type-safe, Bun-native SQL adapter)
- **Frontend:** Next.js 15 + Tailwind v4 + shadcn (low-code chat UI for demos)
- **Containerization:** Docker Compose (single-command deployment)
- **Evals:** Custom precision/recall/hallucination scoring against ground-truth datasets

---

## Implementation Roadmap

### Stage 1: Agent Core (Current)
- [x] RAG pipeline (ingest, chunk, embed, retrieve)
- [x] Structured LLM output with confidence scoring
- [x] Streaming SSE responses
- [x] Chat UI with source attribution
- [ ] **LangGraph agent with tool-calling** — replaces single-shot RAG with reasoning loops
- [ ] **Intent classifier** — categorize incoming requests before routing
- [ ] **Tool registry** — plugable tool interface (DB query, API call, web search)

### Stage 2: Enterprise Integration
- [ ] **Slack bot** — bidirectional messaging, thread awareness, slash commands
- [ ] **Jira connector** — create/update/search tickets as agent actions
- [ ] **Email ingress** — receive and respond via email
- [ ] **Webhook receiver** — accept events from PagerDuty, Zendesk, etc.
- [ ] **Human escalation** — handoff with full context (conversation, tool results, reasoning)

### Stage 3: Operations & Observability
- [ ] **Audit log** — every action stored with timestamp, agent, tool, input, output, confidence
- [ ] **Eval pipeline** — automated scoring on ground-truth Q&A dataset
- [ ] **Cost tracking** — per-query token and API usage
- [ ] **Dashboard** — resolution rate, escalation rate, average response time
- [ ] **A/B testing** — compare agent configurations on real traffic

### Stage 4: Multi-Tenant & Production
- [ ] **Tenant isolation** — per-organization vector store and config
- [ ] **Auth (SSO)** — SAML/OIDC for enterprise customers
- [ ] **RBAC** — owner, admin, agent, viewer roles
- [ ] **API keys** — programmatic access for embedding and agent APIs
- [ ] **Usage quotas** — billing-ready metering

---

## What De-risks the FDE Interview

| Risk | Mitigation |
|---|---|
| "Is this just a wrapper around an LLM?" | Emphasis on tool-calling, intent routing, multi-agent orchestration — the LLM is just one component |
| "Have you handled real enterprise constraints?" | Self-hosted deployment, audit logging, SSO, tenant isolation, rate limiting, retry with backoff |
| "Can you debug agent failures?" | Eval pipeline, audit log, confidence scoring, observability dashboard |
| "Can you adapt to different customer stacks?" | Plugable tool registry design — the config drives what the agent can do, not the code |
| "Do you understand the ops side?" | Docker Compose, health checks, env-based config, migration scripts |
