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
}

export interface ChildChunk {
	id: string;
	parentId: string;
	content: string;
	chunkIndex: number;
	pageNum: number | null;
	metadata: Record<string, unknown>;
}

export interface HierarchicalChunks {
	parents: ParentChunk[];
	children: ChildChunk[];
}
