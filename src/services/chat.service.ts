// src/services/chat.service.ts

import { apiFetch } from "@/lib/api";
import type { ChatMessage } from "@/types/chat";

export function getChatHistory(
  noteId: string,
): Promise<ChatMessage[]> {
  return apiFetch<ChatMessage[]>(
    `/notes/${encodeURIComponent(noteId)}/chat`,
  );
}

export function askQuestion(
  noteId: string,
  question: string,
): Promise<ChatMessage> {
  return apiFetch<ChatMessage>(
    `/notes/${encodeURIComponent(noteId)}/chat`,
    {
      method: "POST",
      body: JSON.stringify({
        question,
      }),
    },
  );
}

export function clearChatHistory(
  noteId: string,
): Promise<void> {
  return apiFetch<void>(
    `/notes/${encodeURIComponent(noteId)}/chat`,
    {
      method: "DELETE",
    },
  );
}