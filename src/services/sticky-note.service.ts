import { apiFetch } from "@/lib/api";
import type {
  CreateStickyNoteInput,
  StickyNote,
} from "@/types/sticky-note";

export async function listStickyNotes(limit = 20): Promise<StickyNote[]> {
  return apiFetch<StickyNote[]>(`/sticky-notes?limit=${limit}`);
}

export async function createStickyNote(
  input: CreateStickyNoteInput,
): Promise<StickyNote> {
  return apiFetch<StickyNote>("/sticky-notes", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function deleteStickyNote(id: string): Promise<void> {
  await apiFetch<void>(`/sticky-notes/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
