"use client";

import { FilePdf, Trash } from "@phosphor-icons/react";
import { useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogMedia,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { DocumentSummary } from "@/lib/api";
import { cn } from "@/lib/utils";

const STATUS_META: Record<
	DocumentSummary["status"],
	{ label: string; className: string; dot: string; pulse?: boolean }
> = {
	queued: {
		label: "Queued",
		className: "text-muted-foreground bg-muted-foreground/10",
		dot: "bg-muted-foreground/50",
	},
	processing: {
		label: "Processing",
		className: "text-amber-600 bg-amber-50 dark:text-amber-400",
		dot: "bg-amber-500 dark:bg-amber-400",
		pulse: true,
	},
	completed: {
		label: "Completed",
		className: "text-emerald-600 bg-emerald-50 dark:text-emerald-400",
		dot: "bg-emerald-500 dark:bg-emerald-400",
	},
	failed: {
		label: "Failed",
		className: "text-red-600 bg-red-50 dark:text-red-400",
		dot: "bg-red-500 dark:bg-red-400",
	},
};

function StatusBadge({ status }: { status: DocumentSummary["status"] }) {
	const meta = STATUS_META[status];
	return (
		<Badge
			variant="secondary"
			className={cn("gap-1.5 border-transparent", meta.className)}
		>
			<span
				className={cn(
					"size-1.5 rounded-full",
					meta.dot,
					meta.pulse && "animate-pulse",
				)}
			/>
			{meta.label}
		</Badge>
	);
}

function formatDate(value: string | null): string {
	if (!value) return "—";
	return new Date(value).toLocaleString();
}

interface DocumentTableProps {
	documents: DocumentSummary[];
	onDelete: (documentId: string) => void;
	deletingId: string | null;
}

export function DocumentTable({
	documents,
	onDelete,
	deletingId,
}: DocumentTableProps) {
	const [pending, setPending] = useState<DocumentSummary | null>(null);

	if (documents.length === 0) {
		return (
			<div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
				<div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
					<FilePdf className="size-5" />
				</div>
				<p className="text-sm font-medium">No documents yet</p>
				<p className="max-w-xs text-xs text-muted-foreground">
					Upload a PDF above and it will appear here once processed.
				</p>
			</div>
		);
	}

	return (
		<>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Filename</TableHead>
						<TableHead>Status</TableHead>
						<TableHead>Chunks</TableHead>
						<TableHead>Created</TableHead>
						<TableHead className="w-14" />
					</TableRow>
				</TableHeader>
				<TableBody>
					{documents.map((doc) => {
						const isDeleting = deletingId === doc.documentId;
						return (
							<TableRow key={doc.documentId}>
								<TableCell>
									<div className="flex items-center gap-2.5">
										<div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-red-50 text-red-500 dark:bg-red-500/10">
											<FilePdf className="size-4" />
										</div>
										<span className="font-medium">{doc.filename}</span>
									</div>
								</TableCell>
								<TableCell>
									<StatusBadge status={doc.status} />
								</TableCell>
								<TableCell>{doc.chunkCount ?? "—"}</TableCell>
								<TableCell className="text-muted-foreground">
									{formatDate(doc.createdAt)}
								</TableCell>
								<TableCell>
									<Button
										variant="ghost"
										size="icon-sm"
										disabled={isDeleting}
										onClick={() => setPending(doc)}
										className="text-muted-foreground hover:text-destructive"
									>
										{isDeleting ? (
											<Spinner className="size-3.5" />
										) : (
											<Trash className="size-3.5" />
										)}
									</Button>
								</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>

			<AlertDialog
				open={pending !== null}
				onOpenChange={(open) => {
					if (!open) setPending(null);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogMedia className="bg-red-50 text-destructive dark:bg-red-500/10">
							<Trash />
						</AlertDialogMedia>
						<AlertDialogTitle>Delete this document?</AlertDialogTitle>
						<AlertDialogDescription>
							{pending?.filename} will be removed and can no longer be used by
							the assistant.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							onClick={() => {
								if (pending) onDelete(pending.documentId);
								setPending(null);
							}}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
