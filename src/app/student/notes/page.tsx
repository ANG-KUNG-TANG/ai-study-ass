"use client";

import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FilePlus,
} from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { NoteCard } from "@/components/notes/NoteCard";
import { DeleteNoteDialog } from "@/components/notes/DeleteNoteDialog";
import { UploadZone } from "@/components/notes/UploadZone";
import { useNotes } from "@/hooks/useNotes";
import { deleteNote } from "@/services/note.service";
import { useLanguage } from "@/context/LanguageContext";

const VIEW_ALL_PAGE_SIZE = 50;

interface DeleteTarget {
  id: string;
  title: string;
}

export default function NotesPage() {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { notes, meta, isLoading, error, refetch } = useNotes({
    page,
    limit: VIEW_ALL_PAGE_SIZE,
    sortBy: "createdAt",
    search: search.trim() || undefined,
  });

  function handleSearchChange(value: string): void {
    setSearch(value);
    setPage(1);
  }

  function requestDelete(noteId: string): void {
    const note = notes.find((item) => item.id === noteId);
    if (!note) return;

    setDeleteError(null);
    setDeleteTarget({
      id: note.id,
      title: note.title,
    });
  }

  function closeDeleteDialog(): void {
    if (isDeleting) return;
    setDeleteTarget(null);
    setDeleteError(null);
  }

  async function confirmDelete(): Promise<void> {
    if (!deleteTarget || isDeleting) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deleteNote(deleteTarget.id);
      setDeleteTarget(null);

      if (notes.length === 1 && page > 1) {
        setPage((current) => Math.max(1, current - 1));
      } else {
        refetch();
      }
    } catch (cause) {
      setDeleteError(
        cause instanceof Error ? cause.message : t("notes.deleteFailed"),
      );
    } finally {
      setIsDeleting(false);
    }
  }

  const firstVisible =
    meta && meta.total > 0 ? (meta.page - 1) * meta.limit + 1 : 0;

  const lastVisible =
    meta && meta.total > 0
      ? Math.min(meta.page * meta.limit, meta.total)
      : 0;

  return (
    <>
      <Topbar
        eyebrow={t("notes.eyebrow")}
        title={t("notes.title")}
        description={t("notes.description")}
        search={{
          value: search,
          onChange: handleSearchChange,
          placeholder: t("notes.search"),
        }}
      />

      <div id="upload" className="mb-2">
        <UploadZone onUploaded={() => refetch()} />
      </div>

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-[19px] font-semibold text-ink">
            {t("notes.uploaded")}
          </h2>

          <p className="mt-1 text-[12px] text-ink-soft">
            {meta
              ? t(meta.total === 1 ? "notes.libraryCountOne" : "notes.libraryCount", { count: meta.total })
              : t("notes.yourPapers")}
          </p>
        </div>

        {meta && meta.total > 0 && (
          <p className="font-mono text-[10.5px] text-ink-faint">
            {t("notes.showing", { first: firstVisible, last: lastVisible, total: meta.total })}
          </p>
        )}
      </div>

      {isLoading && (
        <div className="border-y border-line">
          {[...Array(6)].map((_, index) => (
            <div
              key={index}
              className="animate-pulse border-b border-line-soft px-3 py-5 last:border-b-0"
            >
              <div className="h-5 w-1/2 rounded bg-line-soft" />
              <div className="mt-2 h-4 w-1/2 rounded bg-line-soft" />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-coral/20 bg-coral-soft px-4 py-3 text-[13px] text-coral"
        >
          {error}
        </div>
      )}

      {!isLoading && !error && notes.length === 0 && (
        <div className="flex flex-col items-center justify-center border-y border-dashed border-line p-12 text-center">
          <div className="mb-4 text-ink-faint">
            <FilePlus size={48} strokeWidth={1.5} />
          </div>

          <h3 className="font-serif text-lg font-semibold text-ink">
            {search.trim() ? t("notes.noMatch") : t("notes.noPapers")}
          </h3>

          <p className="mt-1 text-sm text-ink-soft">
            {search.trim()
              ? t("notes.trySearch")
              : t("notes.uploadFirst")}
          </p>
        </div>
      )}

      {!isLoading && !error && notes.length > 0 && (
        <>
          <div className="border-y border-line">
            {notes.map((note) => (
              <NoteCard
                key={note.id}
                note={{
                  ...note,
                  summary: note.summary ?? undefined,
                }}
                onDelete={requestDelete}
                isDeleting={isDeleting && deleteTarget?.id === note.id}
              />
            ))}
          </div>

          {meta && meta.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
              <button
                type="button"
                disabled={!meta.hasPrev || isLoading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-paper-raised px-3 py-2 text-[12px] font-medium text-ink transition hover:bg-line-soft disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft size={14} strokeWidth={1.8} />
                {t("common.previous")}
              </button>

              <span className="font-mono text-[10.5px] text-ink-faint">
                {t("notes.pageOf", { page: meta.page, total: meta.totalPages })}
              </span>

              <button
                type="button"
                disabled={!meta.hasNext || isLoading}
                onClick={() =>
                  setPage((current) =>
                    Math.min(meta.totalPages, current + 1),
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-paper-raised px-3 py-2 text-[12px] font-medium text-ink transition hover:bg-line-soft disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t("common.next")}
                <ChevronRight size={14} strokeWidth={1.8} />
              </button>
            </div>
          )}
        </>
      )}

      <DeleteNoteDialog
        open={deleteTarget !== null}
        title={deleteTarget?.title ?? ""}
        isDeleting={isDeleting}
        error={deleteError}
        onCancel={closeDeleteDialog}
        onConfirm={confirmDelete}
      />
    </>
  );
}
