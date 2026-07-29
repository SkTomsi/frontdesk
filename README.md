# Frontdesk

A self-hostable AI support platform. Users upload documentation via a UI, create support bots, and embed them on their website or Telegram. Built with Bun, LangChain, pgvector, and Drizzle ORM.

## What It Does

Frontdesk is a RAG (Retrieval-Augmented Generation) platform where:

1. **Users upload docs** — PDF, Markdown, or HTML via a web UI (MVP)
2. **Documents get chunked and embedded** — via Google Gemini
3. **Vectors stored in PostgreSQL with pgvector** — queried with Drizzle ORM
4. **A support bot answers questions** — retrieves the most relevant chunks and generates structured answers via Groq LLM
5. **Bot is embedded** — as a floating web widget or Telegram bot
6. **Multi-bot per workspace** — different bots with their own knowledge base

## Tech Stack

- **Runtime:** Bun
- **LLM Framework:** LangChain.js
- **LLM Provider:** Groq (`openai/gpt-oss-120b`)
- **Embeddings:** Google Gemini (`gemini-embedding-2`, 3072 dimensions)
- **Database:** PostgreSQL via Docker (TimescaleDB with pgvector)
- **ORM:** Drizzle ORM (Bun SQL adapter)
- **Schema Validation:** Zod v4
- **Language:** TypeScript (strict mode)

## Project Structure

```
frontdesk/
├── apps/
│   ├── api/              — Bun HTTP server (port 3003)
│   │   └── src/
│   │       ├── index.ts  — Server entrypoint (Bun.serve)
│   │       ├── rag.ts    — Retrieval pipeline
│   │       └── sse.ts    — SSE streaming helpers
│   └── frontend/         — Next.js 15 App Router (Turbopack)
│       ├── app/          — Pages and layout
│       ├── components/   — Chat UI + 60 shadcn components
│       └── lib/          — SSE parser, utils
├── packages/
│   ├── ai/               — Shared AI library
│   │   └── src/
│   │       ├── config.ts
│   │       ├── prompts.ts
│   │       ├── schemas.ts
│   │       ├── data/sample-docs.ts
│   │       └── services/
│   │           ├── embeddings.ts
│   │           ├── llm.ts
│   │           ├── text-splitter.ts
│   │           └── vector-store.ts
│   └── db/               — Database schema + Drizzle client
│       ├── src/
│       │   ├── index.ts  — Client factory
│       │   └── schema.ts — Documents table (pgvector)
│       └── drizzle/      — Migration files
├── docs/
│   ├── architecture.md   — Current architecture overview
│   ├── roadmap.md        — Phased plan
│   └── specs/            — Feature specs
├── docker-compose.yml    — TimescaleDB with pgvector
├── turbo.json            — Turbo repo orchestration
└── package.json          — Bun workspace root
```

## Getting Started

### Prerequisites

- [Bun](https://bun.sh)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

### 1. Start the database

```bash
docker compose up -d
```

This runs TimescaleDB (PostgreSQL 16 with pgvector) on port `5433`.

### 2. Install dependencies

```bash
bun install
```

### 3. Configure environment

Create a `.env` file:

```
GROQ_API_KEY='your-groq-key'
GOOGLE_API_KEY='your-google-key'
DATABASE_URL='postgres://frontdesk:frontdesk@localhost:5433/frontdesk'
```

### 4. Push the database schema

```bash
bun run db:push
```

### 5. Run

```bash
bun run dev
```

This starts both the API server (port 3003, with hot reload) and the Next.js frontend (Turbopack) concurrently via Turbo.

First run ingests sample documents, generates embeddings, and stores them in PostgreSQL. Subsequent runs load from the database.

## Drizzle Commands

```sh
bun run db:generate   # Generate migration SQL from schema
bun run db:migrate    # Apply pending migrations
bun run db:push       # Push schema directly (dev)
bun run db:studio     # Open Drizzle Studio GUI
bun run db:check      # Check migration state
bun run db:drop       # Drop migration tables
bun run db:up         # Upgrade to latest
```

## Development

The API server runs on `http://localhost:3003`. The frontend runs on `http://localhost:3000` with API requests proxied via Next.js rewrites.

Hot reloading:
- **API**: `bun --hot --no-clear-screen` restarts on file changes (preserves terminal output)
- **Frontend**: `next dev --turbopack` for sub-second HMR

Database connection (pgAdmin):
- **Host:** localhost
- **Port:** 5433
- **Username:** frontdesk
- **Password:** frontdesk
- **Database:** frontdesk

## Architecture Decisions

- **Modular services** — each concern (LLM, embeddings, splitting, storage) is a standalone class, easy to swap implementations
- **Structured output** — LLM responses are constrained to a Zod schema, ensuring predictable JSON output
- **Prompt separation** — prompts are extracted from logic, making iteration on prompt engineering independent of code changes
- **Retry with backoff** — embedding API calls handle rate limits gracefully
- **Drizzle ORM** — type-safe database access with Bun SQL driver, replaces raw SQL for readability
- **pgvector with TimescaleDB** — production-grade vector store with full PostgreSQL ecosystem
- **SSE over WebSocket** — simpler for unidirectional streaming; no bidirectional messaging needed
- **Self-hosted** — users deploy on their own infrastructure via Docker Compose, no vendor lock-in

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/api/ask` | Ask a question (returns SSE stream) |

The `POST /api/ask` endpoint accepts `{ question: string }` and streams responses as server-sent events:
- `meta` — source chunks used as context
- `assistant_delta` — individual tokens from the LLM
- `done` — stream complete
- `error` — something went wrong

## Product Vision

See [docs/final-product.md](docs/final-product.md) for the full product vision — not a chatbot, but an autonomous operations layer for the enterprise. Designed for FDE roles.

## Roadmap

See [docs/roadmap.md](docs/roadmap.md) for the full phased plan.
