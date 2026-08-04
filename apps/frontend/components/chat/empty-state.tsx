"use client";

import { ArrowUpRight, ChatCircleDots } from "@phosphor-icons/react";

const SUGGESTIONS = [
	"What's included in the Growth plan?",
	"How do I export my customer list?",
	"What teams are available in Northwind?",
];

interface EmptyStateProps {
	onSuggestion?: (question: string) => void;
}

export function EmptyState({ onSuggestion }: EmptyStateProps) {
	return (
		<div className="flex flex-col items-center justify-center px-4 text-center">
			<div className="relative mb-5">
				<div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-indigo-500/20 via-violet-500/10 to-transparent blur-xl" />
				<div className="relative flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/25">
					<ChatCircleDots weight="fill" className="size-7" />
				</div>
			</div>
			<h2 className="text-lg font-semibold tracking-tight">Ask me anything</h2>
			<p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
				I can answer questions about Northwind — plans, features, exports,
				teams, and more.
			</p>
			{onSuggestion && (
				<div className="mt-6 flex max-w-lg flex-wrap items-center justify-center gap-2">
					{SUGGESTIONS.map((q, i) => (
						<button
							key={q}
							type="button"
							onClick={() => onSuggestion(q)}
							style={{ animationDelay: `${140 + i * 50}ms` }}
							className="fd-message-in group inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs text-muted-foreground transition-[color,background-color,border-color,transform] ease-out hover:border-primary/40 hover:bg-primary/5 hover:text-foreground active:scale-[0.98]"
						>
							{q}
							<ArrowUpRight className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
						</button>
					))}
				</div>
			)}
		</div>
	);
}
