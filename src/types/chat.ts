export type ChatProvider =
  | "openai"
  | "gemini"
  | "symbolic";

export interface ChatMessage {
  id: string;
  noteId: string;
  userId: string;
  question: string;
  answer: string;
  tokensUsed: number;
  provider: ChatProvider;
  createdAt: string;
}
