"use client";

import { useState, useEffect, useCallback } from "react";
import { listNotes, getNoteById } from "@/services/note.service";
import type { Note, NoteListItem, NoteListParams } from "@/types/notes";
import type { PaginationMeta } from "@/types/pagination";

// ─── useNotes — list of notes, paginated ──────────────────────────────────────

interface UseNotesResult {
  notes: NoteListItem[];
  meta: PaginationMeta | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useNotes(params?: NoteListParams): UseNotesResult {
  const [notes, setNotes] = useState<NoteListItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchIndex, setRefetchIndex] = useState(0);

  const refetch = useCallback(() => setRefetchIndex((i) => i + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const result = await listNotes(params);
        if (!cancelled) {
          setNotes(result.data);
          setMeta(result.meta);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load notes");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetchIndex, params?.page, params?.limit, params?.sortBy, params?.fileType, params?.search]);

  return { notes, meta, isLoading, error, refetch };
}

// ─── useNote — single note by id ───────────────────────────────────────────────

interface UseNoteResult {
  note: Note | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  setNote: (note: Note) => void;
}

export function useNote(id: string): UseNoteResult {
  const [note, setNoteState] = useState<Note | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchIndex, setRefetchIndex] = useState(0);

  const refetch = useCallback(() => setRefetchIndex((i) => i + 1), []);
  const setNote = useCallback((n: Note) => setNoteState(n), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const result = await getNoteById(id);
        if (!cancelled) setNoteState(result);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load note");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id, refetchIndex]);

  return { note, isLoading, error, refetch, setNote };
}