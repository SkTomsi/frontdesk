# Architecture

Frontdesk is a **self-hostable, distributed RAG system** currently in Phase 1 (RAG Foundation). Uploads go through an async pipeline — API → R2 → BullMQ queue → worker → parse/chunk/embed → pgvector — and a chat endpoint retrieves tenant-scoped context and streams an LLM answer.

## Monorepo Structure

```
frontdesk/
├── packages/
│   ├── ai/          @frontdesk/ai      — EmbeddingService, Llm, TextSplitter, VectorStore, prompts
│   ├── db/          @frontdesk/db      — Drizzle schema + repositories (documents, document_chunks)
│   ├── ingest/      @frontdesk/ingest  — PDF parser, HierarchicalChunker, IngestPipeline
│   ├── logger/      @frontdesk/logger  — shared pino logger (colored dev / JSON prod)
│   ├── queue/       @frontdesk/queue   — BullMQ connection, ingest queue + worker factory
│   └── storage/     @frontdesk/storage — Cloudflare R2 client (S3-compatible)
├── apps/
│   ├── api/         @frontdesk/api     — Bun HTTP server (port 3003)
│   ├── worker/      @frontdesk/worker  — BullMQ worker running the ingest pipeline
│   └── frontend/    @frontdesk/app     — Next.js 15 App Router (Turbopack)
├── docs/
│   ├── architecture.md   ← this file
│   ├── roadmap.md
│   └── specs/
│       └── phase-02-agent-graph.md
├── docker-compose.yml    — TimescaleDB (PostgreSQL 16 + pgvector) + Redis
├── turbo.json            — Turbo repo orchestration
└── package.json          — Bun workspace root
```

### Dependency Graph

```
@frontdesk/db        (standalone — drizzle-orm + Bun SQL driver)
@frontdesk/storage   (standalone — @aws-sdk/client-s3 → R2)
@frontdesk/queue     (standalone — bullmq + ioredis)
@frontdesk/logger    (standalone — pino)
        ↑
@frontdesk/ai        (depends on db + logger)         ← retrieval, embeddings, LLM
@frontdesk/ingest    (depends on ai + db + logger)    ← parse / chunk / embed pipeline
        ↑
@frontdesk/api       (depends on ai + db + queue + storage + logger)
@frontdesk/worker    (depends on ingest + ai + db + queue + storage + logger)
@frontdesk/app       (standalone — talks to the API over HTTP)
```

---

## Packages

### `packages/db` — Schema & Repositories

**Schema** — two tables (`schema.ts`):

`documents` — one row per uploaded file:

| Column | Type | Notes |
|---|---|---|
| `id` | `text` PK | UUID |
| `tenant_id` | `text` | Tenant scope |
| `filename` / `content_type` / `size_bytes` | | From the upload |
| `content_hash` | `text` | SHA-256, used for dedup |
| `object_key` | `text` | R2 key |
| `status` | `text` | `queued` / `processing` / `completed` / `failed` |
| `chunk_count` / `error` / `completed_at` | | Set by the pipeline |
| `is_active` | `boolean` | |
| `created_at` | `timestamp` | |

Unique index on `(tenant_id, content_hash)`; indexes on `status`, `tenant_id`.

`document_chunks` — parent and child chunks:

| Column | Type | Notes |
|---|---|---|
| `id` | `text` PK | UUID |
| `document_id` | `text` | FK (logical) to `documents` |
| `tenant_id` | `text` | Tenant scope |
| `parent_id` | `text` | Set on child chunks → parent row |
| `content` | `text` | |
| `chunk_index` | `integer` | Global order within the document |
| `page_num` | `integer` | Source page |
| `embedding` | `vector(1536)` | **Only child chunks are embedded**; parents are `null` |
| `embedding_model` | `text` | e.g. `gemini-embedding-001` |
| `is_active` | `boolean` | Default `true` |
| `metadata` | `jsonb` | |

HNSW index on `embedding` with `vector_cosine_ops`; indexes on `tenant_id`, `document_id`, `parent_id`, `is_active`.

**Repositories** (one shared `Bun.SQL` connection via a `createDb()` singleton):

