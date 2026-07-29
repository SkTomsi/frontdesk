"use client";

import { useState } from "react";
import { ChatHeader } from "@/components/chat/chat-header";
import { ChatInput } from "@/components/chat/chat-input";
import type { MessageData } from "@/components/chat/message-list";
import { MessageList } from "@/components/chat/message-list";
import { parseSSEStream } from "@/lib/sse";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3003";

let nextId = 1;

export default function Home() {
	const [messages, setMessages] = useState<MessageData[]>([]);
	const [input, setInput] = useState("");
	const [streaming, setStreaming] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!input.trim() || streaming) return;

		const question = input;
		setInput("");

		const assistantId = String(nextId++);
		setMessages((prev) => [
			...prev,
			{ id: String(nextId++), role: "user", content: question },
			{ id: assistantId, role: "assistant", content: "" },
		]);
		setStreaming(true);

		const update = (
			patch:
				| Partial<MessageData>
				| ((prev: MessageData) => Partial<MessageData>),
		) =>
			setMessages((prev) =>
				prev.map((msg) =>
					msg.id === assistantId
						? { ...msg, ...(typeof patch === "function" ? patch(msg) : patch) }
						: msg,
				),
			);

		try {
			const res = await fetch(`${API_BASE}/api/ask`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ question }),
			});

			if (!res.ok || !res.body) throw new Error("Request failed");

			for await (const ev of parseSSEStream(res.body)) {
				switch (ev.type) {
					case "assistant_delta":
						update((prev) => ({ content: prev.content + ev.text }));
						break;
					case "meta":
						update((prev) => ({
							sources: [...(prev.sources || []), ev.source],
						}));
						break;
					case "error":
						update({ content: "Sorry, something went wrong." });
						break;
				}
			}
		} catch {
			update({ content: "Sorry, something went wrong." });
		} finally {
			setStreaming(false);
		}
	}

	return (
		<div className="flex h-dvh flex-col border border-x">
			<ChatHeader />
			<MessageList messages={messages} />
			<ChatInput
				value={input}
				onChange={setInput}
				onSubmit={handleSubmit}
				disabled={streaming}
			/>
		</div>
	);
}
