"use client";

import { useState } from "react";
import { AppHeader } from "@/components/app-header";
import { ChatInput } from "@/components/chat/chat-input";
import type { RetrievalMode } from "@/components/chat/mode-switcher";
import type { MessageData } from "@/components/chat/message-list";
import { MessageList } from "@/components/chat/message-list";
import { parseSSEStream } from "@/lib/sse";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3003";

let nextId = 1;

export default function Home() {
	const [messages, setMessages] = useState<MessageData[]>([]);
	const [input, setInput] = useState("");
	const [streaming, setStreaming] = useState(false);
	const [thinking, setThinking] = useState(false);
	const [mode, setMode] = useState<RetrievalMode>("graph");

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
		setThinking(true);

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
			const endpoint = mode === "simple" ? "/api/ask/simple" : "/api/ask";
			const res = await fetch(`${API_BASE}${endpoint}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ question }),
			});

			if (!res.ok || !res.body) throw new Error("Request failed");

			for await (const ev of parseSSEStream(res.body)) {
				switch (ev.type) {
					case "assistant_delta":
						setThinking(false);
						update((prev) => ({ content: prev.content + ev.text }));
						break;
					case "meta":
						update((prev) => ({
							sources: [...(prev.sources || []), { title: ev.source, score: ev.score }],
						}));
						break;
					case "done":
						setThinking(false);
						update({ usage: ev.usage });
						break;
					case "error":
						setThinking(false);
						update({ content: "Sorry, something went wrong." });
						break;
				}
			}
		} catch {
			setThinking(false);
			update({ content: "Sorry, something went wrong." });
		} finally {
			setThinking(false);
			setStreaming(false);
		}
	}

	return (
		<div className="flex h-dvh flex-col">
			<AppHeader />
			<MessageList
				messages={messages}
				streaming={streaming}
				thinking={thinking}
				onSuggestion={(q) => setInput(q)}
			/>
			<ChatInput
				value={input}
				onChange={setInput}
				onSubmit={handleSubmit}
				disabled={streaming}
				mode={mode}
				onModeChange={setMode}
			/>
		</div>
	);
}
