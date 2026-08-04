import type { BaseMessage } from "@langchain/core/messages";
import type { Runnable } from "@langchain/core/runnables";
import { ChatGroq } from "@langchain/groq";
import type { z } from "zod";

interface LlmConfig {
	apiKey?: string;
	model?: string;
	temperature?: number;
}

export class Llm {
	private client: ChatGroq;

	constructor(config: LlmConfig = {}) {
		this.client = new ChatGroq({
			apiKey: config.apiKey ?? process.env.GROQ_API_KEY!,
			model: config.model ?? "openai/gpt-oss-120b",
			temperature: config.temperature ?? 0,
		});
	}

	async invoke(input: string | BaseMessage[]) {
		return this.client.invoke(input);
	}

	async stream(input: string | BaseMessage[]) {
		const stream = await this.client.stream(input);
		return stream;
	}

	structured<T extends z.ZodTypeAny>(schema: T): Runnable {
		return this.client.withStructuredOutput(schema, { method: "jsonMode" });
	}
}
