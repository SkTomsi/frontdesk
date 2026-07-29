export function ChatHeader() {
	return (
		<header className="border-b px-4 py-3 shrink-0">
			<div className="flex items-center gap-3 max-w-3xl mx-auto">
				<div className="size-10 rounded-lg bg-primary flex items-center justify-center">
					<svg
						className="size-5 text-primary-foreground"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={1.5}
							d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
						/>
					</svg>
				</div>
				<div>
					<h1 className="text-lg font-bold">Frontdesk</h1>
					<p className="text-xs text-muted-foreground">AI-powered support</p>
				</div>
			</div>
		</header>
	);
}
