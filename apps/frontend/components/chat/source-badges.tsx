export function SourceBadges({ sources }: { sources: string[] }) {
	const unique = [...new Set(sources)];
	return (
		<div className="flex flex-wrap gap-1.5">
			{unique.map((s) => (
				<span
					key={s}
					className="inline-flex items-center gap-1 rounded-full bg-secondary/50 px-2 py-0.5 text-[11px] text-muted-foreground"
				>
					<span className="size-1.5 rounded-full bg-secondary-foreground/40" />
					{s}
				</span>
			))}
		</div>
	);
}
