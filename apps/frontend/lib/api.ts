export type DocumentStatus = "queued" | "processing" | "completed" | "failed";

export interface DocumentSummary {
	documentId: string;
	filename: string;
	status: DocumentStatus;
	chunkCount: number | null;
	error: string | null;
	createdAt: string;
	completedAt: string | null;
}

export interface IngestResponse {
	documentId: string;
	status: string;
	tenantId: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3003";
const TENANT = "default";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(`${API_BASE}${path}`, {
		...init,
		headers: {
			"X-Tenant-ID": TENANT,
			...(init?.headers ?? {}),
		},
	});
	if (!res.ok && res.status !== 204) {
		const body = (await res.json().catch(() => null)) as { error?: string } | null;
		throw new Error(body?.error ?? `Request failed (${res.status})`);
	}
	if (res.status === 204) return undefined as T;
	return (await res.json()) as T;
}

export function listDocuments(): Promise<{ documents: DocumentSummary[] }> {
	return request("/api/ingest");
}

export function ingestDocument(file: File): Promise<IngestResponse> {
	const form = new FormData();
	form.append("file", file);
	return request("/api/ingest", { method: "POST", body: form });
}

export function getDocumentStatus(documentId: string): Promise<DocumentSummary> {
	return request(`/api/ingest/status/${documentId}`);
}

export function deleteDocument(documentId: string): Promise<void> {
	return request(`/api/ingest/${documentId}`, { method: "DELETE" });
}
