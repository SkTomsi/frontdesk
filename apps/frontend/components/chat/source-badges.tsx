import type { SourceInfo } from "@/components/chat/message-list";

function scoreColor(score: number): string {
	if (score >= 0.82) return "bg-emerald-500/15 text-emerald-600 [&>span]:bg-emerald-500";
	if (score >= 0.72) return "bg-amber-500/15 text-amber-600 [&>span]:bg-amber-500";
	return "bg-red-500/15 text-red-600 [&>span]:bg-red-500";
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
				<span
					key={title}
					className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${scoreColor(score)}`}
				>
					<span className="size-1.5 rounded-full" />
					{title}
				</span>
			))}
		</div>
	);
}
