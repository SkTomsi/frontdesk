import { config as aiConfig, type EmbeddingService } from "@frontdesk/ai";
import type {
	ChildChunk,
	HierarchicalChunks,
	ParentChunk,
	ParsedDocument,
} from "./types";

export interface ChunkerConfig {
	parentTargetChars?: number;
	parentMinChars?: number;
	parentMaxChars?: number;
	parentSimilarityThreshold?: number;
	childTargetChars?: number;
	childMinChars?: number;
	childMaxChars?: number;
	childSimilarityThreshold?: number;
}

interface GroupOpts {
	target: number;
	min: number;
	max: number;
	threshold: number;
}

/**
 * Semantic chunker: sentences are embedded once, then greedily grouped into
 * parents (and children within them) breaking where consecutive-sentence
 * similarity drops below a threshold while respecting size bounds. Child
 * embeddings are the mean of their sentences, so no second embedding pass.
 */
export class HierarchicalChunker {
	private embeddingService: EmbeddingService;
	private parentOpts: GroupOpts;
	private childOpts: GroupOpts;

	constructor(
		config: ChunkerConfig & { embeddingService: EmbeddingService },
	) {
		this.embeddingService = config.embeddingService;
		this.parentOpts = {
			target: config.parentTargetChars ?? aiConfig.SEMANTIC_PARENT.target,
			min: config.parentMinChars ?? aiConfig.SEMANTIC_PARENT.min,
			max: config.parentMaxChars ?? aiConfig.SEMANTIC_PARENT.max,
			threshold:
				config.parentSimilarityThreshold ??
				aiConfig.SEMANTIC_PARENT.threshold,
		};
		this.childOpts = {
			target: config.childTargetChars ?? aiConfig.SEMANTIC_CHILD.target,
			min: config.childMinChars ?? aiConfig.SEMANTIC_CHILD.min,
			max: config.childMaxChars ?? aiConfig.SEMANTIC_CHILD.max,
			threshold:
				config.childSimilarityThreshold ?? aiConfig.SEMANTIC_CHILD.threshold,
		};
	}

	async split(document: ParsedDocument): Promise<HierarchicalChunks> {
		const parents: ParentChunk[] = [];
		const children: ChildChunk[] = [];
		let parentIndex = 0;
		let childIndex = 0;

		for (const page of document.pages) {
			const sentences = splitSentences(page.text);
			if (sentences.length === 0) continue;

			const embeddings = await this.embeddingService.embedDocuments(sentences);
			const parentGroups = this.groupBySimilarity(
				sentences,
				embeddings,
				this.parentOpts,
			);

			for (const parentGroup of parentGroups) {
				const parentSentences = parentGroup.map((i) => sentences[i]!);
				const parentEmbeddings = parentGroup.map((i) => embeddings[i]!);
				const parentText = parentSentences.join(" ");
				if (!parentText.trim()) continue;

				const parentId = crypto.randomUUID();
				parents.push({
					id: parentId,
					content: parentText,
					chunkIndex: parentIndex++,
					pageNum: page.pageNum,
					metadata: {},
				});

				const childGroups = this.groupBySimilarity(
					parentSentences,
					parentEmbeddings,
					this.childOpts,
				);
				for (const childGroup of childGroups) {
					const childText = childGroup
						.map((i) => parentSentences[i]!)
						.join(" ");
					if (!childText.trim()) continue;
					children.push({
						id: crypto.randomUUID(),
						parentId,
						content: childText,
						chunkIndex: childIndex++,
						pageNum: page.pageNum,
						metadata: {},
						embedding: this.averageEmbedding(
							childGroup.map((i) => parentEmbeddings[i]!),
						),
					});
				}
			}
		}

		return { parents, children };
	}

	/** Greedily groups sentence indices, breaking on similarity drops + size bounds. */
	private groupBySimilarity(
		sentences: string[],
		embeddings: number[][],
		opts: GroupOpts,
	): number[][] {
		const groups: number[][] = [];
		let current: number[] = [];
		let currentChars = 0;

		for (let i = 0; i < sentences.length; i++) {
			const sentence = sentences[i]!;
			const shouldBreak =
				current.length > 0 &&
				currentChars >= opts.min &&
				(currentChars + sentence.length > opts.max ||
					cosine(embeddings[i - 1]!, embeddings[i]!) < opts.threshold);

			if (shouldBreak) {
				groups.push(current);
				current = [];
				currentChars = 0;
			}
			current.push(i);
			currentChars += sentence.length;
		}

		if (current.length > 0) groups.push(current);
		return groups;
	}

	private averageEmbedding(vectors: number[][]): number[] {
		const dim = vectors[0]?.length ?? 0;
		if (dim === 0) return [];
		const sum = new Array<number>(dim).fill(0);
		for (const v of vectors) {
			for (let i = 0; i < dim; i++) sum[i]! += v[i]!;
		}
		return sum.map((s) => s / vectors.length);
	}
}

function splitSentences(text: string): string[] {
	return text
		.split(/(?<=[.!?])\s+|\n+/)
		.map((s) => s.trim())
		.filter(Boolean);
}

function cosine(a: number[], b: number[]): number {
	if (a.length === 0 || a.length !== b.length) return 0;
	let dot = 0;
	let na = 0;
	let nb = 0;
	for (let i = 0; i < a.length; i++) {
		dot += a[i]! * b[i]!;
		na += a[i]! * a[i]!;
		nb += b[i]! * b[i]!;
	}
	const denom = Math.sqrt(na) * Math.sqrt(nb);
	return denom === 0 ? 0 : dot / denom;
}
