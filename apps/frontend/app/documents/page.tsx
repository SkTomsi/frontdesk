"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppHeader } from "@/components/app-header";
import { DocumentTable } from "@/components/documents/document-table";
import { DocumentUpload } from "@/components/documents/document-upload";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
		<div className="flex h-dvh flex-col">
			<AppHeader />
			<div className="mx-auto w-full max-w-4xl flex-1 overflow-y-auto px-4 py-6 sm:px-6">
				<div className="space-y-4">
					<div className="space-y-1">
						<h1 className="text-xl font-semibold tracking-tight">Documents</h1>
						<p className="text-sm text-muted-foreground">
							Upload PDFs to make them searchable by the AI assistant.
						</p>
					</div>

					<Card>
						<CardHeader>
							<CardTitle>Upload a PDF</CardTitle>
							<CardDescription>
								Add a PDF to the knowledge base for Frontdesk to search.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<DocumentUpload />
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Ingested documents</CardTitle>
							<CardDescription>
								{isLoading
									? "Loading…"
									: `${data?.documents.length ?? 0} document${
											data?.documents.length === 1 ? "" : "s"
										}`}
							</CardDescription>
						</CardHeader>
						<CardContent className="px-4">
							{isLoading ? (
								<div className="divide-y divide-border/60">
									{[0, 1, 2].map((i) => (
										<div
											key={i}
											className="flex items-center gap-3 px-4 py-3.5"
										>
											<Skeleton className="size-7 rounded-md" />
											<div className="flex-1 space-y-2">
												<Skeleton className="h-3 w-1/3" />
												<Skeleton className="h-3 w-1/4" />
											</div>
										</div>
									))}
								</div>
							) : isError ? (
								<p className="px-4 py-10 text-center text-xs text-destructive">
									Failed to load documents. Try refreshing the page.
								</p>
							) : (
								<DocumentTable
									documents={data?.documents ?? []}
									onDelete={(id) => deleteMutation.mutate(id)}
									deletingId={deleteMutation.variables ?? null}
								/>
							)}
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
