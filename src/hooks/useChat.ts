"use client";

import { useCallback, useEffect, useState } from "react";
import {
  askQuestion,
  getChatHistory,
  clearChatHistory,
} from "@/services/chat.service";
import type { ChatMessage } from "@/types/chat";

export function useChat(noteId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(noteId));
  const [isSending, setIsSending] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!noteId) {
      setMessages([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      setMessages(await getChatHistory(noteId));
    } catch (err) {
      setError(
<<<<<<< HEAD
        err instanceof Error
          ? err.message
          : "Failed to load chat history",
=======
        err instanceof Error ? err.message : "Failed to load chat history",
>>>>>>> 58360d5 (feat(ui): overhaul student application layout, navigation context, and feature hooks)
      );
    } finally {
      setIsLoading(false);
    }
  }, [noteId]);

  useEffect(() => {
    void load();
  }, [load]);

  const send = useCallback(
    async (question: string): Promise<ChatMessage | null> => {
      const trimmed = question.trim();

      if (!noteId || !trimmed) return null;

      setIsSending(true);
      setError(null);

      try {
        const message = await askQuestion(noteId, trimmed);
        setMessages((current) => [...current, message]);
        return message;
      } catch (err) {
<<<<<<< HEAD
        setError(
          err instanceof Error
            ? err.message
            : "Failed to send message",
        );
=======
        setError(err instanceof Error ? err.message : "Failed to send message");
>>>>>>> 58360d5 (feat(ui): overhaul student application layout, navigation context, and feature hooks)
        return null;
      } finally {
        setIsSending(false);
      }
    },
    [noteId],
  );

  const clear = useCallback(async (): Promise<boolean> => {
    if (!noteId) return false;

    setIsClearing(true);
    setError(null);

    try {
      await clearChatHistory(noteId);
      setMessages([]);
      return true;
    } catch (err) {
      setError(
<<<<<<< HEAD
        err instanceof Error
          ? err.message
          : "Failed to clear chat history",
=======
        err instanceof Error ? err.message : "Failed to clear chat history",
>>>>>>> 58360d5 (feat(ui): overhaul student application layout, navigation context, and feature hooks)
      );
      return false;
    } finally {
      setIsClearing(false);
    }
  }, [noteId]);

  return {
    messages,
    isLoading,
    isSending,
    isClearing,
    error,
    send,
    clear,
    refetch: load,
  };
}
