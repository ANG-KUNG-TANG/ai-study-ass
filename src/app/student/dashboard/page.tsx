"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle,
  FilePlus,
  Repeat,
  TrendingUp,
  Upload,
} from "lucide-react";
import { useState } from "react";

import { Topbar } from "@/components/layout/Topbar";
import { DeleteNoteDialog } from "@/components/notes/DeleteNoteDialog";
import { NoteCard } from "@/components/notes/NoteCard";
import { StatCard } from "@/components/ui/StatCard";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useNotes } from "@/hooks/useNotes";
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
    setDeleteTarget({ id: note.id, title: note.title });
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
        eyebrow={t("dashboard.eyebrow")}
        title={t("dashboard.welcome", {
          name: user?.name ? `, ${user.name}` : "",
        })}
        description={t("dashboard.description")}
        search={{
          value: search,
          onChange: setSearch,
          placeholder: t("dashboard.search"),
        }}
        actions={(
          <Link
            href="/student/notes"
            className="inline-flex min-h-10 items-center gap-2 rounded-[8px] bg-ink px-4 text-[13px] font-semibold text-paper-raised transition hover:opacity-90"
          >
            <Upload size={15} strokeWidth={1.8} aria-hidden="true" />
            {t("notes.title")}
          </Link>
        )}
      />

      {mostRecentNote ? (
        <section className="mb-7 border-l-[3px] border-yellow bg-ink px-5 py-5 text-paper-raised sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div className="min-w-0">
              <div className="mb-1 font-mono text-[10.5px] uppercase tracking-[0.11em] text-yellow">
                {t("dashboard.continueStudying")}
              </div>
              <h2 className="truncate font-serif text-[20px] font-semibold">
                {mostRecentNote.title}
              </h2>
              <p className="mt-1 text-[12.5px] text-ink-invert-soft">
                {mostRecentNote.summary
                  ? t("dashboard.ready")
                  : t("dashboard.processing")}
              </p>
            </div>

            <Link
              href={`/student/notes/${mostRecentNote.id}`}
              className="group inline-flex min-h-10 items-center gap-2 rounded-[8px] bg-yellow px-4 text-[13px] font-semibold text-ink transition hover:brightness-95"
            >
              {t("dashboard.continue")}
              <ArrowRight
                className="transition-transform group-hover:translate-x-0.5"
                size={16}
                strokeWidth={1.8}
                aria-hidden="true"
              />
            </Link>
          </div>
        </section>
      ) : null}

      <section className="mb-7 grid grid-cols-2 border-l border-t border-line sm:grid-cols-4 sm:border-b">
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
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section className="min-w-0">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <span className="editorial-kicker">{t("dashboard.libraryKicker")}</span>
              <h2 className="mt-1 font-serif text-[19px] font-semibold text-ink">
                {t("dashboard.recentNotes")}
              </h2>
            </div>
            <Link
              href="/student/notes"
              className="text-[12.5px] font-medium text-ink-soft hover:text-ink"
            >
              {t("dashboard.viewAll")}
            </Link>
          </div>

          {isLoading && (
            <div className="border-y border-line">
              {[...Array(3)].map((_, index) => (
                <div key={index} className="animate-pulse border-b border-line-soft px-2 py-5 last:border-b-0">
                  <div className="h-4 w-1/2 rounded bg-line-soft" />
                  <div className="mt-2 h-3 w-3/4 rounded bg-line-soft" />
                </div>
              ))}
            </div>
          )}

          {error && <p className="editorial-callout border-coral text-coral">{error}</p>}

          {!isLoading && !error && notes.length === 0 && (
            <div className="border-y border-dashed border-line px-6 py-12 text-center">
              <FilePlus className="mx-auto text-ink-faint" size={34} strokeWidth={1.5} />
              <h3 className="mt-3 font-serif text-[17px] font-semibold text-ink">
                {t("dashboard.noNotes")}
              </h3>
              <p className="mt-1 text-[13px] text-ink-soft">
                {t("dashboard.noNotesDescription")}
              </p>
            </div>
          )}

          {!isLoading && !error && notes.length > 0 && (
            <div className="border-y border-line">
              {notes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={{ ...note, summary: note.summary ?? undefined }}
                  onDelete={requestDelete}
                  isDeleting={isDeleting && deleteTarget?.id === note.id}
                />
              ))}
            </div>
          )}
        </section>

        <aside className="min-w-0 border-t border-line pt-4">
          <span className="editorial-kicker">{t("dashboard.rhythmKicker")}</span>
          <h2 className="mt-1 font-serif text-[18px] font-semibold text-ink">{t("dashboard.rhythmTitle")}</h2>
          <ol className="mt-4 border-y border-line">
            <li className="border-b border-line-soft py-3 text-[12.5px] text-ink-soft"><strong className="mr-2 text-ink">01</strong> {t("dashboard.rhythmRead")}</li>
            <li className="border-b border-line-soft py-3 text-[12.5px] text-ink-soft"><strong className="mr-2 text-ink">02</strong> {t("dashboard.rhythmReview")}</li>
            <li className="py-3 text-[12.5px] text-ink-soft"><strong className="mr-2 text-ink">03</strong> {t("dashboard.rhythmPractise")}</li>
          </ol>
          <p className="mt-4 text-[12px] leading-5 text-ink-faint">
            {t("dashboard.floatingNote")}
          </p>
        </aside>
      </div>

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
