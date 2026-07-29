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
