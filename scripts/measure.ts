/**
 * Measure script — fires a fixed set of questions at the running API and prints
 * a per-node token breakdown from the `done` SSE event.
 *
 * Usage:  bun run measure [--questions n]
 * Env:    API_URL (default http://localhost:3003), X-TENANT-ID (default default)
 */
import { performance } from "node:perf_hooks";

const API_BASE = process.env.API_URL ?? "http://localhost:3003";
const TENANT = process.env.X_TENANT_ID ?? "default";
const endpointArg = process.argv.indexOf("--endpoint");
const RAG_PATH = endpointArg !== -1 && process.argv[endpointArg + 1] === "simple"
	? "/api/ask/simple"
	: "/api/ask";

const QUESTIONS = [
	"What did Tomcy do at BrewlabsHQ?",
	"Which open source projects has Tomcy contributed to?",
	"What are Tomcy's contact details?",
	"What is Tomcy's current role?",
	"How long did Tomcy work at BrewlabsHQ?",
	"What bounty did Tomcy win on Superteam Earn?",
	"What does Tomcy say about onboarding UI work?",
	"Which platforms is Tomcy active on?",
	"Where can I find Tomcy's portfolio?",
	"What is Tomcy's email address?",
];

/** Free tier caps at 8000 tokens/min; pace the asks so consecutive ones don't 429. */
const ASK_DELAY_MS = 20_000;

interface NodeUsage {
	node: string;
	inputTokens: number;
	outputTokens: number;
	durationMs: number;
	calls: number;
}

interface UsageSummary {
	totalInputTokens: number;
	totalOutputTokens: number;
	totalDurationMs: number;
	nodes: Record<string, NodeUsage>;
}

interface AskResult {
	question: string;
	answerLength: number;
	latencyMs: number;
	usage: UsageSummary;
	error?: string;
}

function emptyUsage(): UsageSummary {
	return { totalInputTokens: 0, totalOutputTokens: 0, totalDurationMs: 0, nodes: {} };
}

async function ask(question: string): Promise<AskResult> {
	const started = performance.now();
	const res = await fetch(`${API_BASE}${RAG_PATH}`, {
		method: "POST",
		headers: { "Content-Type": "application/json", "X-Tenant-ID": TENANT },
		body: JSON.stringify({ question }),
	});
	if (!res.ok || !res.body) throw new Error(`ask failed: ${res.status}`);

	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	let answerLength = 0;
	let usage: UsageSummary | undefined;

	while (true) {
		const { value, done } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		const events = buffer.split("\n\n");
		buffer = events.pop() ?? "";
		for (const ev of events) {
			if (!ev.startsWith("data: ")) continue;
			const data = JSON.parse(ev.slice(6)) as Record<string, unknown>;
			if (data.type === "assistant_delta") {
				answerLength += String(data.text ?? "").length;
			}
			if (data.type === "done" && typeof data.usage === "object" && data.usage) {
				usage = data.usage as UsageSummary;
			}
		}
	}

	return {
		question,
		answerLength,
		latencyMs: Math.round(performance.now() - started),
		usage: usage ?? emptyUsage(),
	};
}

function pad(s: string, width: number): string {
	return s.length >= width ? s : s + " ".repeat(width - s.length);
}

function printTable(results: AskResult[]): void {
	const cols = ["#", "question", "in", "out", "ratio", "ms", "ansChars"];
	const widths = [3, 42, 8, 8, 8, 8, 9];
	const header = cols.map((c, i) => pad(c, widths[i]!)).join(" | ");
	console.log(header);
	console.log("-".repeat(header.length));

	for (const [i, r] of results.entries()) {
		const label = r.question.length > 40 ? `${r.question.slice(0, 37)}...` : r.question;
		const ratio = r.usage.totalInputTokens > 0
			? (r.usage.totalOutputTokens / r.usage.totalInputTokens).toFixed(2)
			: "n/a";
		const row = [
			String(i + 1),
			label,
			String(r.usage.totalInputTokens),
			String(r.usage.totalOutputTokens),
			ratio,
			String(r.latencyMs),
			r.error ?? String(r.answerLength),
		];
		console.log(row.map((v, j) => pad(v, widths[j]!)).join(" | "));
	}
}

function printTotals(results: AskResult[]): void {
	const ok = results.filter((r) => !r.error);
	const sum = (pick: (u: UsageSummary) => number) =>
		ok.reduce((acc, r) => acc + pick(r.usage), 0);
	const avgInput = Math.round(sum((u) => u.totalInputTokens) / Math.max(ok.length, 1));
	const avgOutput = Math.round(sum((u) => u.totalOutputTokens) / Math.max(ok.length, 1));

	console.log("\nAggregates (successful asks):");
	console.log(`  questions: ${ok.length}`);
	console.log(`  avg input tokens/turn:  ${avgInput}`);
	console.log(`  avg output tokens/turn: ${avgOutput}`);
	console.log(`  in:out ratio:           ${avgInput > 0 ? (avgOutput / avgInput).toFixed(3) : "n/a"}`);

	const nodes = new Map<string, NodeUsage>();
	for (const r of ok) {
		for (const n of Object.values(r.usage.nodes)) {
			const prev =
				nodes.get(n.node) ??
				({ node: n.node, inputTokens: 0, outputTokens: 0, durationMs: 0, calls: 0 } satisfies NodeUsage);
			prev.inputTokens += n.inputTokens;
			prev.outputTokens += n.outputTokens;
			prev.durationMs += n.durationMs;
			prev.calls += n.calls;
			nodes.set(n.node, prev);
		}
	}

	console.log("\nPer-node totals:");
	const rows = [...nodes.values()].sort((a, b) => b.inputTokens - a.inputTokens);
	for (const n of rows) {
		console.log(
			`  ${pad(n.node, 20)} in=${String(n.inputTokens).padStart(6)} out=${String(n.outputTokens).padStart(6)} calls=${n.calls} ms=${n.durationMs}`,
		);
	}
}

async function main(): Promise<void> {
	const argv = new Set(process.argv.slice(2));
	let n = QUESTIONS.length;
	const nIdx = process.argv.indexOf("--questions");
	if (nIdx !== -1 && process.argv[nIdx + 1]) {
		n = Math.min(Math.max(parseInt(process.argv[nIdx + 1]!, 10), 1), QUESTIONS.length);
	}

	console.log(
		`Measuring against ${API_BASE}${RAG_PATH} (tenant "${TENANT}"), ${n} question(s)...\n`,
	);

	const results: AskResult[] = [];
	for (const [i, q] of QUESTIONS.slice(0, n).entries()) {
		process.stdout.write(`  ${q.slice(0, 60)}... `);
		try {
			const r = await ask(q);
			results.push(r);
			console.log(`ok (${r.usage.totalInputTokens} in / ${r.usage.totalOutputTokens} out)`);
		} catch (err) {
			results.push({ question: q, answerLength: 0, latencyMs: 0, usage: emptyUsage(), error: String(err) });
			console.log("FAILED");
		}
		if (i < n - 1) await Bun.sleep(ASK_DELAY_MS);
	}

	console.log("\n");
	printTable(results);
	printTotals(results);
	console.log("");
}

await main();
