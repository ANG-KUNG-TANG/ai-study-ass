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
import {
  useLanguage,
} from "@/context/LanguageContext";
import type {
  Locale,
  TranslationKey,
  TranslationValues,
} from "@/i18n/translations";

export type StudyFeature =
  | "summary"
  | "quiz"
  | "flashcards"
  | "chat";

interface FeatureNoteListProps {
  feature: StudyFeature;
}

interface FeatureConfig {
  titleKey: TranslationKey;
  eyebrowKey: TranslationKey;
  descriptionKey: TranslationKey;
  emptyTitleKey: TranslationKey;
  emptyDescriptionKey: TranslationKey;
  actionLabelKey: TranslationKey;
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
      titleKey:
        "feature.summaries",
      eyebrowKey:
        "feature.studyMaterials",
      descriptionKey:
        "feature.summariesDescription",
      emptyTitleKey:
        "feature.noNotes",
      emptyDescriptionKey:
        "feature.summariesEmpty",
      actionLabelKey:
        "feature.openSummary",
      icon:
        AlignLeft,
      iconClassName:
        "bg-coral-soft text-coral",
    },

    quiz: {
      titleKey:
        "feature.quizzes",
      eyebrowKey:
        "feature.studyMaterials",
      descriptionKey:
        "feature.quizzesDescription",
      emptyTitleKey:
        "feature.noNotes",
      emptyDescriptionKey:
        "feature.quizzesEmpty",
      actionLabelKey:
        "feature.openQuiz",
      icon:
        HelpCircle,
      iconClassName:
        "bg-violet-soft text-violet",
    },

    flashcards: {
      titleKey:
        "nav.flashcards",
      eyebrowKey:
        "feature.studyMaterials",
      descriptionKey:
        "feature.flashcardsDescription",
      emptyTitleKey:
        "feature.noNotes",
      emptyDescriptionKey:
        "feature.flashcardsEmpty",
      actionLabelKey:
        "feature.openFlashcards",
      icon:
        Copy,
      iconClassName:
        "bg-sage-soft text-sage",
    },

    chat: {
      titleKey:
        "nav.chat",
      eyebrowKey:
        "feature.studyAssistant",
      descriptionKey:
        "feature.chatDescription",
      emptyTitleKey:
        "feature.noNotes",
      emptyDescriptionKey:
        "feature.chatEmpty",
      actionLabelKey:
        "feature.openChat",
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
  locale: Locale,
  t: (key: TranslationKey, values?: TranslationValues) => string,
): string {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return t("common.unknownDate");
  }

  return new Intl.DateTimeFormat(
    locale,
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    },
  ).format(date);
}

function formatFileSize(
  bytes: number,
  t: (key: TranslationKey, values?: TranslationValues) => string,
): string {
  if (
    !Number.isFinite(bytes) ||
    bytes <= 0
  ) {
    return t("common.unknownSize");
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
  t: (key: TranslationKey, values?: TranslationValues) => string,
): string {
  const summary =
    note.summary?.trim();

  if (summary) {
    return summary;
  }

  return t("feature.preview");
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
  const {
    locale,
    t,
  } = useLanguage();
  const Icon =
    config.icon;

  const summaryReady =
    feature === "summary" &&
    Boolean(
      note.summary?.trim(),
    );

  return (
    <article className="group editorial-row flex min-w-0 flex-col gap-3 px-2 py-4 transition-colors hover:bg-paper-raised sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div
          className={[
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
            config.iconClassName,
          ].join(" ")}
        >
          <Icon
            size={16}
            strokeWidth={1.8}
            aria-hidden="true"
          />
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate font-serif text-[16px] font-semibold leading-snug text-ink">
              {note.title}
            </h2>
            <span className="rounded-full bg-line-soft px-2 py-1 font-mono text-[9.5px] uppercase tracking-wide text-ink-faint">
              {note.fileType}
            </span>
          </div>
          <p className="mt-1 line-clamp-1 text-[12px] leading-5 text-ink-soft">
            {summaryPreview(note, t)}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] text-ink-faint">
            <span>{formatDate(note.createdAt, locale, t)}</span>
            <span aria-hidden="true">·</span>
            <span>{formatFileSize(note.fileSize, t)}</span>
          </div>
        </div>
      </div>

      <Link
        href={featureHref(note.id, feature)}
        className="flex shrink-0 items-center justify-between gap-3 rounded-[8px] border border-line bg-paper px-3 py-2.5 text-[12.5px] font-medium text-ink transition hover:bg-line-soft"
      >
        <span>{summaryReady ? t("feature.viewSummary") : t(config.actionLabelKey)}</span>
        <ArrowRight size={15} strokeWidth={1.8} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </Link>
    </article>
  );
}

export function FeatureNoteList({
  feature,
}: FeatureNoteListProps) {
  const {
    t,
  } = useLanguage();
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
          t(config.eyebrowKey)
        }
        title={
          t(config.titleKey)
        }
        search={{
          value:
            search,
          onChange:
            setSearch,
          placeholder:
            t("feature.search"),
        }}
        actions={
          <button
            type="button"
            onClick={refetch}
            disabled={
              isLoading
            }
            className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-line bg-paper-raised px-3 text-[12px] font-medium text-ink-soft transition hover:bg-line-soft hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
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

            {t("common.refresh")}
          </button>
        }
      />

      <div className="-mt-5 mb-5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11.5px] text-ink-faint">
          {t(config.descriptionKey)}
        </p>

        <p className="font-mono text-[10px] text-ink-faint">
          {meta
            ? t(
                meta.total === 1
                  ? "feature.noteCountOne"
                  : "feature.noteCount",
                { count: meta.total.toLocaleString() },
              )
            : t("feature.loadingNotes")}
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
            {t("common.tryAgain")}
          </button>
        </div>
      )}

      {isLoading && (
        <div className="border-y border-line">
          {Array.from({
            length: 6,
          }).map(
            (_, index) => (
              <div
                key={index}
                className="animate-pulse border-b border-line-soft px-3 py-5 last:border-b-0"
              >
                <div className="h-5 w-2/3 rounded bg-line-soft" />
                <div className="mt-2 h-3 w-5/6 rounded bg-line-soft" />
              </div>
            ),
          )}
        </div>
      )}

      {!isLoading &&
        !error &&
        safeNotes.length ===
          0 && (
          <div className="flex min-h-[320px] flex-col items-center justify-center border-y border-dashed border-line px-6 py-12 text-center">
            <div
              className={[
                "flex h-12 w-12 items-center justify-center rounded-[10px]",
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
                ? t("feature.noMatch")
                : t(config.emptyTitleKey)}
            </h2>

            <p className="mt-2 max-w-md text-[12.5px] leading-5 text-ink-soft">
              {debouncedSearch
                ? t("feature.tryDifferent")
                : t(config.emptyDescriptionKey)}
            </p>

            <Link
              href="/student/notes"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-[12px] font-medium text-paper-raised transition hover:opacity-90"
            >
              <FileText
                size={14}
                strokeWidth={1.8}
              />

              {t("feature.openNotes")}
            </Link>
          </div>
        )}

      {!isLoading &&
        !error &&
        safeNotes.length >
          0 && (
          <>
            <div className="border-y border-line">
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
                {t("common.previous")}
              </button>

              <span className="font-mono text-[10.5px] text-ink-faint">
                {t("notes.pageOf", {
                  page: currentPage,
                  total: totalPages,
                })}
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
                {t("common.next")}
              </button>
            </div>
          </>
        )}
    </>
  );
}
