"use client";

import Link from "next/link";
import {
  AlignLeft,
  ArrowRight,
  Copy,
  FileText,
  HelpCircle,
  MessageSquare,
  RefreshCw,
} from "lucide-react";
import type {
  LucideIcon,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Topbar,
} from "@/components/layout/Topbar";
import {
  useNotes,
} from "@/hooks/useNotes";
import type {
  Note,
} from "@/types/notes";

export type StudyFeature =
  | "summary"
  | "quiz"
  | "flashcards"
  | "chat";

interface FeatureNoteListProps {
  feature: StudyFeature;
}

interface FeatureConfig {
  title: string;
  eyebrow: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  actionLabel: string;
  icon: LucideIcon;
  iconClassName: string;
}

const PAGE_SIZE = 9;

const FEATURE_CONFIG:
  Record<
    StudyFeature,
    FeatureConfig
  > = {
    summary: {
      title:
        "Summaries",
      eyebrow:
        "Study materials",
      description:
        "Open a note to review its generated summary.",
      emptyTitle:
        "No notes available",
      emptyDescription:
        "Upload a PDF or DOCX before opening a generated summary.",
      actionLabel:
        "Open summary",
      icon:
        AlignLeft,
      iconClassName:
        "bg-coral-soft text-coral",
    },

    quiz: {
      title:
        "Quizzes",
      eyebrow:
        "Study materials",
      description:
        "Choose a note to open its quiz or generate missing questions.",
      emptyTitle:
        "No notes available",
      emptyDescription:
        "Upload a document before starting a quiz.",
      actionLabel:
        "Open quiz",
      icon:
        HelpCircle,
      iconClassName:
        "bg-violet-soft text-violet",
    },

    flashcards: {
      title:
        "Flashcards",
      eyebrow:
        "Study materials",
      description:
        "Choose a note to study its generated flashcard deck.",
      emptyTitle:
        "No notes available",
      emptyDescription:
        "Upload a document before reviewing flashcards.",
      actionLabel:
        "Open flashcards",
      icon:
        Copy,
      iconClassName:
        "bg-sage-soft text-sage",
    },

    chat: {
      title:
        "Chat",
      eyebrow:
        "Study assistant",
      description:
        "Choose a note and ask questions using its saved knowledge context.",
      emptyTitle:
        "No notes available",
      emptyDescription:
        "Upload a document before starting a note-based chat.",
      actionLabel:
        "Open chat",
      icon:
        MessageSquare,
      iconClassName:
        "bg-slate-soft text-slate",
    },
  };

function featureHref(
  noteId: string,
  feature: StudyFeature,
): string {
  return `/student/notes/${encodeURIComponent(
    noteId,
  )}/${feature}`;
}

function formatDate(
  value: string,
): string {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    },
  ).format(date);
}

function formatFileSize(
  bytes: number,
): string {
  if (
    !Number.isFinite(bytes) ||
    bytes <= 0
  ) {
    return "Unknown size";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (
    bytes <
    1024 * 1024
  ) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}

function summaryPreview(
  note: Note,
): string {
  const summary =
    note.summary?.trim();

  if (summary) {
    return summary;
  }

  return "Open this note to view its generated study material.";
}

function FeatureCard({
  note,
  feature,
  config,
}: {
  note: Note;
  feature: StudyFeature;
  config: FeatureConfig;
}) {
  const Icon =
    config.icon;

  const summaryReady =
    feature === "summary" &&
    Boolean(
      note.summary?.trim(),
    );

  return (
    <article className="group flex min-h-[220px] flex-col rounded-card border border-line bg-paper-raised p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-ink/15 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div
          className={[
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
            config.iconClassName,
          ].join(" ")}
        >
          <Icon
            size={16}
            strokeWidth={1.8}
            aria-hidden="true"
          />
        </div>

        <span className="rounded-full bg-line-soft px-2 py-1 font-mono text-[9.5px] uppercase tracking-wide text-ink-faint">
          {note.fileType}
        </span>
      </div>

      <h2 className="mt-4 line-clamp-2 font-serif text-[16px] font-semibold leading-snug text-ink">
        {note.title}
      </h2>

      <p className="mt-2 line-clamp-3 text-[12px] leading-5 text-ink-soft">
        {summaryPreview(
          note,
        )}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] text-ink-faint">
        <span>
          {formatDate(
            note.createdAt,
          )}
        </span>

        <span aria-hidden="true">
          ·
        </span>

        <span>
          {formatFileSize(
            note.fileSize,
          )}
        </span>
      </div>

      <div className="mt-auto pt-5">
        <Link
          href={featureHref(
            note.id,
            feature,
          )}
          className="flex w-full items-center justify-between rounded-xl border border-line bg-paper px-3 py-2.5 text-[12.5px] font-medium text-ink transition hover:border-ink/20 hover:bg-line-soft"
        >
          <span>
            {summaryReady
              ? "View summary"
              : config.actionLabel}
          </span>

          <ArrowRight
            size={15}
            strokeWidth={1.8}
            className="transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      </div>
    </article>
  );
}

