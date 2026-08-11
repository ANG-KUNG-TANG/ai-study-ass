import { apiFetch, apiFetchPaginated } from "@/lib/api";
import type { Note, NoteListItem, NoteListParams } from "@/types/notes";
import type { PaginationMeta } from "@/types/pagination";

function buildQuery(params: NoteListParams = {}): string {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  if (params.sortBy) query.set("sortBy", params.sortBy);
  if (params.fileType) query.set("fileType", params.fileType);
  if (params.search) query.set("search", params.search);
  const qs = query.toString();
  return qs ? `?${qs}` : "";
}

export function listNotes(
  params?: NoteListParams
): Promise<{ data: NoteListItem[]; meta: PaginationMeta }> {
  return apiFetchPaginated<NoteListItem>(`/notes${buildQuery(params)}`);
}

export function getNoteById(id: string): Promise<Note> {
  return apiFetch<Note>(`/notes/${id}`);
}

export function deleteNote(id: string): Promise<void> {
  return apiFetch<void>(`/notes/${id}`, { method: "DELETE" });
}