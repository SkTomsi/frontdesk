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
src/
├── index.ts              — Entry point with interactive REPL
├── prompts.ts            — Prompt templates
├── schemas.ts            — Structured output schema (Zod)
├── config.ts             — Environment configuration
├── data/
│   └── sample-docs.ts    — Sample documentation for ingestion
├── db/
│   ├── index.ts          — Drizzle client setup
│   └── schema.ts         — Database schema (documents table)
└── services/
    ├── llm.ts            — LLM service (Groq)
    ├── embeddings.ts     — Embedding service (Gemini)
    ├── text-splitter.ts  — Document chunking (LangChain)
    └── vector-store.ts   — pgvector-backed vector store via Drizzle
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

The app auto-creates the schema on first run, but you can also push explicitly:

```bash
bun run db:push
```

### 5. Run

```bash
bun src/index.ts
```

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

To connect the database for inspection with pgAdmin:

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
- **Self-hosted** — users deploy on their own infrastructure via Docker Compose, no vendor lock-in

## Roadmap

See [docs/roadmap.md](docs/roadmap.md) for the full phased plan.
