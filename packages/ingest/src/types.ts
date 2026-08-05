export interface ParsedPage {
	pageNum: number;
	text: string;
}

export interface ParsedDocument {
	pages: ParsedPage[];
	fullText: string;
}

export interface ParentChunk {
	id: string;
	content: string;
	chunkIndex: number;
	pageNum: number | null;
	metadata: Record<string, unknown>;
	embedding?: null;
}

export interface ChildChunk {
	id: string;
	parentId: string;
	content: string;
	chunkIndex: number;
	pageNum: number | null;
	metadata: Record<string, unknown>;
	/** Averaged sentence embedding — written directly to the vector store. */
	embedding?: number[];
}

export interface HierarchicalChunks {
	parents: ParentChunk[];
	children: ChildChunk[];
}
