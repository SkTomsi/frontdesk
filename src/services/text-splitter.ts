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
	private splitter: RecursiveCharacterTextSplitter;

	constructor(config: TextSplitterConfig = {}) {
		this.splitter = new RecursiveCharacterTextSplitter({
			chunkSize: config.chunkSize ?? 500,
			chunkOverlap: config.chunkOverlap ?? 50,
		});
	}

	async splitDocuments(docs: SplitDocument[]): Promise<SplitDocument[]> {
		const chunks: SplitDocument[] = [];

		for (const doc of docs) {
			const splits = await this.splitter.splitText(doc.text);
			for (const split of splits) {
				chunks.push({ text: split, metadata: doc.metadata });
			}
		}

		return chunks;
	}

	async splitText(text: string): Promise<string[]> {
		return this.splitter.splitText(text);
	}
}
