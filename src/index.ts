import * as readline from "node:readline";
import { sampleDocuments } from "./data/sample-docs";
import { Llm } from "./llm";
import { SupportAnswer } from "./schemas";
import { EmbeddingService } from "./services/embeddings";
import { TextSplitter } from "./services/text-splitter";
import { VectorStore } from "./services/vector-store";

const llm = new Llm();
const embeddings = new EmbeddingService({ model: "gemini-embedding-2" });
const splitter = new TextSplitter({ chunkSize: 300, chunkOverlap: 50 });
const vectorStore = new VectorStore();

async function ingestDocuments() {
	await vectorStore.load();

	if (vectorStore.count() > 0) {
		console.log(`Loaded ${vectorStore.count()} documents from cache.`);
		return;
	}

	console.log("Splitting documents...");
	const chunks = await splitter.splitDocuments(sampleDocuments);
	console.log(`Created ${chunks.length} chunks.`);

	console.log("Generating embeddings...");
	const vectors = await embeddings.embedDocuments(chunks.map((c) => c.text));

	vectorStore.addDocuments(
		chunks.map((chunk, i) => ({
			id: `doc-${i}`,
			content: chunk.text,
			embedding: vectors[i]!,
			metadata: chunk.metadata,
		})),
	);

	await vectorStore.save();
	console.log("Done.\n");
}

async function answerQuestion(question: string) {
	const queryEmbedding = await embeddings.embedQuery(question);
	const results = vectorStore.similaritySearch(queryEmbedding, 3);

	const context = results
		.map(
			(r, i) =>
				`[Source ${i + 1}] (score: ${r.score.toFixed(3)})\n${r.document.content}`,
		)
		.join("\n\n");

	const prompt = `You are Northwind support. Answer using ONLY the context below.
If the context doesn't cover the question, say so and set needsHumanReview true.

CONTEXT:
${context}

QUESTION:
${question}`;

	const structuredModel = llm.withStructuredOutput(SupportAnswer, {
		name: "support-answer",
	});

	return structuredModel.invoke(prompt);
}

async function main() {
	await ingestDocuments();

	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
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
			} catch (err) {
				console.error("Error:", err);
			}

			prompt();
		});
	};

	prompt();
}

main();
