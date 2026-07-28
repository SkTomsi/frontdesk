import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";

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
	persistPath?: string;
}

export class VectorStore {
	private documents: StoredDocument[] = [];
	private persistPath: string;

	constructor(config: VectorStoreConfig = {}) {
		this.persistPath = config.persistPath ?? "data/vector-store.json";
	}

	async load() {
		if (!existsSync(this.persistPath)) return;
		const data = await readFile(this.persistPath, "utf-8");
		this.documents = JSON.parse(data);
	}

	async save() {
		const dir = this.persistPath.split("/").slice(0, -1).join("/");
		if (dir) await mkdir(dir, { recursive: true });
		await writeFile(this.persistPath, JSON.stringify(this.documents, null, 2));
	}

	addDocuments(docs: StoredDocument[]) {
		this.documents.push(...docs);
	}

	similaritySearch(queryEmbedding: number[], topK: number = 3): SearchResult[] {
		return this.documents
			.map((doc) => ({
				document: doc,
				score: cosineSimilarity(queryEmbedding, doc.embedding),
			}))
			.sort((a, b) => b.score - a.score)
			.slice(0, topK);
	}

	count(): number {
		return this.documents.length;
	}
}

function cosineSimilarity(a: number[], b: number[]): number {
	let dot = 0,
		normA = 0,
		normB = 0;
	for (let i = 0; i < a.length; i++) {
		dot += a[i]! * b[i]!;
		normA += a[i]! * a[i]!;
		normB += b[i]! * b[i]!;
	}
	return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
