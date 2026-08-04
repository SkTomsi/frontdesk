"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { DocumentStatus } from "@/lib/api";
import { getDocumentStatus, ingestDocument } from "@/lib/api";

type UploadState =
	| { phase: "idle" }
	| { phase: "uploading" }
	| { phase: "processing"; status: DocumentStatus; chunkCount: number | null }
	| { phase: "error"; message: string };

const POLL_INTERVAL_MS = 1500;

export function DocumentUpload() {
	const [file, setFile] = useState<File | null>(null);
	const [state, setState] = useState<UploadState>({ phase: "idle" });
	const inputRef = useRef<HTMLInputElement>(null);
	const queryClient = useQueryClient();

	function reset() {
		setState({ phase: "idle" });
		setFile(null);
		if (inputRef.current) inputRef.current.value = "";
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!file || state.phase === "uploading" || state.phase === "processing")
			return;

		setState({ phase: "uploading" });
		try {
			const { documentId } = await ingestDocument(file);

			setState({ phase: "processing", status: "queued", chunkCount: null });
			while (true) {
				const summary = await getDocumentStatus(documentId);
				setState({
					phase: "processing",
					status: summary.status,
					chunkCount: summary.chunkCount,
				});
				if (summary.status === "completed") {
					reset();
					break;
				}
				if (summary.status === "failed") {
					setState({
						phase: "error",
						message: summary.error ?? "Ingestion failed",
					});
					break;
				}
				await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
			}
		} catch (error) {
			setState({
				phase: "error",
				message: error instanceof Error ? error.message : "Upload failed",
			});
		} finally {
			await queryClient.invalidateQueries({ queryKey: ["documents"] });
		}
	}

	const busy = state.phase === "uploading" || state.phase === "processing";

	return (
		<form onSubmit={handleSubmit} className="flex items-center gap-2">
			<input
				ref={inputRef}
				type="file"
				accept="application/pdf,.pdf"
				disabled={busy}
				onChange={(e) => {
					setFile(e.target.files?.[0] ?? null);
					setState({ phase: "idle" });
				}}
				className="h-8 w-full min-w-0 border border-input bg-transparent px-2.5 py-1 text-xs outline-none file:mr-2 file:h-6 file:border-0 file:bg-transparent file:px-1 file:text-xs file:font-medium file:text-foreground"
			/>
			<Button type="submit" disabled={busy || !file} className="shrink-0">
				{state.phase === "uploading" ? "Uploading..." : "Upload"}
			</Button>
			{state.phase === "processing" && (
				<span className="flex items-center gap-2 text-xs text-muted-foreground">
					<Spinner />
					{state.status === "processing"
						? "Embedding..."
						: state.status === "queued"
							? "Queued..."
							: "Failed"}
				</span>
			)}
			{state.phase === "error" && (
				<span className="text-xs text-destructive">{state.message}</span>
			)}
			{state.phase === "error" && (
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={reset}
					className="shrink-0"
				>
					Clear
				</Button>
			)}
		</form>
	);
}
