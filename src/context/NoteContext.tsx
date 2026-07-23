"use client";
import { createContext, useContext, ReactNode } from "react";
import { useNote } from "@/hooks/useNotes";
import type { Note } from "@/types/notes";

interface NoteContextValue {
  note: Note | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  setNote: (note: Note) => void;
}

const NoteContext = createContext<NoteContextValue | null>(null);

export function NoteProvider({ noteId, children }: { noteId: string; children: ReactNode }) {
  const value = useNote(noteId);
  return <NoteContext.Provider value={value}>{children}</NoteContext.Provider>;
}

export function useNoteContext() {
  const ctx = useContext(NoteContext);
  if (!ctx) throw new Error("useNoteContext must be used within NoteProvider");
  return ctx;
}