export function FeatureNoteList({
  feature,
}: FeatureNoteListProps) {
  const config =
    FEATURE_CONFIG[feature];

  const EmptyIcon =
    config.icon;

  const [
    page,
    setPage,
  ] =
    useState(1);

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    debouncedSearch,
    setDebouncedSearch,
  ] =
    useState("");

  useEffect(() => {
    const timeout =
      window.setTimeout(
        () => {
          setDebouncedSearch(
            search.trim(),
          );

          setPage(1);
        },
        250,
      );

    return () => {
      window.clearTimeout(
        timeout,
      );
    };
  }, [search]);

  const {
    notes,
    meta,
    isLoading,
    error,
    refetch,
  } =
    useNotes({
      page,
      limit:
        PAGE_SIZE,
      sortBy:
        "createdAt",
      search:
        debouncedSearch ||
        undefined,
    });

  const safeNotes =
    useMemo(
      () =>
        Array.isArray(notes)
          ? notes
          : [],
      [notes],
    );

  const currentPage =
    meta?.page ??
    page;

  const totalPages =
    Math.max(
      meta?.totalPages ??
        1,
      1,
    );

  return (
    <>
      <Topbar
        eyebrow={
          config.eyebrow
        }
        title={
          config.title
        }
        search={{
          value:
            search,
          onChange:
            setSearch,
          placeholder:
            "Search notes…",
        }}
        actions={
          <button
            type="button"
            onClick={refetch}
            disabled={
              isLoading
            }
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-paper-raised px-3 text-[12px] font-medium text-ink-soft transition hover:bg-line-soft hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              size={14}
              strokeWidth={1.8}
              className={
                isLoading
                  ? "animate-spin"
                  : undefined
              }
            />

            Refresh
          </button>
        }
      />

      <div className="-mt-5 mb-5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11.5px] text-ink-faint">
          {config.description}
        </p>

        <p className="font-mono text-[10px] text-ink-faint">
          {meta
            ? `${meta.total.toLocaleString()} note${meta.total === 1 ? "" : "s"}`
            : "Loading notes…"}
        </p>
      </div>

      {error && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-coral/30 bg-coral-soft px-4 py-3">
          <p className="text-[12.5px] text-coral">
            {error}
          </p>

          <button
            type="button"
            onClick={refetch}
            className="rounded-lg border border-coral/30 px-3 py-1.5 text-[11px] font-medium text-coral hover:bg-paper-raised"
          >
            Try again
          </button>
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({
            length: 6,
          }).map(
            (_, index) => (
              <div
                key={index}
                className="min-h-[220px] animate-pulse rounded-card border border-line bg-paper-raised p-4"
              >
                <div className="h-9 w-9 rounded-xl bg-line-soft" />
                <div className="mt-4 h-5 w-3/4 rounded bg-line-soft" />
                <div className="mt-3 h-3 w-full rounded bg-line-soft" />
                <div className="mt-2 h-3 w-5/6 rounded bg-line-soft" />
                <div className="mt-8 h-10 w-full rounded-xl bg-line-soft" />
              </div>
            ),
          )}
        </div>
      )}

      {!isLoading &&
        !error &&
        safeNotes.length ===
          0 && (
          <div className="flex min-h-[320px] flex-col items-center justify-center rounded-card border-2 border-dashed border-line bg-paper-raised px-6 py-12 text-center">
            <div
              className={[
                "flex h-12 w-12 items-center justify-center rounded-2xl",
                config.iconClassName,
              ].join(" ")}
            >
              <EmptyIcon
                size={22}
                strokeWidth={1.7}
                aria-hidden="true"
              />
            </div>

            <h2 className="mt-4 font-serif text-[18px] font-semibold text-ink">
              {debouncedSearch
                ? "No matching notes"
                : config.emptyTitle}
            </h2>

            <p className="mt-2 max-w-md text-[12.5px] leading-5 text-ink-soft">
              {debouncedSearch
                ? "Try a different title or clear the search field."
                : config.emptyDescription}
            </p>

            <Link
              href="/student/notes"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-[12px] font-medium text-paper-raised transition hover:opacity-90"
            >
              <FileText
                size={14}
                strokeWidth={1.8}
              />

              Open notes
            </Link>
          </div>
        )}

      {!isLoading &&
        !error &&
        safeNotes.length >
          0 && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {safeNotes.map(
                (note) => (
                  <FeatureCard
                    key={
                      note.id
                    }
                    note={
                      note
                    }
                    feature={
                      feature
                    }
                    config={
                      config
                    }
                  />
                ),
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
              <button
                type="button"
                disabled={
                  isLoading ||
                  !(
                    meta?.hasPrev ??
                    currentPage >
                      1
                  )
                }
                onClick={() =>
                  setPage(
                    (value) =>
                      Math.max(
                        1,
                        value -
                          1,
                      ),
                  )
                }
                className="rounded-xl border border-line bg-paper-raised px-3.5 py-2 text-[12px] font-medium text-ink-soft transition hover:bg-line-soft hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>

              <span className="font-mono text-[10.5px] text-ink-faint">
                Page{" "}
                {currentPage} of{" "}
                {totalPages}
              </span>

              <button
                type="button"
                disabled={
                  isLoading ||
                  !(
                    meta?.hasNext ??
                    currentPage <
                      totalPages
                  )
                }
                onClick={() =>
                  setPage(
                    (value) =>
                      value + 1,
                  )
                }
                className="rounded-xl border border-line bg-paper-raised px-3.5 py-2 text-[12px] font-medium text-ink-soft transition hover:bg-line-soft hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </>
        )}
    </>
  );
}
