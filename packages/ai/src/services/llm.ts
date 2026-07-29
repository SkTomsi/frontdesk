import type { StructuredOutputMethodOptions } from "@langchain/core/language_models/base";
import type { BaseMessage } from "@langchain/core/messages";
import { ChatGroq } from "@langchain/groq";

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

	withStructuredOutput(
		schema: Parameters<ChatGroq["withStructuredOutput"]>[0],
		config?: StructuredOutputMethodOptions,
	) {
		return this.client.withStructuredOutput(schema, config);
	}
}
