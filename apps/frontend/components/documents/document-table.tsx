"use client";

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

const STATUS_VARIANT: Record<
	DocumentSummary["status"],
	"default" | "secondary" | "destructive"
> = {
	completed: "secondary",
	queued: "secondary",
	processing: "secondary",
	failed: "destructive",
};

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
	if (documents.length === 0) {
		return (
			<p className="py-8 text-center text-xs text-muted-foreground">
				No documents ingested yet.
			</p>
		);
	}

	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>Filename</TableHead>
					<TableHead>Status</TableHead>
					<TableHead>Chunks</TableHead>
					<TableHead>Created</TableHead>
					<TableHead className="w-16" />
				</TableRow>
			</TableHeader>
			<TableBody>
				{documents.map((doc) => (
					<TableRow key={doc.documentId}>
						<TableCell className="font-medium">{doc.filename}</TableCell>
						<TableCell>
							<Badge variant={STATUS_VARIANT[doc.status]}>{doc.status}</Badge>
						</TableCell>
						<TableCell>{doc.chunkCount ?? "—"}</TableCell>
						<TableCell className="text-muted-foreground">
							{formatDate(doc.createdAt)}
						</TableCell>
						<TableCell>
							<Button
								variant="ghost"
								size="sm"
								disabled={deletingId === doc.documentId}
								onClick={() => onDelete(doc.documentId)}
								className="text-destructive hover:text-destructive"
							>
								{deletingId === doc.documentId ? (
									<Spinner className="size-3" />
								) : (
									"Delete"
								)}
							</Button>
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}
