"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";

import { useNote } from "@/hooks/useNotes";

import { subscribeStudyGenerationUpdated } from "@/lib/study-generation-events";

import type { Note } from "@/types/notes";

interface NoteContextValue {
  note: Note | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  setNote: (note: Note) => void;
}

const NoteContext = createContext<NoteContextValue | null>(null);

export function NoteProvider({
  noteId,
  children,
}: {
  noteId: string;
  children: ReactNode;
}) {
  const value = useNote(noteId);

  const { refetch } = value;

  useEffect(() => {
    return subscribeStudyGenerationUpdated(noteId, () => {
      refetch();
    });
  }, [noteId, refetch]);

  return <NoteContext.Provider value={value}>{children}</NoteContext.Provider>;
}

export function useNoteContext() {
  const ctx = useContext(NoteContext);

  if (!ctx) {
    throw new Error("useNoteContext must be used within NoteProvider");
  }

  return ctx;
}
