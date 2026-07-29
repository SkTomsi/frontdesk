# Architecture

## Monorepo Structure

```
frontdesk/
├── packages/
│   ├── ai/          @frontdesk/ai    — Shared AI library (RAG pipeline)
│   └── db/          @frontdesk/db    — Database schema + Drizzle client
├── apps/
│   ├── api/         @frontdesk/api   — Bun HTTP server (port 3003)
│   └── frontend/    @frontdesk/app   — Next.js 15 App Router (Turbopack)
├── docs/
│   ├── architecture.md   ← this file
│   ├── roadmap.md
│   └── specs/
│       └── phase-02-agent-graph.md
├── docker-compose.yml    — TimescaleDB (PostgreSQL 16 + pgvector)
├── turbo.json            — Turbo repo orchestration
└── package.json          — Bun workspace root
```

### Dependency Graph

```
@frontdesk/db        (standalone — drizzle-orm + bun SQL driver)
       ↑
@frontdesk/ai        (depends on @frontdesk/db for vector store)
       ↑
@frontdesk/api       (depends on @frontdesk/ai)
@frontdesk/app       (standalone — no internal deps)
```

---

## Packages

### `packages/db` — Database Client & Schema

**Schema** — Single `documents` table:

| Column | Type | Notes |
|---|---|---|
| `id` | `text` PK | |
| `content` | `text` | The document chunk text |
| `embedding` | `vector(3072)` | Gemini embedding (3072 dimensions) |
| `metadata` | `jsonb` | Default `{}` |

HNSW index on `embedding` with `vector_cosine_ops` for approximate nearest-neighbor search.

**Client** — `createDb()` factory using `Bun.SQL` driver + `drizzle-orm/bun-sql`.

**DB management** — Drizzle Kit for migrations (`db:generate`, `db:migrate`, `db:push`). Plus a runtime `initialize()` in the VectorStore that auto-creates extension and table for dev convenience.

### `packages/ai` — RAG Pipeline

Four services:

| Service | Wraps | Key Methods |
|---|---|---|
| `EmbeddingService` | `GoogleGenerativeAIEmbeddings` (LangChain) | `embedDocuments()`, `embedQuery()` — both with exponential backoff retry (3 attempts, 1s/2s/4s) |
| `VectorStore` | Drizzle ORM + pgvector | `initialize()`, `addDocuments()`, `similaritySearch()` (cosine distance via `<=>` operator), `count()`, `close()` |
| `Llm` | `ChatGroq` (LangChain) | `invoke()`, `stream()` — model `openai/gpt-oss-120b`, temperature 0 |
| `TextSplitter` | `RecursiveCharacterTextSplitter` (LangChain) | `splitDocuments()`, `splitText()` — chunk size 500, overlap 50 |

**Config** — `config.ts` holds constants: chunk size, model names.

**Prompts** — `prompts.ts` exports `supportPrompt({ context, question })` — pure function, no side effects.

**Structured Output** — `schemas.ts` defines Zod v4 `SupportAnswer` schema with fields: `answer`, `confidence` (high/medium/low), `citedSources`, `needsHumanReview`, `score`.

**Seed Data** — `data/sample-docs.ts` contains 6 self-referential documents describing the project itself. If the vector store is empty on startup, these are chunked, embedded, and ingested automatically.

---

## Apps

### `apps/api` — Bun HTTP Server

**Entrypoint** — `src/index.ts` using `Bun.serve()` with built-in routing.

**Startup:**
1. Initialize LLM, EmbeddingService, TextSplitter, VectorStore
2. Auto-create DB tables if missing
3. Seed sample documents if DB is empty
4. Start HTTP server

**Endpoints:**

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Returns `"OK OK OK!"` |
| POST | `/api/ask` | Accepts `{ question }`, returns SSE stream |
| OPTIONS | `/api/ask` | CORS preflight |

