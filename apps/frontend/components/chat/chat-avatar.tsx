import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function BotAvatar() {
	return (
		<Avatar className="size-8">
			<AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
				AI
			</AvatarFallback>
		</Avatar>
	);
}

export function UserAvatar() {
	return (
		<Avatar className="size-8">
			<AvatarFallback className="bg-muted-foreground/20 text-muted-foreground text-xs">
				U
			</AvatarFallback>
		</Avatar>
	);
}
