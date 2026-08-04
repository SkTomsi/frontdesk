"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { FilePdf, UploadSimple } from "@phosphor-icons/react";
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
		<form onSubmit={handleSubmit} className="space-y-3">
			<input
				ref={inputRef}
				type="file"
				accept="application/pdf,.pdf"
				disabled={busy}
				onChange={(e) => {
					setFile(e.target.files?.[0] ?? null);
					setState({ phase: "idle" });
				}}
				className="hidden"
			/>
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
				<Button
					type="button"
					variant="outline"
					disabled={busy}
					onClick={() => inputRef.current?.click()}
					className="gap-2 justify-start sm:min-w-56"
				>
					<FilePdf className="size-4 shrink-0 text-muted-foreground" />
					<span className="truncate">{file ? file.name : "Choose a PDF"}</span>
				</Button>
				<Button type="submit" disabled={busy || !file} className="gap-2">
					{state.phase === "uploading" ? (
						<Spinner className="size-4" />
					) : (
						<UploadSimple weight="bold" className="size-4" />
					)}
					{state.phase === "uploading" ? "Uploading…" : "Upload"}
				</Button>
			</div>
			{state.phase === "processing" && (
				<div className="flex items-center gap-2 text-xs text-muted-foreground">
					<Spinner className="size-3.5" />
					{state.status === "processing"
						? "Embedding chunks"
						: state.status === "queued"
							? "Queued for processing"
							: "Processing failed"}
					{state.chunkCount != null && ` · ${state.chunkCount} chunks`}
				</div>
			)}
			{state.phase === "error" && (
				<div className="flex items-center justify-between gap-3">
					<span className="text-xs text-destructive">{state.message}</span>
					<Button type="button" variant="ghost" size="sm" onClick={reset}>
						Clear
					</Button>
				</div>
			)}
		</form>
	);
}