- `DocumentRepository` — `create`, `getById`, `findActiveByHash(tenant, hash)` (dedup), `setStatus`, `listByTenant(tenant, { status })` (active-only), `deleteById(tenant, id)` (hard delete)
- `ChunkRepository` — `initialize()` (idempotent dev bootstrap: creates `vector` extension, tables, indexes), `insertMany` (`onConflictDoUpdate`), `search(embedding, topK, tenant)` (cosine similarity `<=>`), `getParentsByIds`, `count`, `deactivateByDocumentId`, `deleteByDocumentId` (hard delete)

### `packages/storage` — Cloudflare R2

`createR2()` returns `{ uploadObject, getObject, deleteObject }` backed by `S3Client` pointed at `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` (region `"auto"`). `createR2FromEnv()` reads `R2_*` vars. Object keys follow `tenants/<tenantId>/<contentHash>.pdf`. The API uploads file bytes directly (no presigned URLs); the worker downloads them.

### `packages/queue` — BullMQ

- `createRedisConnection()` — ioredis from `REDIS_URL`
- `createIngestQueue()` — the `ingest` queue; `enqueue({ documentId, tenantId, objectKey })` with `jobId = documentId`, `attempts: 3`, exponential backoff 2000ms; `remove(jobId)` for re-ingest
- `createIngestWorker(handler, { concurrency = 2 })`

### `packages/ingest` — Ingestion Domain

- `parser.ts` — pdfjs-dist (legacy build) text extraction, one `ParsedPage` per page
- `chunker.ts` — `HierarchicalChunker`: parents at 2000 chars / 200 overlap, children at 500 / 50 (`RecursiveCharacterTextSplitter`), children link to parents
- `pipeline.ts` — `IngestPipeline.run({ tenantId, documentId, pdf })`:
  1. `initialize()` DB, mark document `processing`
  2. Parse PDF (errors → mark `failed`)
  3. Hierarchically chunk
  4. Embed child chunks via `EmbeddingService`
  5. Upsert parents (`embedding = null`) + children
  6. Mark `completed` with `chunkCount` / `completedAt`
  - Each stage logs duration, page/chunk counts; failures mark the document `failed` and rethrow (so BullMQ can retry)

### `packages/ai` — AI Services

| Service | Wraps | Notes |
|---|---|---|
| `EmbeddingService` | Google Gemini (`gemini-embedding-001`, 1536-dim) | batch 5, concurrency 3, 30s timeout, 3 retries with exponential backoff + jitter; logs retry warnings |
| `Llm` | `ChatGroq` (`openai/gpt-oss-120b`, temperature 0) | `invoke()`, `stream()` |
| `TextSplitter` | `RecursiveCharacterTextSplitter` (500/50) | Kept for plain-text use |
| `VectorStore` | `ChunkRepository` | `initialize()`, `similaritySearch(embedding, topK, tenant?)`, `count` |

`config.ts` holds constants; `prompts.ts` exports `supportPrompt({ context, question })`; `schemas.ts` defines the Zod `SupportAnswer` schema.

### `packages/logger` — pino

`createLogger(name)` binds a `context` field to every line. Dev (`NODE_ENV !== production`) streams through `pino-pretty` with a custom `messageFormat` — `FRONTDESK::<CONTEXT>::[LEVEL] msg +<durationMs>ms` — color-coded per module (`api` magenta, `worker` teal, `ingest` purple, `ai` pink), WARN in orange, ERROR in red, deterministic fallback colors. Production emits JSON. Level from `LOG_LEVEL`.

---

## Apps

### `apps/api` — Bun HTTP Server

**Entrypoint** — `src/index.ts`, `Bun.serve()` with built-in routes. On startup it initializes the `VectorStore` (auto-creates tables/indexes) and instantiates the LLM, embeddings, repositories, R2 client, and ingest queue.

**Tenant scoping** — every request reads `X-Tenant-ID` (fallback `"default"`).

**Routes:**

