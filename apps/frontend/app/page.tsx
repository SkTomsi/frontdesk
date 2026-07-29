"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker";
import {
	Message,
	MessageAvatar,
	MessageContent,
} from "@/components/ui/message";
import {
	MessageScroller,
	MessageScrollerButton,
	MessageScrollerContent,
	MessageScrollerItem,
	MessageScrollerProvider,
	MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Spinner } from "@/components/ui/spinner";

interface Source {
	title: string;
	score: number;
}

interface MessageData {
	id: string;
	role: "user" | "assistant";
	content: string;
	sources?: Source[];
}

interface AskResponse {
	answer: string;
	confidence: string;
	needsHumanReview: boolean;
	score: number;
	citedSources: string[];
	sources: Source[];
}

let nextId = 1;

function BotAvatar() {
	return (
		<Avatar className="size-8">
			<AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
				AI
			</AvatarFallback>
		</Avatar>
	);
}

function UserAvatar() {
	return (
		<Avatar className="size-8">
			<AvatarFallback className="bg-muted-foreground/20 text-muted-foreground text-xs">
				U
			</AvatarFallback>
		</Avatar>
	);
}

function SourceBadges({ sources }: { sources: Source[] }) {
	return (
		<div className="flex flex-wrap gap-1.5">
			{sources.map((s, i) => (
				<span
					key={i}
					className="inline-flex items-center gap-1 rounded-full bg-secondary/50 px-2 py-0.5 text-[11px] text-muted-foreground"
				>
					<span className="size-1.5 rounded-full bg-secondary-foreground/40" />
					{s.title}
				</span>
			))}
		</div>
	);
}

function EmptyState() {
	return (
		<div className="flex flex-col items-center justify-center h-full text-center px-4">
			<div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
				<svg
					className="size-8 text-primary"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={1.5}
						d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
					/>
				</svg>
			</div>
			<h2 className="text-lg font-semibold mb-1">Ask me anything</h2>
			<p className="text-sm text-muted-foreground max-w-sm">
				I can answer questions about Northwind—plans, features, exports, teams,
				and more.
			</p>
		</div>
	);
}

function LoadingMessage() {
	return (
		<MessageScrollerItem>
			<Marker role="status">
				<MarkerIcon>
					<Spinner />
				</MarkerIcon>
				<MarkerContent className="shimmer">Thinking...</MarkerContent>
			</Marker>
		</MessageScrollerItem>
	);
}

export default function Home() {
	const [messages, setMessages] = useState<MessageData[]>([]);
	const [input, setInput] = useState("");

	const askMutation = useMutation({
		mutationFn: async (question: string): Promise<AskResponse> => {
			const res = await fetch("/api/ask", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ question }),
			});
			return res.json();
		},
		onSuccess: (data) => {
			setMessages((prev) => [
				...prev,
				{
					id: String(nextId++),
					role: "assistant",
					content: data.answer,
					sources: data.sources,
				},
			]);
		},
	});

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!input.trim() || askMutation.isPending) return;
		setMessages((prev) => [
			...prev,
			{ id: String(nextId++), role: "user", content: input },
		]);
		askMutation.mutate(input);
		setInput("");
	}

	return (
		<div className="flex h-dvh flex-col">
			<header className="border-b px-4 py-3 shrink-0">
				<div className="flex items-center gap-3 max-w-3xl mx-auto">
					<div className="size-9 rounded-lg bg-primary flex items-center justify-center">
						<svg
							className="size-5 text-primary-foreground"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={1.5}
								d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
							/>
						</svg>
					</div>
					<div>
						<h1 className="text-sm font-semibold">Frontdesk</h1>
						<p className="text-xs text-muted-foreground">AI-powered support</p>
					</div>
				</div>
			</header>

			<MessageScrollerProvider autoScroll scrollPreviousItemPeek={64}>
				<MessageScroller className="flex-1">
					<MessageScrollerViewport className="max-w-3xl mx-auto py-8 px-4">
						<MessageScrollerContent>
							{messages.length === 0 && (
								<MessageScrollerItem>
									<EmptyState />
								</MessageScrollerItem>
							)}
							{messages.map((msg) => (
								<MessageScrollerItem
									key={msg.id}
									messageId={msg.id}
									scrollAnchor={msg.role === "user"}
								>
									<Message align={msg.role === "user" ? "end" : "start"}>
										<MessageAvatar>
											{msg.role === "user" ? <UserAvatar /> : <BotAvatar />}
										</MessageAvatar>
										<MessageContent>
											<Bubble
												variant={msg.role === "user" ? "default" : "secondary"}
											>
												<BubbleContent className="rounded-2xl p-4 text-sm">
													{msg.content}
												</BubbleContent>
											</Bubble>
											{msg.sources && msg.sources.length > 0 && (
												<SourceBadges sources={msg.sources} />
											)}
										</MessageContent>
									</Message>
								</MessageScrollerItem>
							))}
							{askMutation.isPending && <LoadingMessage />}
						</MessageScrollerContent>
					</MessageScrollerViewport>
					<MessageScrollerButton />
				</MessageScroller>
			</MessageScrollerProvider>

			<div className="border-t p-4 shrink-0">
				<form onSubmit={handleSubmit} className="flex gap-2 max-w-3xl mx-auto">
					<Input
						value={input}
						onChange={(e) => setInput(e.target.value)}
						placeholder="Ask a question..."
						disabled={askMutation.isPending}
						className="rounded-xl"
					/>
					<Button
						type="submit"
						disabled={askMutation.isPending}
						className="rounded-xl px-5"
					>
						Send
					</Button>
				</form>
			</div>
		</div>
	);
}
