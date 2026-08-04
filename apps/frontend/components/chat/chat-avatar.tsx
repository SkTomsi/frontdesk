import { Sparkle, User } from "@phosphor-icons/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function BotAvatar() {
	return (
		<Avatar className="size-8">
			<AvatarFallback className="bg-gradient-to-br from-indigo-500 via-violet-500 to-indigo-600 text-white">
				<Sparkle weight="fill" className="size-4" />
			</AvatarFallback>
		</Avatar>
	);
}

export function UserAvatar() {
	return (
		<Avatar className="size-8">
			<AvatarFallback className="bg-muted-foreground/15 text-muted-foreground">
				<User weight="fill" className="size-4" />
			</AvatarFallback>
		</Avatar>
	);
}
