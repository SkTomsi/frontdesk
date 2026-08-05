export type StreamEvent =
	| { type: "meta"; source: string; chunkSize: number; totalChars: number; score: number }
	| { type: "assistant_delta"; text: string }
	| {
			type: "done";
			usage?: {
				totalInputTokens: number;
				totalOutputTokens: number;
				totalDurationMs: number;
			};
	  }
	| { type: "error"; message: string };

export async function* parseSSEStream(body: ReadableStream<Uint8Array>): AsyncGenerator<StreamEvent> {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";

	while (true) {
		const { value, done } = await reader.read();
		if (done) break;

		buffer += decoder.decode(value, { stream: true });
		const events = buffer.split("\n\n");
		buffer = events.pop() || "";

		for (const event of events) {
			if (!event.startsWith("data: ")) continue;
			yield JSON.parse(event.slice(6)) as StreamEvent;
		}
	}
}
