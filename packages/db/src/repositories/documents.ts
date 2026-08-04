import { and, desc, eq } from "drizzle-orm";
import { createDb } from "../index";
import { documents } from "../schema";

export type DocumentStatus = "queued" | "processing" | "completed" | "failed";

export interface DocumentRecord {
	id: string;
	tenantId: string;
	filename: string;
	contentType: string;
	sizeBytes: number;
	contentHash: string;
	objectKey: string;
	status: DocumentStatus;
	chunkCount: number | null;
	error: string | null;
	isActive: boolean;
	createdAt: Date;
	completedAt: Date | null;
}

export type NewDocument = Pick<
	DocumentRecord,
	"id" | "tenantId" | "filename" | "contentType" | "sizeBytes" | "contentHash" | "objectKey"
>;

export interface DocumentStatusUpdate {
	status: DocumentStatus;
	chunkCount?: number | null;
	error?: string | null;
	completedAt?: Date | null;
}

function toRecord(row: typeof documents.$inferSelect): DocumentRecord {
	return {
		id: row.id,
		tenantId: row.tenantId,
		filename: row.filename,
		contentType: row.contentType,
		sizeBytes: row.sizeBytes,
		contentHash: row.contentHash,
		objectKey: row.objectKey,
		status: row.status as DocumentStatus,
		chunkCount: row.chunkCount,
		error: row.error,
		isActive: row.isActive,
		createdAt: row.createdAt,
		completedAt: row.completedAt,
	};
}

export class DocumentRepository {
	private db: ReturnType<typeof createDb>["db"];

	constructor(databaseUrl?: string) {
		this.db = createDb(databaseUrl).db;
	}

	async create(input: NewDocument): Promise<DocumentRecord> {
		const [row] = await this.db
			.insert(documents)
			.values({
				id: input.id,
				tenantId: input.tenantId,
				filename: input.filename,
				contentType: input.contentType,
				sizeBytes: input.sizeBytes,
				contentHash: input.contentHash,
				objectKey: input.objectKey,
			})
			.returning();
		return toRecord(row!);
	}

	async getById(id: string): Promise<DocumentRecord | null> {
		const rows = await this.db
			.select()
			.from(documents)
			.where(eq(documents.id, id))
			.limit(1);
		const row = rows[0];
		return row ? toRecord(row) : null;
	}

	async findActiveByHash(
		tenantId: string,
		contentHash: string,
	): Promise<DocumentRecord | null> {
		const rows = await this.db
			.select()
			.from(documents)
			.where(
				and(
					eq(documents.tenantId, tenantId),
					eq(documents.contentHash, contentHash),
					eq(documents.isActive, true),
				),
			)
			.limit(1);
		const row = rows[0];
		return row ? toRecord(row) : null;
	}

	async setStatus(id: string, update: DocumentStatusUpdate): Promise<void> {
		await this.db
			.update(documents)
			.set({
				status: update.status,
				chunkCount:
					update.chunkCount === undefined ? undefined : update.chunkCount,
				error: update.error === undefined ? undefined : update.error,
				completedAt:
					update.completedAt === undefined ? undefined : update.completedAt,
			})
			.where(eq(documents.id, id));
	}

	async listByTenant(
		tenantId: string,
		options: { status?: DocumentStatus; limit?: number; offset?: number } = {},
	): Promise<DocumentRecord[]> {
		const conditions = [eq(documents.tenantId, tenantId), eq(documents.isActive, true)];
		if (options.status) {
			conditions.push(eq(documents.status, options.status));
		}
		const rows = await this.db
			.select()
			.from(documents)
			.where(and(...conditions))
			.orderBy(desc(documents.createdAt))
			.limit(options.limit ?? 100)
			.offset(options.offset ?? 0);
		return rows.map(toRecord);
	}

	async deleteById(tenantId: string, id: string): Promise<boolean> {
		const rows = await this.db
			.delete(documents)
			.where(and(eq(documents.id, id), eq(documents.tenantId, tenantId)))
			.returning({ id: documents.id });
		return rows.length > 0;
	}
}
