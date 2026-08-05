"use client";

import { PaperPlaneRight } from "@phosphor-icons/react";
import { useEffect, useRef } from "react";
import {
	ModeSwitcher,
	type RetrievalMode,
} from "@/components/chat/mode-switcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";

interface ChatInputProps {
	value: string;
	onChange: (value: string) => void;
	onSubmit: (e: React.FormEvent) => void;
	disabled: boolean;
	mode: RetrievalMode;
	onModeChange: (mode: RetrievalMode) => void;
}

export function ChatInput({
	value,
	onChange,
	onSubmit,
	disabled,
	mode,
	onModeChange,
}: ChatInputProps) {
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (!disabled) inputRef.current?.focus();
	}, [disabled]);

	return (
		<div className="shrink-0 border-t border-border/60 bg-background/60 backdrop-blur-md">
			<form
				onSubmit={onSubmit}
				className="mx-auto w-full max-w-2xl px-4 pb-3 pt-4"
			>
				<TooltipProvider delay={150}>
					<div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-2 pl-3.5 shadow-sm shadow-foreground/5 transition-shadow focus-within:border-ring/70 focus-within:ring-2 focus-within:ring-ring/25">
						<Input
							ref={inputRef}
							value={value}
							onChange={(e) => onChange(e.target.value)}
							placeholder="Ask about Northwind..."
							disabled={disabled}
							className="h-auto border-0 bg-transparent px-0 py-2 text-sm shadow-none placeholder:text-muted-foreground focus-visible:ring-0!"
						/>
						<Kbd className="hidden shrink-0 sm:inline-flex">Enter</Kbd>
						<Tooltip>
							<TooltipTrigger
								render={
									<Button
										type="submit"
										size="icon"
										disabled={disabled || !value.trim()}
										className="size-9 shrink-0 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
									>
										{disabled ? (
											<Spinner className="size-4" />
										) : (
											<PaperPlaneRight weight="fill" className="size-4" />
										)}
									</Button>
								}
							/>
							<TooltipContent>
								{disabled ? "Waiting for response…" : "Send message"}
							</TooltipContent>
						</Tooltip>
					</div>
				</TooltipProvider>
				<div className="mt-2.5 flex items-center justify-between gap-3 px-1">
					<ModeSwitcher
						mode={mode}
						onModeChange={onModeChange}
						disabled={disabled}
					/>
					<p className="text-right text-[11px] text-muted-foreground">
						Frontdesk can make mistakes — verify important information.
					</p>
				</div>
			</form>
		</div>
	);
}
