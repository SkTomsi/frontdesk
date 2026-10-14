import type { Metadata } from "next";
import Script from "next/script";
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
				<Script
					src="https://www.googletagmanager.com/gtag/js?id=G-LRQ18551XV"
					strategy="afterInteractive"
				/>
				<Script id="google-analytics" strategy="afterInteractive">
					{`
						window.dataLayer = window.dataLayer || [];
						function gtag(){dataLayer.push(arguments);}
						gtag('js', new Date());
						gtag('config', 'G-LRQ18551XV');
					`}
				</Script>
			</body>
		</html>
	);
}
