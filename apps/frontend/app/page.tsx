"use client";

import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

interface Source {
	title: string;
	score: number;
}

interface Message {
	role: "user" | "assistant";
	content: string;
	sources?: Source[];
	confidence?: string;
}

interface AskResponse {
	answer: string;
	confidence: string;
	needsHumanReview: boolean;
	score: number;
	citedSources: string[];
	sources: Source[];
}

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

function ShimmerBubble() {
	return (
		<div className="flex items-start gap-3">
			<BotAvatar />
			<div className="space-y-2 flex-1 max-w-[80%]">
				<Skeleton className="h-4 w-3/4" />
				<Skeleton className="h-4 w-1/2" />
				<Skeleton className="h-4 w-2/3" />
			</div>
		</div>
	);
}

function SourceBadges({ sources }: { sources: Source[] }) {
	return (
		<div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-border/50">
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

function MessageBubble({ message }: { message: Message }) {
	const isUser = message.role === "user";
	return (
		<div
			className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}
		>
			{isUser ? <UserAvatar /> : <BotAvatar />}
			<div
				className={`max-w-[80%] space-y-1 ${isUser ? "items-end" : "items-start"}`}
			>
				<div
					className={`rounded-2xl px-4 py-2.5 ${
						isUser
							? "bg-primary text-primary-foreground rounded-br-md"
							: "bg-muted rounded-bl-md"
					}`}
				>
					<p className="whitespace-pre-wrap text-sm leading-relaxed">
						{message.content}
					</p>
				</div>
				{message.sources && message.sources.length > 0 && (
					<SourceBadges sources={message.sources} />
				)}
			</div>
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

export default function Home() {
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState("");
	const scrollRef = useRef<HTMLDivElement>(null);

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
					role: "assistant",
					content: data.answer,
					sources: data.sources,
					confidence: data.confidence,
				},
			]);
		},
	});

	useEffect(() => {
		if (scrollRef.current) {
			const viewport = scrollRef.current.querySelector(
				"[data-radix-scroll-area-viewport]",
			);
			if (viewport) {
				viewport.scrollTop = viewport.scrollHeight;
			}
		}
	}, [messages, askMutation.isPending]);

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!input.trim() || askMutation.isPending) return;
		setMessages((prev) => [...prev, { role: "user", content: input }]);
		askMutation.mutate(input);
		setInput("");
	}

	return (
		<div className="max-w-3xl mx-auto h-dvh flex flex-col">
			<header className="border-b px-4 py-3 shrink-0">
				<div className="flex items-center gap-3">
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

			<ScrollArea ref={scrollRef} className="flex-1 px-4 py-4">
				{messages.length === 0 && <EmptyState />}
				<div className="space-y-4">
					{messages.map((msg, i) => (
						<MessageBubble key={i} message={msg} />
					))}
					{askMutation.isPending && <ShimmerBubble />}
				</div>
			</ScrollArea>

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
