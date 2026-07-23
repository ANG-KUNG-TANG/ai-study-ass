"use client";
import { useState, useEffect, useCallback } from "react";
import { askQuestion, getChatHistory, clearChatHistory } from "@/services/chat.service";
import type { ChatMessage } from "@/types/chat";

export function useChat(noteId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const history = await getChatHistory(noteId);
        if (!cancelled) setMessages(history);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load chat history");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [noteId]);

  const send = useCallback(async (question: string) => {
    setIsSending(true);
    setError(null);
    try {
      const message = await askQuestion(noteId, question);
      setMessages((prev) => [...prev, message]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setIsSending(false);
    }
  }, [noteId]);

  const clear = useCallback(async () => {
    await clearChatHistory(noteId);
    setMessages([]);
  }, [noteId]);

  return { messages, isLoading, isSending, error, send, clear };
}