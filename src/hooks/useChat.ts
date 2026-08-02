"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  askQuestion,
  clearChatHistory,
  getChatHistory,
} from "@/services/chat.service";

import type {
  ChatMessage,
} from "@/types/chat";

interface UseChatResult {
  messages: ChatMessage[];
  isLoading: boolean;
  isSending: boolean;
  isClearing: boolean;
  error: string | null;
  send: (
    question: string,
  ) => Promise<ChatMessage | null>;
  clear: () => Promise<boolean>;
  refetch: () => Promise<void>;
}

export function useChat(
  noteId: string,
): UseChatResult {
  const [
    messages,
    setMessages,
  ] =
    useState<ChatMessage[]>([]);

  const [
    isLoading,
    setIsLoading,
  ] =
    useState(
      Boolean(noteId),
    );

  const [
    isSending,
    setIsSending,
  ] =
    useState(false);

  const [
    isClearing,
    setIsClearing,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const load =
    useCallback(
      async (): Promise<void> => {
        if (!noteId) {
          setMessages([]);
          setError(null);
          setIsLoading(false);
          return;
        }

        setIsLoading(true);
        setError(null);

        try {
          const history =
            await getChatHistory(
              noteId,
            );

          setMessages(
            Array.isArray(
              history,
            )
              ? history
              : [],
          );
        } catch (cause) {
          setMessages([]);

          setError(
            cause instanceof Error
              ? cause.message
              : "Failed to load chat history",
          );
        } finally {
          setIsLoading(false);
        }
      },
      [noteId],
    );

  useEffect(() => {
    let cancelled =
      false;

    async function loadSafely() {
      if (!noteId) {
        setMessages([]);
        setError(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const history =
          await getChatHistory(
            noteId,
          );

        if (
          !cancelled
        ) {
          setMessages(
            Array.isArray(
              history,
            )
              ? history
              : [],
          );
        }
      } catch (cause) {
        if (
          !cancelled
        ) {
          setMessages([]);

          setError(
            cause instanceof Error
              ? cause.message
              : "Failed to load chat history",
          );
        }
      } finally {
        if (
          !cancelled
        ) {
          setIsLoading(false);
        }
      }
    }

    void loadSafely();

    return () => {
      cancelled =
        true;
    };
  }, [noteId]);

  const send =
    useCallback(
      async (
        question: string,
      ): Promise<ChatMessage | null> => {
        const trimmed =
          question.trim();

        if (
          !noteId ||
          !trimmed ||
          isSending
        ) {
          return null;
        }

        setIsSending(true);
        setError(null);

        try {
          const message =
            await askQuestion(
              noteId,
              trimmed,
            );

          setMessages(
            (
              current,
            ) => [
              ...current,
              message,
            ],
          );

          return message;
        } catch (cause) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Failed to send message",
          );

          return null;
        } finally {
          setIsSending(false);
        }
      },
      [
        isSending,
        noteId,
      ],
    );

  const clear =
    useCallback(
      async (): Promise<boolean> => {
        if (
          !noteId ||
          isClearing
        ) {
          return false;
        }

        setIsClearing(true);
        setError(null);

        try {
          await clearChatHistory(
            noteId,
          );

          setMessages([]);

          return true;
        } catch (cause) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Failed to clear chat history",
          );

          return false;
        } finally {
          setIsClearing(false);
        }
      },
      [
        isClearing,
        noteId,
      ],
    );

  return {
    messages,
    isLoading,
    isSending,
    isClearing,
    error,
    send,
    clear,
    refetch:
      load,
  };
}
