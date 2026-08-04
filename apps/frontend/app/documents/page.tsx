"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { DocumentTable } from "@/components/documents/document-table";
import { DocumentUpload } from "@/components/documents/document-upload";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { deleteDocument, listDocuments } from "@/lib/api";

export default function DocumentsPage() {
	const queryClient = useQueryClient();
	const { data, isLoading, isError } = useQuery({
		queryKey: ["documents"],
		queryFn: listDocuments,
	});

	const deleteMutation = useMutation({
		mutationFn: deleteDocument,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents"] }),
	});

	return (
		<div className="flex h-dvh flex-col border border-x">
			<header className="border-b px-4 py-3 shrink-0">
				<div className="flex items-center justify-between max-w-3xl mx-auto">
					<div>
						<h1 className="text-lg font-bold">Documents</h1>
						<p className="text-xs text-muted-foreground">
							Upload PDFs to make them searchable by the AI assistant
						</p>
					</div>
					<Link
						href="/"
						className="text-xs text-muted-foreground hover:text-foreground"
					>
						Back to chat
					</Link>
				</div>
			</header>

			<div className="flex-1 overflow-y-auto p-4 max-w-3xl mx-auto w-full space-y-4">
				<Card size="sm">
					<CardHeader>
						<CardTitle>Ingest a PDF</CardTitle>
					</CardHeader>
					<DocumentUpload />
				</Card>

				<Card size="sm">
					<CardHeader>
						<CardTitle>Ingested documents</CardTitle>
					</CardHeader>
					{isLoading ? (
						<div className="flex justify-center py-8">
							<Spinner />
						</div>
					) : isError ? (
						<p className="py-8 text-center text-xs text-destructive">
							Failed to load documents
						</p>
					) : (
						<DocumentTable
							documents={data?.documents ?? []}
							onDelete={(id) => deleteMutation.mutate(id)}
							deletingId={deleteMutation.variables ?? null}
						/>
					)}
				</Card>
			</div>
		</div>
	);
}