**`POST /api/ask` SSE flow:**
1. Embed question via Gemini
2. Cosine similarity search on pgvector (top 3)
3. Filter by threshold (≥ 0.5)
4. Build context string with source labels and scores
5. Send `meta` SSE events (source info per chunk)
6. Stream LLM response as `assistant_delta` events
7. Send `done` event

**Stream event types** (`src/sse.ts`):
- `meta` — `{ source, chunkSize, totalChars }`
- `assistant_delta` — `{ text }`
- `done`
- `error` — `{ message }`

**Development** — `bun --hot --no-clear-screen --env-file ../../.env ./src/index.ts`
- `--hot`: Hot module reloading (restarts on file change)
- `--no-clear-screen`: Preserves terminal output across reloads

### `apps/frontend` — Next.js 15

**Framework** — Next.js 15 App Router, Turbopack for dev HMR.

**Key pages:**
- `app/page.tsx` — Main chat page (client component)
- `app/layout.tsx` — Root layout with JetBrains Mono font, Providers wrapper

**Chat components** (`components/chat/`):
- `chat-input.tsx` — Question input form
- `message-list.tsx` — Message scroller with auto-scroll
- `markdown-content.tsx` — react-markdown + remark-gfm
- `source-badges.tsx` — Source citation pills
- `chat-header.tsx` — App header
- `chat-avatar.tsx` — Bot/User avatars
- `empty-state.tsx` — Placeholder when no messages

**SSE client** — `lib/sse.ts`: AsyncGenerator that parses `data:` lines from ReadableStream into typed `StreamEvent` objects.

**API proxy** — `next.config.ts` rewrites `/api/*` to `http://localhost:3003/api/*`.

**Styling** — Tailwind v4, shadcn/ui (base-lyra style), Phosphor Icons, OKLCH color space.

---

## Data Flow

```
User types question
       ↓
Frontend POST /api/ask { question }
       ↓
Bun API receives request
       ↓
EmbeddingService.embedQuery(question)    ← Gemini API (with retry)
       ↓
VectorStore.similaritySearch(embedding)  ← pgvector cosine similarity
       ↓
Filter by score ≥ 0.5
       ↓
Build context string
       ↓
SSE: meta events (sources)
       ↓
Llm.stream(supportPrompt(context, question))  ← Groq API
       ↓
SSE: assistant_delta events (tokens)
       ↓
SSE: done event
       ↓
Frontend renders markdown + source badges
```

---

## Hot Reloading

`bun run dev` at root runs `turbo run dev`, which starts both tasks concurrently:

| Task | Command | Reload Mechanism |
|---|---|---|
| `@frontdesk/api` | `bun --hot --no-clear-screen` | Bun file watcher (process restart) |
| `@frontdesk/app` | `next dev --turbopack` | Turbopack HMR |

The API uses `--no-clear-screen` so Turbo's concurrent output (showing both tasks) is preserved across reloads.

---

## Docker

Only the database is containerized:

```yaml
db:
  image: timescale/timescaledb:latest-pg16
  ports: ["5433:5432"]
```

Uses TimescaleDB (PostgreSQL 16 with pgvector pre-installed). Port 5433 on host to avoid local Postgres conflicts.

---

## Key Decisions

- **Bun-first**: `Bun.serve()`, `Bun.SQL`, `bun --hot`, Bun workspaces. No Express, no `pg`.
- **SSE over WebSocket**: Simpler for unidirectional streaming. No bidirectional messaging needed.
- **Client-side threshold**: Similarity threshold (0.5) applied in JS after SQL retrieval — configurable without DB changes.
- **Hybrid DB management**: `VectorStore.initialize()` auto-creates tables for dev; Drizzle Kit for prod migrations.
- **Self-referential seed data**: Sample docs describe the project itself — useful for demos and testing.
- **Few files**: The codebase is lean — 1 DB table, 4 AI services, 3 API source files. Complexity deferred to future phases.

---

## Environment

```env
GROQ_API_KEY=''
GOOGLE_API_KEY=''
DATABASE_URL='postgres://frontdesk:frontdesk@localhost:5433/frontdesk'
```
