import type {
	EmbeddingService,
	SearchResult,
	VectorStore,
} from "@frontdesk/ai";
import type { ChunkRepository } from "@frontdesk/db";

const SIMILARITY_THRESHOLD = 0.7;

interface RetrievalResult {
	results: SearchResult[];
	context: string;
}

function normalizeScore(raw: number): number {
	return raw ** 0.45;
}

export async function retrieveContext(
	question: string,
	embeddings: EmbeddingService,
	vectorStore: VectorStore,
	chunkRepository: ChunkRepository,
	tenantId?: string,
): Promise<RetrievalResult> {
	const queryEmbedding = await embeddings.embedQuery(question);
	const results = await vectorStore.similaritySearch(queryEmbedding, 3, tenantId);

	const normalized = results.map((r) => ({
		...r,
		score: normalizeScore(r.score),
	}));

	const relevant = normalized.filter((r) => r.score >= SIMILARITY_THRESHOLD);

	const parentIds = [
		...new Set(
			relevant
				.map((r) => r.document.parentId)
				.filter((id): id is string => Boolean(id)),
		),
	];
	const parents =
		parentIds.length > 0
			? await chunkRepository.getParentsByIds(parentIds)
			: [];

	if (parents.length > 0) {
		const context = parents
			.map((parent) => {
				const label =
					(parent.metadata.title as string) ||
					(parent.pageNum != null ? `Page ${parent.pageNum}` : parent.id);
				return `[${label}]\n${parent.content}`;
			})
			.join("\n\n");
		return { results: relevant, context };
	}

	const context = relevant
		.map((r) => {
			const label = (r.document.metadata.title as string) || r.document.id;
			return `[${label}] (score: ${r.score.toFixed(3)})\n${r.document.content}`;
		})
		.join("\n\n");
	return { results: relevant, context };
}
