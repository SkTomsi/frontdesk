import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";

interface DbConnection {
	client: SQL;
	db: ReturnType<typeof drizzle>;
}

const globalStore = globalThis as { __frontdeskDb?: DbConnection };

export function createDb(databaseUrl?: string): DbConnection {
	if (globalStore.__frontdeskDb) {
		return globalStore.__frontdeskDb;
	}

	const client = new SQL(databaseUrl ?? process.env.DATABASE_URL!);
	globalStore.__frontdeskDb = { client, db: drizzle({ client }) };
	return globalStore.__frontdeskDb;
}

export { ChunkRepository } from "./repositories/chunks";
export type {
	NewChunk,
	SearchResultRow,
	StoredChunk,
} from "./repositories/chunks";
export { DocumentRepository } from "./repositories/documents";
export type {
	DocumentRecord,
	DocumentStatus,
	DocumentStatusUpdate,
	NewDocument,
} from "./repositories/documents";
