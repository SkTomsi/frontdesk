import type { Metadata } from "next";
import "./globals.css";
import { JetBrains_Mono } from "next/font/google";
import { cn } from "@/lib/utils";
import { Providers } from "./providers";

const jetbrainsMono = JetBrains_Mono({
	subsets: ["latin"],
	variable: "--font-mono",
});

export const metadata: Metadata = {
	title: "Frontdesk",
	description: "AI-powered support",
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en" className={cn("font-mono", jetbrainsMono.variable)}>
			<body className="max-w-3xl mx-auto">
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}
