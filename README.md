![Frontdesk](icon.png)

# Frontdesk

A self-hostable, distributed RAG system with an agentic answer path. Users upload PDFs through a web UI; an async worker pipeline parses, hierarchically chunks, and embeds them into a pgvector-backed store; a LangGraph agent answers questions with cited sources — classifying the query, retrieving, reflecting on whether the context is sufficient, and reformulating before answering. Built with Bun, BullMQ + Redis, Cloudflare R2, LangGraph, pgvector, and Drizzle ORM.

## Status

- **Phase 1 — RAG Foundation**: shipped (async PDF ingestion, pgvector retrieval, tenant scoping, document management UI).
- **Phase 2 — Agent Graph**: in progress — the query path now runs through a LangGraph state machine (classify → retrieve → parentFetch → assess → reformulate-loop → generate). Multi-part decomposition, conversation memory, and human-escalation are the remaining sub-phases.

## What It Does

1. **Users upload PDFs** via the web UI (Documents page)
2. **API streams the file to Cloudflare R2** and enqueues an ingest job on Redis/BullMQ
3. **A separate worker process** downloads the object, parses the PDF (pdfjs), splits it hierarchically, and embeds the child chunks with Google Gemini
4. **Vectors are stored in PostgreSQL with pgvector** — queried with Drizzle ORM
5. **A support agent answers questions** — a LangGraph state machine embeds the query, retrieves tenant-scoped chunks (top-k, child chunks), pulls their parent chunks as answer context, scores whether the context answers the question, and either streams an answer or reformulates the query and retries (up to 3 iterations)
6. **Documents are manageable** — list, poll status, and delete (chunks + R2 object)

### How an answer is produced

`POST /api/ask` runs the agent graph (`packages/ai/src/graph/`):

```
classify ──multi_part──▶ decompose ─▶ retrieve
    │                        (stub, retrieves full query)
    └──simple/procedural──▶ retrieve ─▶ parentFetch ─▶ assess
                                                        │
                                    contextScore ≥ 7 ──▶ generate (streams answer)
                                    else & iteration < 3 ─▶ reformulate ─▶ retrieve
                                    else ─▶ generate (best-effort)
```

- **classify** — LLM (structured output) labels the query `simple_factual` / `multi_part` / `procedural`
- **retrieve** — embeds the (possibly reformulated) query and runs `similaritySearch(topK = 8)` against pgvector, tenant-scoped
- **parentFetch** — fetches the parent chunks of matched children (falls back to the children themselves)
- **assess** — LLM (structured output) scores the context 0–10 with a short reason
- **reformulate** — LLM rewrites the query to be more specific when the context is insufficient
- **generate** — streams the final answer token-by-token (SSE `assistant_delta`), labeling each source `[<title>]` or `[Page N]`

## Tech Stack

- **Runtime:** Bun
- **Ingestion:** pdfjs-dist → `HierarchicalChunker` (LangChain `RecursiveCharacterTextSplitter`: parents 2000/200, children 500/50) → Gemini embeddings
- **Agent:** LangGraph (`@langchain/langgraph`) state machine — `classify → decompose → retrieve → parentFetch → assess → reformulate → generate`
- **Queues:** BullMQ + Redis (separate worker app, concurrency 2, attempts 3 with exponential backoff)
- **Object Storage:** Cloudflare R2 (S3-compatible, via `@aws-sdk/client-s3`)
- **Database:** PostgreSQL via Docker (TimescaleDB with pgvector), Drizzle ORM (Bun SQL adapter)
- **LLM:** Groq (`llama-3.3-70b-versatile`, temperature 0) via `@langchain/groq`; structured output with Zod via `withStructuredOutput` (jsonMode)
- **Embeddings:** pluggable `EmbeddingProvider` — default `GoogleEmbeddingProvider` (`gemini-embedding-001`, 1536 dims) via `@google/genai`; batch 5, concurrency 3, retries with exponential backoff + jitter, 30s timeout
- **Frontend:** Next.js 15 App Router (Turbopack), Tailwind v4, shadcn (base-lyra style), Phosphor Icons, react-query
- **Logging:** pino — colored pretty output in dev, JSON in production
- **Validation:** Zod v4
- **Language:** TypeScript (strict mode)

