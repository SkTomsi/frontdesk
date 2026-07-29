import * as readline from "node:readline";
import { config } from "./config";
import { sampleDocuments } from "./data/sample-docs";
import { supportPrompt } from "./prompts";
import { SupportAnswer } from "./schemas";
import { EmbeddingService } from "./services/embeddings";
import { Llm } from "./services/llm";
import { TextSplitter } from "./services/text-splitter";
import { VectorStore } from "./services/vector-store";

const llm = new Llm({
	model: config.LLM_MODEL,
});
const embeddings = new EmbeddingService({ model: config.EMBEDDING_MODEL });
const splitter = new TextSplitter({
	chunkSize: config.CHUNK_SIZE,
	chunkOverlap: config.CHUNK_OVERLAP,
});
const vectorStore = new VectorStore();

const structuredModel = llm.withStructuredOutput(SupportAnswer, {
	name: "support-answer",
});

async function ingestDocuments() {
	await vectorStore.initialize();

	const count = await vectorStore.count();
	if (count > 0) {
		console.log(`Connected to pgvector — ${count} documents already indexed.`);
		return;
	}

	console.log("Splitting documents...");
	const chunks = await splitter.splitDocuments(sampleDocuments);
	console.log(`Created ${chunks.length} chunks.`);

	console.log("Generating embeddings...");
	const vectors = await embeddings.embedDocuments(chunks.map((c) => c.text));

	await vectorStore.addDocuments(
		chunks.map((chunk, i) => ({
			id: `doc-${i}`,
			content: chunk.text,
			embedding: vectors[i]!,
			metadata: chunk.metadata,
		})),
	);

	console.log("Done.\n");
}

async function answerQuestion(question: string) {
	const queryEmbedding = await embeddings.embedQuery(question);
	const results = await vectorStore.similaritySearch(queryEmbedding, 3);

	const context = results
		.map(
			(r, i) =>
				`[Source ${i + 1}] (score: ${r.score.toFixed(3)})\n${r.document.content}`,
		)
		.join("\n\n");

	const prompt = supportPrompt({ context, question });
	return structuredModel.invoke(prompt);
}

async function main() {
	await ingestDocuments();

	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	rl.on("close", () => {
		vectorStore.close();
		console.log("Goodbye.");
		process.exit(0);
	});

	console.log("Frontdesk RAG ready. Ask a question (type 'exit' to quit).\n");

	const prompt = () => {
		rl.question("You: ", async (input) => {
			const question = input.trim();
			if (question === "exit" || question === "quit") {
				rl.close();
				return;
			}

			if (!question) {
				prompt();
				return;
			}

			try {
				const answer = await answerQuestion(question);
				console.log(`\nAgent: ${answer.answer}`);
				console.log(`  Confidence: ${answer.confidence}`);
				console.log(`  Sources: ${answer.citedSources.join(", ")}`);
				console.log(`  Needs review: ${answer.needsHumanReview}\n`);
				console.log(`  Score: ${answer.score}\n`);
			} catch (err) {
				console.error("Error:", err instanceof Error ? err.message : err);
			}

			prompt();
		});
	};

	prompt();
}

main();
