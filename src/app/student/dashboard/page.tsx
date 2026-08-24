"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Upload,
  CheckCircle,
  TrendingUp,
  Repeat,
  FilePlus,
} from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { StatCard } from "@/components/ui/StatCard";
import { NoteCard } from "@/components/notes/NoteCard";
import { DeleteNoteDialog } from "@/components/notes/DeleteNoteDialog";
import { Button } from "@/components/ui/Button";
import { useNotes } from "@/hooks/useNotes";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { deleteNote } from "@/services/note.service";

interface DeleteTarget {
  id: string;
  title: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { notes, meta, isLoading, error, refetch } = useNotes({
    limit: 3,
    sortBy: "createdAt",
    search: search.trim() || undefined,
  });

  const mostRecentNote = notes[0] ?? null;

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
      refetch();
    } catch (cause) {
      setDeleteError(
        cause instanceof Error ? cause.message : t("dashboard.deleteFailed"),
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <Topbar
        title={t("dashboard.welcome", {
          name: user?.name ? `, ${user.name}` : "",
        })}
        search={{
          value: search,
          onChange: setSearch,
          placeholder: t("dashboard.search"),
        }}
      />

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          value={meta?.total ?? "—"}
          label={t("dashboard.notesUploaded")}
          icon={Upload}
          tone="violet"
          delta="+12%"
          deltaType="up"
        />
        <StatCard
          value="—"
          label={t("dashboard.quizzesCompleted")}
          icon={CheckCircle}
          tone="coral"
          delta="+8%"
          deltaType="up"
        />
        <StatCard
          value="—"
          label={t("dashboard.averageScore")}
          icon={TrendingUp}
          tone="sage"
          delta="+21%"
          deltaType="up"
        />
        <StatCard
          value="—"
          label={t("dashboard.cardsReviewed")}
          icon={Repeat}
          tone="slate"
          delta="−3%"
          deltaType="down"
        />
      </div>

      {mostRecentNote && (
        <div className="relative mb-8 overflow-hidden rounded-card bg-ink p-6 text-paper-raised shadow-sm transition hover:shadow-md">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-yellow/10 blur-2xl" />

          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="mb-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-yellow">
                {t("dashboard.continueStudying")}
              </div>

              <h3 className="font-serif text-[18px] font-semibold">
                {mostRecentNote.title}
              </h3>

              <p className="mt-1 text-[13px] text-ink-invert-soft">
                {mostRecentNote.summary
                  ? t("dashboard.ready")
                  : t("dashboard.processing")}
              </p>
            </div>

            <Link href={`/student/notes/${mostRecentNote.id}`}>
              <Button
                variant="yellow"
                className="group bg-yellow text-ink hover:brightness-95"
              >
                {t("dashboard.continue")}
                <ArrowRight
                  className="ml-1 transition group-hover:translate-x-1"
                  size={16}
                  strokeWidth={1.8}
                />
              </Button>
            </Link>
          </div>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-serif text-[17px] font-semibold text-ink">
          {t("dashboard.recentNotes")}
        </h2>

        <Link
          href="/student/notes"
          className="text-[13px] font-medium text-ink-soft hover:text-ink"
        >
          {t("dashboard.viewAll")}
        </Link>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-card border border-line bg-paper-raised p-4"
            >
              <div className="flex items-start justify-between">
                <div className="h-9 w-9 rounded-lg bg-line-soft" />
                <div className="h-3 w-16 rounded bg-line-soft" />
              </div>
              <div className="mt-3 h-5 w-3/4 rounded bg-line-soft" />
              <div className="mt-2 h-4 w-1/2 rounded bg-line-soft" />
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-[13px] text-coral">{error}</p>}

      {!isLoading && !error && notes.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-card border-2 border-dashed border-line bg-paper-raised p-12 text-center">
          <div className="mb-4 text-ink-faint">
            <FilePlus size={48} strokeWidth={1.5} />
          </div>

          <h3 className="font-serif text-lg font-semibold text-ink">
            {t("dashboard.noNotes")}
          </h3>

          <p className="mt-1 text-sm text-ink-soft">
            {t("dashboard.noNotesDescription")}
          </p>
        </div>
      )}

      {!isLoading && !error && notes.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
