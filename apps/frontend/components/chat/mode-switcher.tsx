"use client";

import { Graph, Lightning } from "@phosphor-icons/react";
import { Toggle } from "@/components/ui/toggle";

export type RetrievalMode = "graph" | "simple";

interface ModeSwitcherProps {
	mode: RetrievalMode;
	onModeChange: (mode: RetrievalMode) => void;
	disabled?: boolean;
}

export function ModeSwitcher({ mode, onModeChange, disabled }: ModeSwitcherProps) {
	return (
		<div
			role="group"
			aria-label="Retrieval mode"
			className="inline-flex items-center gap-1 rounded-lg border border-border bg-card/60 p-1 shadow-sm shadow-foreground/5"
		>
			<Toggle
				size="sm"
				pressed={mode === "graph"}
				onPressedChange={(pressed) => pressed && onModeChange("graph")}
				disabled={disabled}
				aria-label="Graph pipeline"
				className="gap-1.5 rounded-md px-2.5"
			>
				<Graph className="size-3.5" />
				Graph
			</Toggle>
			<Toggle
				size="sm"
				pressed={mode === "simple"}
				onPressedChange={(pressed) => pressed && onModeChange("simple")}
				disabled={disabled}
				aria-label="Simple one-shot RAG"
				className="gap-1.5 rounded-md px-2.5"
			>
				<Lightning className="size-3.5" />
				Simple
			</Toggle>
		</div>
	);
}
