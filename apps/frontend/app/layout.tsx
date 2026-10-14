import type { Metadata } from "next";
import "./globals.css";
import { Inter, JetBrains_Mono } from "next/font/google";
import { cn } from "@/lib/utils";
import { Providers } from "./providers";

const inter = Inter({
	subsets: ["latin"],
	variable: "--font-sans",
});

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
		<html
			lang="en"
			className={cn("font-sans", inter.variable, jetbrainsMono.variable)}
		>
			<body className="min-h-dvh bg-background text-foreground">
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}
