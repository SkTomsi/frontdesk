import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import type {
	ChildChunk,
	HierarchicalChunks,
	ParentChunk,
	ParsedDocument,
} from "./types";

export interface ChunkerConfig {
	parentChunkSize?: number;
	parentChunkOverlap?: number;
	childChunkSize?: number;
	childChunkOverlap?: number;
}

export class HierarchicalChunker {
	private parentSplitter: RecursiveCharacterTextSplitter;
	private childSplitter: RecursiveCharacterTextSplitter;

	constructor(config: ChunkerConfig = {}) {
		this.parentSplitter = new RecursiveCharacterTextSplitter({
			chunkSize: config.parentChunkSize ?? 2000,
			chunkOverlap: config.parentChunkOverlap ?? 200,
		});
		this.childSplitter = new RecursiveCharacterTextSplitter({
			chunkSize: config.childChunkSize ?? 500,
			chunkOverlap: config.childChunkOverlap ?? 50,
		});
	}

	async split(document: ParsedDocument): Promise<HierarchicalChunks> {
		const parents: ParentChunk[] = [];
		const children: ChildChunk[] = [];

		let parentIndex = 0;
		for (const page of document.pages) {
			const pageParentTexts = await this.parentSplitter.splitText(page.text);
			for (const content of pageParentTexts) {
				if (!content.trim()) continue;
				parents.push({
					id: crypto.randomUUID(),
					content,
					chunkIndex: parentIndex++,
					pageNum: page.pageNum,
					metadata: {},
				});
			}
		}

		let childIndex = 0;
		for (const parent of parents) {
			const childTexts = await this.childSplitter.splitText(parent.content);
			for (const content of childTexts) {
				if (!content.trim()) continue;
				children.push({
					id: crypto.randomUUID(),
					parentId: parent.id,
					content,
					chunkIndex: childIndex++,
					pageNum: parent.pageNum,
					metadata: {},
				});
			}
		}

		return { parents, children };
	}
}
