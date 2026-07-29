import { cosineDistance, desc, sql } from "drizzle-orm";
import { createDb } from "../db";
import { documents } from "../db/schema";

export interface StoredDocument {
	id: string;
	content: string;
	embedding: number[];
	metadata: Record<string, unknown>;
}

export interface SearchResult {
	document: StoredDocument;
	score: number;
}

interface VectorStoreConfig {
	databaseUrl?: string;
}

export class VectorStore {
	private client: ReturnType<typeof createDb>["client"];
	private db: ReturnType<typeof createDb>["db"];

	constructor(config: VectorStoreConfig = {}) {
		const { client, db } = createDb(config.databaseUrl);
		this.client = client;
		this.db = db;
	}

	async initialize() {
		await this.db.execute(sql.raw("CREATE EXTENSION IF NOT EXISTS vector"));
		await this.db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS "documents" (
			"id" text PRIMARY KEY,
			"content" text NOT NULL,
			"embedding" vector(3072) NOT NULL,
			"metadata" jsonb DEFAULT '{}' NOT NULL
		)`));
	}

	async addDocuments(docs: StoredDocument[]) {
		for (const doc of docs) {
			await this.db
				.insert(documents)
				.values({
					id: doc.id,
					content: doc.content,
					embedding: doc.embedding,
					metadata: doc.metadata,
				})
				.onConflictDoUpdate({
					target: documents.id,
					set: {
						content: doc.content,
						embedding: doc.embedding,
						metadata: doc.metadata,
					},
				});
		}
	}

	async similaritySearch(
		queryEmbedding: number[],
		topK: number = 3,
	): Promise<SearchResult[]> {
		const similarity = sql<number>`1 - (${cosineDistance(documents.embedding, queryEmbedding)})`;

		const rows = await this.db
			.select({
				id: documents.id,
				content: documents.content,
				metadata: documents.metadata,
				score: similarity,
			})
			.from(documents)
			.orderBy(desc(similarity))
			.limit(topK);

		return rows.map((row) => ({
			document: {
				id: row.id,
				content: row.content,
				embedding: [],
				metadata: row.metadata as Record<string, unknown>,
			},
			score: row.score,
		}));
	}

	async count(): Promise<number> {
		const [row] = await this.db
			.select({ count: sql<number>`count(*)::int` })
			.from(documents);
		return row?.count ?? 0;
	}

	async close() {
		await this.client.close();
	}
}
