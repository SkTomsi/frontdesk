import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

interface TextSplitterConfig {
	chunkSize?: number;
	chunkOverlap?: number;
}

export interface SplitDocument {
	text: string;
	metadata: Record<string, unknown>;
}

export class TextSplitter {
	private chunkSize: number;
	private chunkOverlap: number;

	constructor(config: TextSplitterConfig = {}) {
		this.chunkSize = config.chunkSize ?? 500;
		this.chunkOverlap = config.chunkOverlap ?? 50;
	}

	async splitDocuments(docs: SplitDocument[]): Promise<SplitDocument[]> {
		const splitter = new RecursiveCharacterTextSplitter({
			chunkSize: this.chunkSize,
			chunkOverlap: this.chunkOverlap,
		});

		const chunks: SplitDocument[] = [];

		for (const doc of docs) {
			const splits = await splitter.splitText(doc.text);
			for (const split of splits) {
				chunks.push({ text: split, metadata: doc.metadata });
			}
		}

		return chunks;
	}

	async splitText(text: string): Promise<string[]> {
		const splitter = new RecursiveCharacterTextSplitter({
			chunkSize: this.chunkSize,
			chunkOverlap: this.chunkOverlap,
		});
		return splitter.splitText(text);
	}
}
