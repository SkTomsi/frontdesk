"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChatCircleDots, FolderOpen } from "@phosphor-icons/react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
	{ href: "/", label: "Chat", icon: ChatCircleDots },
	{ href: "/documents", label: "Documents", icon: FolderOpen },
];

export function AppHeader() {
	const pathname = usePathname();

	return (
		<header className="sticky top-0 z-20 shrink-0 border-b border-border/60 bg-background/80 backdrop-blur-md">
			<div className="mx-auto flex h-14 w-full max-w-4xl items-center gap-3 px-4 sm:px-6">
				<Link href="/" className="flex items-center gap-2.5">
					<span className="relative flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 via-violet-500 to-indigo-600 text-primary-foreground shadow-sm shadow-indigo-500/20">
						<ChatCircleDots weight="fill" className="size-4" />
					</span>
					<span className="flex flex-col leading-none">
						<span className="text-sm font-semibold tracking-tight">
							Frontdesk
						</span>
						<span className="text-[11px] text-muted-foreground">
							AI-powered support
						</span>
					</span>
				</Link>

				<nav className="ml-auto flex items-center gap-1">
					{NAV_LINKS.map(({ href, label, icon: Icon }) => {
						const active = pathname === href;
						return (
							<Link
								key={href}
								href={href}
								className={cn(
									buttonVariants({ variant: "ghost", size: "sm" }),
									"gap-1.5",
									active &&
										"bg-secondary text-secondary-foreground hover:bg-secondary hover:text-secondary-foreground",
								)}
							>
								<Icon className="size-3.5" />
								{label}
							</Link>
						);
					})}
				</nav>
			</div>
		</header>
	);
}
