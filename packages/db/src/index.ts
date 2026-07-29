import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";

export function createDb(databaseUrl?: string) {
	const client = new SQL(databaseUrl ?? process.env.DATABASE_URL!);
	return { client, db: drizzle({ client }) };
}