## Project Structure

```
frontdesk/
├── apps/
│   ├── api/              — Bun HTTP server (port 3003)
│   │   └── src/
│   │       ├── index.ts  — Server entrypoint (Bun.serve), all routes
│   │       └── sse.ts    — SSE streaming helpers + CORS
│   ├── worker/           — BullMQ worker (consumes the ingest queue)
│   │   └── src/index.ts  — Downloads from R2, runs IngestPipeline
│   └── frontend/         — Next.js 15 App Router (Turbopack)
│       ├── app/          — Chat page (/) + documents page (/documents)
│       ├── components/   — AppHeader, chat + documents UI, shadcn components
│       └── lib/          — SSE parser, API client (list/upload/status/delete)
├── packages/
│   ├── ai/               — Shared AI library (embeddings, LLM, vector store, agent)
│   │   └── src/
│   │       ├── config.ts — Model + chunk constants
│   │       ├── prompts.ts / schemas.ts / services/
│   │       └── graph/    — LangGraph agent: state.ts, graph.ts, nodes/*, prompts.ts
│   ├── db/               — Drizzle schema + repositories
│   │   └── src/          — schema.ts (documents + document_chunks) + repositories/
│   ├── ingest/           — Ingestion domain (parser.ts, chunker.ts, pipeline.ts)
│   ├── logger/           — Shared pino logger (colored dev / JSON prod)
│   ├── queue/            — BullMQ connection, ingest queue + worker
│   └── storage/          — Cloudflare R2 client (upload/get/delete)
├── docs/                 — architecture, roadmap, product vision, specs
├── docker-compose.yml    — TimescaleDB (pgvector) + Redis
├── turbo.json            — Turbo repo orchestration
└── package.json          — Bun workspace root
```

## Getting Started

### Prerequisites

