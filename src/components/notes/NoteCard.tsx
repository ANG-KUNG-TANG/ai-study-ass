"use client";

import Link from "next/link";
import {
  ArrowRight,
  FileText,
  File,
  FileSpreadsheet,
  Trash2,
  LoaderCircle,
} from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { Chip } from "@/components/ui/Chip";
import { useLanguage } from "@/context/LanguageContext";
import type { Locale } from "@/i18n/translations";

interface NoteCardProps {
  note: {
    id: string;
    title: string;
    summary?: string;
    createdAt: string;
    fileType?: string;
    quizCount?: number;
    flashcardCount?: number;
    status?: "ready" | "processing";
  };
  onDelete?: (id: string) => void;
  isDeleting?: boolean;
}

function getFileIcon(fileType: string = "pdf") {
  const type = fileType.toLowerCase();

  if (type.includes("pdf")) {
    return {
      icon: FileText,
      bg: "bg-coral-soft text-coral",
    };
  }

  if (type.includes("doc")) {
    return {
      icon: File,
      bg: "bg-slate-soft text-slate",
    };
  }

  return {
    icon: FileSpreadsheet,
    bg: "bg-violet-soft text-violet",
  };
}

function formatRelativeDate(value: string, locale: Locale): string {
  const elapsedSeconds = (new Date(value).getTime() - Date.now()) / 1000;
  const ranges = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.345, "week"],
    [12, "month"],
    [Number.POSITIVE_INFINITY, "year"],
  ] as const;
  let duration = elapsedSeconds;

  for (const [amount, unit] of ranges) {
    if (Math.abs(duration) < amount) {
      return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
        Math.round(duration),
        unit,
      );
    }

    duration /= amount;
  }

  return "";
}

export function NoteCard({
  note,
  onDelete,
  isDeleting = false,
}: NoteCardProps) {
  const { locale, t } = useLanguage();
  const { icon: FileIcon, bg } = getFileIcon(note.fileType);
  const timeAgo = formatRelativeDate(note.createdAt, locale);

  return (
    <article className="group editorial-row relative flex min-w-0 items-center gap-3 bg-transparent px-2 py-4 transition-colors hover:bg-paper-raised">
      <Link
        href={`/student/notes/${note.id}`}
        aria-label={note.title}
        className={`flex min-w-0 flex-1 items-start gap-3 ${isDeleting ? "pointer-events-none opacity-60" : ""}`}
      >
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${bg}`}
        >
          <Icon icon={FileIcon} size={16} />
        </div>

        <div className="min-w-0 flex-1">
          <h4 className="truncate font-serif text-[15px] font-semibold leading-snug text-ink">
            {note.title}
          </h4>
          <p className="mt-1 line-clamp-1 text-[12.5px] leading-5 text-ink-soft">
            {note.summary || t("note.noSummary")}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {note.status === "ready" && (
              <Chip tone="sage" className="text-[10px]">
                {t("note.summaryReady")}
              </Chip>
            )}
            {note.status === "processing" && (
              <Chip tone="neutral" className="text-[10px]">
                {t("note.processing")}
              </Chip>
            )}
            {note.quizCount && note.quizCount > 0 && (
              <Chip tone="violet" className="text-[10px]">
                {t("note.quizCount", { count: note.quizCount })}
              </Chip>
            )}
            {note.flashcardCount && note.flashcardCount > 0 && (
              <Chip tone="yellow" className="text-[10px]">
                {t("note.cardCount", { count: note.flashcardCount })}
              </Chip>
            )}
          </div>
        </div>

        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          <span className="font-mono text-[10.5px] text-ink-faint">
            {timeAgo}
          </span>
          <ArrowRight className="text-ink-faint transition-transform group-hover:translate-x-0.5" size={15} strokeWidth={1.7} />
        </div>
      </Link>

      {onDelete && (
        <button
          type="button"
          title={t("note.deleteLabel", { title: note.title })}
          aria-label={t("note.deleteLabel", { title: note.title })}
          disabled={isDeleting}
          onClick={() => onDelete(note.id)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-faint transition hover:bg-coral-soft hover:text-coral focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isDeleting ? (
            <LoaderCircle className="animate-spin" size={15} strokeWidth={1.8} />
          ) : (
            <Trash2 size={15} strokeWidth={1.8} />
          )}
        </button>
      )}
    </article>
  );
}
