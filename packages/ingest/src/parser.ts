import {
	GlobalWorkerOptions,
	getDocument,
	type PDFDocumentProxy,
} from "pdfjs-dist/legacy/build/pdf.mjs";
import type { ParsedDocument, ParsedPage } from "./types";

GlobalWorkerOptions.workerSrc = import.meta.resolve(
	"pdfjs-dist/legacy/build/pdf.worker.mjs",
);

async function extractPageText(doc: PDFDocumentProxy, pageNum: number): Promise<string> {
	const page = await doc.getPage(pageNum);
	try {
		const content = await page.getTextContent();
		return content.items
			.map((item) => ("str" in item ? item.str : ""))
			.join(" ")
			.replace(/\s+/g, " ")
			.trim();
	} finally {
		page.cleanup();
	}
}

export async function parsePdf(pdfBytes: Uint8Array): Promise<ParsedDocument> {
	const task = getDocument({
		data: pdfBytes,
		isEvalSupported: false,
		useSystemFonts: true,
	});
	const doc = await task.promise;

	try {
		const pages: ParsedPage[] = [];
		for (let i = 1; i <= doc.numPages; i++) {
			const text = await extractPageText(doc, i);
			if (text) {
				pages.push({ pageNum: i, text });
			}
		}

		const fullText = pages.map((page) => page.text).join("\n\n");

		return { pages, fullText };
	} finally {
		await doc.destroy();
	}
}