- [Bun](https://bun.sh)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- A Cloudflare R2 bucket (or any S3-compatible endpoint)
- A Google AI API key and a Groq API key

### 1. Start the infrastructure

```bash
docker compose up -d
```

Runs TimescaleDB (PostgreSQL 16 with pgvector) on port `5433` and Redis on `6379`.

### 2. Install dependencies

```bash
bun install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Fill in your keys:

```
GROQ_API_KEY='your-groq-key'
GOOGLE_API_KEY='your-google-key'
DATABASE_URL='postgres://frontdesk:frontdesk@localhost:5433/frontdesk'
REDIS_URL='redis://localhost:6379'
R2_ACCOUNT_ID='your-r2-account-id'
R2_ACCESS_KEY_ID='your-r2-access-key'
R2_SECRET_ACCESS_KEY='your-r2-secret-key'
R2_BUCKET='your-r2-bucket'
```

Optional: `LOG_LEVEL` (default `info`) and `NEXT_PUBLIC_API_URL` (frontend, default `http://localhost:3003`).

### 4. Run

```bash
bun run dev
```

Turbo starts all three apps concurrently via `turbo run dev`:

- **API** — `http://localhost:3003` (hot reload via `bun --hot`)
- **Worker** — consumes the ingest queue (hot reload via `bun --hot`)
- **Frontend** — `http://localhost:3000` (`next dev --turbopack`)

Tables and indexes are created automatically on API startup (`ChunkRepository.initialize()`); there is no seed data — upload a PDF from the **Documents** page.

## API Endpoints

All routes except `/health` accept an `X-Tenant-ID` header (defaults to `"default"`).

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/api/ask` | Ask a question (runs the agent graph, returns SSE stream) |
| POST | `/api/ingest` | Upload a PDF (multipart `file`) → `202 { documentId }` |
| GET | `/api/ingest` | List documents (optional `?status=`) |
| GET | `/api/ingest/status/:id` | Document status (`queued`/`processing`/`completed`/`failed`) |
| DELETE | `/api/ingest/:id` | Delete document + chunks + R2 object → `204` |

`POST /api/ask` streams server-sent events:
- `meta` — cited source + similarity score
- `assistant_delta` — individual tokens from the LLM
- `done` — stream complete
- `error` — something went wrong

## Tests

```bash
bun test
```

The current suite (`packages/ai/src/graph/graph.test.ts`) covers the agent graph's conditional routing — `classifyRouter` (multi-part vs. simple) and `assessRouter` (context score threshold + max reformulate iterations).

## Drizzle Commands

The schema auto-creates on startup for dev, but Drizzle Kit is available for proper migrations:

```sh
bun run db:generate   # Generate migration SQL from schema
bun run db:migrate    # Apply pending migrations
bun run db:push       # Push schema directly (dev)
bun run db:studio     # Open Drizzle Studio GUI
```

## Development

- **API** — `bun --hot --no-clear-screen` restarts on file changes (preserves terminal output)
- **Worker** — same as API; it owns the ingest pipeline
- **Frontend** — `next dev --turbopack` for sub-second HMR; API calls go to `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:3003`)
- **Logging** — every request/job is logged with pino; modules are color-coded (`FRONTDESK::API::[INFO] …`) in dev

Database connection (pgAdmin):
- **Host:** localhost · **Port:** 5433 · **User/Pass/Db:** frontdesk

## Architecture Decisions

- **Infra/domain split** — `db`, `storage`, `queue` are infrastructure packages; `ingest` and `ai` are domain packages. The worker is a separate app that consumes a queue, making ingestion distributed and horizontally scalable.
- **Async ingestion** — the API uploads to R2 and enqueues; a separate BullMQ worker (concurrency 2, 3 attempts with exponential backoff) does the heavy lifting, so uploads return immediately (`202`).
- **Hierarchical chunking** — parents (2000 chars / 200 overlap) are stored with `embedding = null`; children (500 / 50) are embedded. Retrieval matches child chunks but the answer context uses the parent.
- **Agentic answering instead of single-shot RAG** — the query path is a LangGraph state machine. Retrieval (top-k 8) is followed by an LLM `assess` node that scores context sufficiency; below-threshold context triggers `reformulate → retrieve` up to 3 times before a best-effort answer. Answer tokens stream through the graph via an `onToken` callback.
- **Structured LLM output** — classification, context assessment, and query reformulation use `withStructuredOutput` + Zod (jsonMode); only the final answer streams freeform text.
- **Pluggable embeddings** — `EmbeddingService` depends on a small `EmbeddingProvider` interface (`embedDocuments` / `embedQuery`), so the Gemini provider can be swapped without touching callers.
- **Tenant scoping** — `X-Tenant-ID` header; every query and every repository method filters by tenant.
- **Dedup + retry** — deduplication by `(tenant_id, content_hash)`; previously failed documents can be re-ingested, reusing the same `documentId` (the stale job is removed first).
- **Hard delete** — documents and chunks are hard-deleted so the unique `(tenant_id, content_hash)` index stays valid on re-ingest.
- **Bun-first** — `Bun.serve()`, `Bun.SQL`, `Bun.CryptoHasher`, `bun --hot`. No Express, no `pg`, no dotenv.
- **Structured logging** — pino with per-module color-coded output in dev and JSON in production; retries and rate limits on embeddings log warnings.
- **SSE over WebSocket** — simpler for unidirectional streaming; no bidirectional messaging needed.
- **Self-hosted** — users deploy on their own infrastructure via Docker Compose; R2/Postgres/Redis are the only external services.

## Product Vision

See [docs/final-product.md](docs/final-product.md) for the full product vision — not a chatbot, but an autonomous operations layer for the enterprise.

## Roadmap

See [docs/roadmap.md](docs/roadmap.md) for the full phased plan. The `docs/build-guide.html` artifact is a design/spec reference for the agent architecture; note it targets a Fastify/Prisma/Qdrant stack, while the implemented codebase uses Bun/Drizzle/pgvector.
