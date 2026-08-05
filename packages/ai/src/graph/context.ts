import type { StoredChunk } from "@frontdesk/db";
import type { AgentGraphDeps } from "./deps";

export function labelFor(chunk: StoredChunk): string {
	const title = chunk.metadata.title as string | undefined;
	if (title) return title;
	if (chunk.pageNum != null) return `Page ${chunk.pageNum}`;
	return chunk.id;
}

export async function fetchChunksByIds(
	deps: AgentGraphDeps,
	ids: string[],
): Promise<StoredChunk[]> {
	if (ids.length === 0) return [];
	return deps.chunkRepository.getByIds(ids);
}

export function formatContext(chunks: StoredChunk[]): string {
	return chunks
		.map((chunk) => `[${labelFor(chunk)}]\n${chunk.content}`)
		.join("\n\n");
}