| Method | Path | Description |
|---|---|---|
| GET | `/health` | `OK OK OK!` |
| POST | `/api/ask` | Ask a question → SSE stream |
| POST | `/api/ingest` | Multipart PDF upload → `202 { documentId }` |
| GET | `/api/ingest` | List documents (`?status=` filter, active only) |
| GET | `/api/ingest/status/:id` | Document status |
| DELETE | `/api/ingest/:id` | Hard-delete document + chunks + R2 object → `204` |
| OPTIONS | all | CORS preflight |

**`POST /api/ingest` flow** (`src/index.ts`):
1. Validate `file` part is a PDF
2. Hash bytes (SHA-256); `findActiveByHash` dedup → `409` if already active & not failed
3. If the doc previously failed: remove the stale BullMQ job and reset to `queued` (same `documentId`/`objectKey`); else create a `documents` row
4. Stream bytes to R2
5. Enqueue the ingest job; on enqueue failure mark `failed`
6. Return `202`

**`POST /api/ask` flow** (`src/index.ts` + `rag.ts`):
1. Embed the question (`EmbeddingService.embedQuery`)
2. `VectorStore.similaritySearch(embedding, 3, tenantId)` — cosine similarity, child chunks only
3. Normalize scores (`raw ** 0.45`) and filter at a similarity threshold (0.7)
4. Fetch the parent chunks of the matched children and build the answer context as `[Page N]\n<parent content>`; fall back to child content if no parents
5. Stream the LLM response as `assistant_delta` events; emit `meta` per cited source; finish with `done`

**Stream event types** (`src/sse.ts`):
- `meta` — `{ source, chunkSize, totalChars, score }`
- `assistant_delta` — `{ text }`
- `done`
- `error` — `{ message }`

**Request logging** — a `handle(label, req, fn)` wrapper logs every request with method, path, tenant, status, and duration; all route handlers log operation-specific events (e.g. `object_uploaded`, `ingest_dedup_hit`, `document_deleted`).

### `apps/worker` — BullMQ Worker

Consumes the `ingest` queue with concurrency 2. Per job:
1. `r2.getObject(objectKey)` (logs bytes + duration)
2. `IngestPipeline.run({ tenantId, documentId, pdf })`
3. Logs `job_completed` (parent/child counts, embedding model, duration)

`worker.on("failed")` logs the job + error. Graceful shutdown on SIGTERM/SIGINT. Note: the pipeline **marks documents `failed` itself** before rethrowing so BullMQ's retries and the API's re-ingest path stay consistent.

### `apps/frontend` — Next.js 15

**Framework** — Next.js 15 App Router, Turbopack for dev HMR.

**Pages:**
- `app/page.tsx` — Chat page (main)
- `app/documents/page.tsx` — Document management: upload PDF, list ingested documents with status, delete

**Chat components** (`components/chat/`): `chat-input`, `message-list`, `markdown-content`, `source-badges`, `chat-header`, `chat-avatar`, `empty-state`.

**Document components** (`components/documents/`): `document-upload` (multipart upload, status polling while `queued`/`processing`), `document-table` (status, chunk count, delete).

**API client** — `lib/api.ts`: `listDocuments`, `ingestDocument`, `getDocumentStatus`, `deleteDocument`; base URL from `NEXT_PUBLIC_API_URL` (default `http://localhost:3003`); sends `X-Tenant-ID: default`; react-query for data + mutations.

**SSE client** — `lib/sse.ts`: AsyncGenerator parsing `data:` lines into typed `StreamEvent`s.

**API proxy** — `next.config.ts` rewrites `/api/*` → `http://localhost:3003/api/*` (chat uses this; documents use `NEXT_PUBLIC_API_URL`).

**Styling** — Tailwind v4, shadcn/ui (base-lyra style), Phosphor Icons, OKLCH color space.

---

## Data Flow

### Ingestion

```
Upload PDF (Documents page)
        ↓
POST /api/ingest (multipart)   ← API (:3003)
        ↓
SHA-256 hash → dedup check (active, not failed → 409)
        ↓
documents row created (status=queued)
        ↓
Stream bytes → R2 (tenants/<tenant>/<hash>.pdf)
        ↓
Enqueue BullMQ "ingest" job (jobId=documentId, retries=3)
        ↓
Worker (:worker) downloads object from R2
        ↓
IngestPipeline: parse (pdfjs) → hierarchical chunk (parent/child)
        ↓
Embed child chunks (Gemini, batched 5 / concurrency 3)
        ↓
Upsert parent (embedding=null) + child rows
        ↓
documents.status = completed (chunkCount, completedAt)
        ↓
Frontend polls /api/ingest/status/:id → table updates
```

