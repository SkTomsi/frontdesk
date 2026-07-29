export type StreamEvent =
	| { type: "meta"; source: string; chunkSize: number; totalChars: number; score: number }
	| { type: "assistant_delta"; text: string }
	| { type: "done" }
	| { type: "error"; message: string };

export function send(controller: ReadableStreamDefaultController, event: StreamEvent) {
	controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`));
}

export const CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

export const STREAM_HEADERS = {
	"Content-Type": "text/event-stream",
	"Cache-Control": "no-cache",
	"Access-Control-Allow-Origin": "*",
};
