import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const components: Components = {
	h1: ({ children, ...props }) => (
		<h1 className="text-lg font-bold mb-2 mt-3 first:mt-0" {...props}>
			{children}
		</h1>
	),
	h2: ({ children, ...props }) => (
		<h2 className="text-base font-bold mb-1.5 mt-3 first:mt-0" {...props}>
			{children}
		</h2>
	),
	h3: ({ children, ...props }) => (
		<h3 className="text-sm font-semibold mb-1 mt-2 first:mt-0" {...props}>
			{children}
		</h3>
	),
	p: ({ children, ...props }) => (
		<p className="mb-2 last:mb-0 leading-relaxed" {...props}>
			{children}
		</p>
	),
	ul: ({ children, ...props }) => (
		<ul className="list-disc pl-5 mb-2 space-y-0.5" {...props}>
			{children}
		</ul>
	),
	ol: ({ children, ...props }) => (
		<ol className="list-decimal pl-5 mb-2 space-y-0.5" {...props}>
			{children}
		</ol>
	),
	li: ({ children, ...props }) => (
		<li className="leading-relaxed" {...props}>
			{children}
		</li>
	),
	code: ({ className, children, ...props }) => {
		const isInline = !className;
		if (isInline) {
			return (
				<code
					className="bg-muted rounded px-1 py-0.5 text-sm font-mono"
					{...props}
				>
					{children}
				</code>
			);
		}
		return (
			<pre className="bg-muted rounded-lg p-3 mb-2 overflow-x-auto text-sm font-mono">
				<code className={className} {...props}>
					{children}
				</code>
			</pre>
		);
	},
	pre: ({ children }) => <>{children}</>,
	blockquote: ({ children, ...props }) => (
		<blockquote
			className="border-l-2 border-primary/30 pl-3 italic mb-2 text-muted-foreground"
			{...props}
		>
			{children}
		</blockquote>
	),
	a: ({ children, href, ...props }) => (
		<a
			className="text-primary underline underline-offset-2 hover:opacity-80"
			href={href}
			{...props}
		>
			{children}
		</a>
	),
	hr: (props) => <hr className="border-t my-3" {...props} />,
	table: ({ children, ...props }) => (
		<div className="overflow-x-auto mb-2">
			<table className="min-w-full text-sm border-collapse" {...props}>
				{children}
			</table>
		</div>
	),
	th: ({ children, ...props }) => (
		<th className="border border-border bg-muted px-2 py-1 text-left font-semibold" {...props}>
			{children}
		</th>
	),
	td: ({ children, ...props }) => (
		<td className="border border-border px-2 py-1" {...props}>
			{children}
		</td>
	),
};

export function MarkdownContent({ content }: { content: string }) {
	return (
		<ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
			{content}
		</ReactMarkdown>
	);
}