### Ask

```
User types question (chat page)
        ↓
POST /api/ask { question }   ← API (:3003), X-Tenant-ID
        ↓
EmbeddingService.embedQuery(question)   ← Gemini
        ↓
ChunkRepository.search(embedding, 3, tenantId)   ← pgvector cosine
        ↓
Normalize scores + threshold filter (0.7)
        ↓
Fetch parent chunks → build context ([Page N]\n…)
        ↓
SSE: meta (sources) → assistant_delta (Groq tokens) → done
        ↓
Frontend renders markdown + source badges
```

---

## Hot Reloading

`bun run dev` at root runs `turbo run dev`, which starts all three tasks concurrently:

| Task | Command | Reload Mechanism |
|---|---|---|
| `@frontdesk/api` | `bun --hot --no-clear-screen --env-file ../../.env` | Bun file watcher (process restart) |
| `@frontdesk/worker` | `bun --hot --no-clear-screen --env-file ../../.env` | Bun file watcher (process restart) |
| `@frontdesk/app` | `next dev --turbopack` | Turbopack HMR |

`--no-clear-screen` preserves Turbo's concurrent output across reloads. If the database is down on startup, the API crashes (`CREATE EXTENSION` fails) — bring up `docker compose up -d` and restart the API manually.

---

## Docker

Only the infrastructure is containerized (`docker-compose.yml`):

```yaml
db:     timescale/timescaledb:latest-pg16   # ports ["5433:5432"], healthcheck, volume
redis:  redis:7-alpine                       # ports ["6379:6379"], healthcheck
```

Uses TimescaleDB (PostgreSQL 16 with pgvector pre-installed). Port 5433 on host avoids local Postgres conflicts.

---

## Key Decisions

- **Infra/domain split** — `db`, `storage`, `queue` are infrastructure; `ingest`, `ai` are domain. The worker is a separate process, so ingestion scales horizontally by adding workers.
- **Async ingestion** — uploads return `202`; the worker owns parsing/embedding. BullMQ provides retries (`attempts: 3`, exponential backoff) and a durable queue on Redis.
- **Hierarchical chunking** — children are embedded and matched; parents provide full-context answers. Parents carry `embedding = null`.
- **Tenant scoping at every layer** — `X-Tenant-ID` header flows through API routes and all repository queries.
- **Dedup + retry** — unique `(tenant_id, content_hash)`; failed docs re-ingest on the same `documentId` (stale job removed first).
- **Hard delete** — documents/chunks are physically deleted so the unique hash index stays valid on re-ingest (soft delete broke it → 500s).
- **Bun-first** — `Bun.serve()`, `Bun.SQL`, `Bun.CryptoHasher`, `bun --hot`, Bun workspaces. No Express, no `pg`, no dotenv.
- **Direct upload** — API streams the file to R2 itself; no presigned URLs (simpler, single-trust-domain).
- **SSE over WebSocket** — simpler for unidirectional streaming.
- **Client-side threshold** — similarity threshold (0.7) applied after SQL retrieval; configurable without DB changes.
- **Structured logging** — pino with per-module colors in dev, JSON in prod.
- **No seed data** — the API boots clean; users upload their own PDFs.

---

## Environment

```env
GROQ_API_KEY=''
GOOGLE_API_KEY=''
DATABASE_URL='postgres://frontdesk:frontdesk@localhost:5433/frontdesk'
REDIS_URL='redis://localhost:6379'
R2_ACCOUNT_ID=''
R2_ACCESS_KEY_ID=''
R2_SECRET_ACCESS_KEY=''
R2_BUCKET=''
LOG_LEVEL='info'          # optional
NEXT_PUBLIC_API_URL='http://localhost:3003'  # frontend
```
