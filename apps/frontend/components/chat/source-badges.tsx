import { BookOpen } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SourceInfo } from "@/components/chat/message-list";

function scoreColor(score: number): string {
	if (score >= 0.82) return "text-emerald-600 dark:text-emerald-400";
	if (score >= 0.72) return "text-amber-600 dark:text-amber-400";
	return "text-red-600 dark:text-red-400";
}

function scoreDot(score: number): string {
	if (score >= 0.82) return "bg-emerald-500";
	if (score >= 0.72) return "bg-amber-500";
	return "bg-red-500";
}

export function SourceBadges({ sources }: { sources: SourceInfo[] }) {
	const seen = new Map<string, number>();
	for (const s of sources) {
		const existing = seen.get(s.title);
		if (existing === undefined || s.score > existing) {
			seen.set(s.title, s.score);
		}
	}

	return (
		<div className="flex flex-wrap gap-1.5">
			{[...seen.entries()].map(([title, score]) => (
				<Badge
					key={title}
					variant="outline"
					title={`Similarity ${Math.round(score * 100)}%`}
					className={cn(
						"gap-1.5 px-2.5 py-1 text-[11px] font-medium text-foreground/80",
						scoreColor(score),
					)}
				>
					<BookOpen className="size-3 text-muted-foreground" />
					{title}
					<span className={cn("size-1.5 rounded-full", scoreDot(score))} />
				</Badge>
			))}
		</div>
	);
}
