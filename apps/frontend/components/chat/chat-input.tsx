import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ChatInputProps {
	value: string;
	onChange: (value: string) => void;
	onSubmit: (e: React.FormEvent) => void;
	disabled: boolean;
}

export function ChatInput({
	value,
	onChange,
	onSubmit,
	disabled,
}: ChatInputProps) {
	return (
		<div className="border-t p-4 shrink-0">
			<form onSubmit={onSubmit} className="flex gap-2 max-w-3xl mx-auto h-12">
				<Input
					value={value}
					onChange={(e) => onChange(e.target.value)}
					placeholder="Ask a question..."
					disabled={disabled}
					className="rounded-xl h-full text-base placeholder:text-sm"
				/>
				<Button
					type="submit"
					disabled={disabled}
					className="rounded-xl px-5 h-full text-sm"
				>
					{disabled ? "Streaming..." : "Send"}
				</Button>
			</form>
		</div>
	);
}
