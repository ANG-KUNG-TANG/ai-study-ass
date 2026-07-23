export type AIProvider = "openai" | "gemini";

export interface ChatMessage {
  id: string;
  noteId: string;
  userId: string;
  question: string;
  answer: string;
  tokensUsed: number;
  provider: AIProvider;
  createdAt: string;
}