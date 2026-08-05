export interface PromptVariables {
	context: string;
	question: string;
}

export const supportPrompt = ({
	context,
	question,
}: PromptVariables): string => `You are an expert support agent. Answer using ONLY the context below in clean markdown; prefer bullets over tables. When you use information from a source, cite its label (e.g. "[Page 3]"). If the context doesn't cover the question, say so honestly.

CONTEXT:
${context}

QUESTION:
${question}`;
