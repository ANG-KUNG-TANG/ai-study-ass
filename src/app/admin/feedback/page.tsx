"use client";

import {
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  Save,
  Star,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Topbar } from "@/components/layout/Topbar";
import { useLanguage } from "@/context/LanguageContext";
import type { Locale, TranslationKey } from "@/i18n/translations";
import {
  exportAdminFeedback,
  listAdminFeedback,
  updateAdminFeedback,
} from "@/services/feedback.service";
import type {
  AdminFeedbackSubmission,
  FeedbackStatus,
  FeedbackType,
} from "@/types/feedback";
import type { PaginationMeta } from "@/types/pagination";

const PAGE_SIZE = 20;

const typeKeys: Record<FeedbackType, TranslationKey> = {
  general: "feedback.type.general",
  suggestion: "feedback.type.suggestion",
  feature_request: "feedback.type.feature_request",
  bug: "feedback.type.bug",
};

const statusKeys: Record<FeedbackStatus, TranslationKey> = {
  new: "feedback.status.new",
  reviewing: "feedback.status.reviewing",
  planned: "feedback.status.planned",
  implemented: "feedback.status.implemented",
  closed: "feedback.status.closed",
};

const typeTone: Record<FeedbackType, string> = {
  general: "bg-slate-soft text-slate",
  suggestion: "bg-yellow-soft text-ink",
  feature_request: "bg-violet-soft text-violet",
  bug: "bg-coral-soft text-coral",
};

function ReviewCard({
  entry,
  locale,
  onUpdated,
  t,
}: {
  entry: AdminFeedbackSubmission;
  locale: Locale;
  onUpdated: (entry: AdminFeedbackSubmission) => void;
  t: (key: TranslationKey, values?: Record<string, string | number>) => string;
}) {
  const [reviewStatus, setReviewStatus] = useState(entry.status);
  const [adminNote, setAdminNote] = useState(entry.adminNote);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function saveReview() {
    setIsSaving(true);
    setMessage(null);

    try {
      const updated = await updateAdminFeedback(entry.id, {
        status: reviewStatus,
        adminNote,
      });
      onUpdated(updated);
      setMessage(t("admin.feedback.saved"));
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? cause.message
          : t("admin.feedback.updateFailed"),
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <article className="rounded-[10px] border border-line bg-paper-raised p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line-soft pb-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[9.5px] font-bold ${typeTone[entry.type]}`}>
              {t(typeKeys[entry.type])}
            </span>
            <span className="text-[10px] text-ink-faint">
              {new Date(entry.createdAt).toLocaleString(locale)}
            </span>
          </div>
          <h2 className="mt-2 text-[16px] font-bold leading-6 tracking-[-0.025em] text-ink">
            {entry.title}
          </h2>
          <p className="mt-1 text-[11px] text-ink-soft">{entry.userEmail}</p>
        </div>

        {entry.rating && (
          <div className="flex items-center gap-1 rounded-full bg-yellow-soft px-2.5 py-1 text-[10px] font-bold text-ink">
            <Star size={12} fill="currentColor" />
            {entry.rating}/5
          </div>
        )}
      </div>

      <p className="whitespace-pre-wrap break-words py-4 text-[12.5px] leading-6 text-ink">
        {entry.message}
      </p>

      {entry.sourcePath && (
        <div className="mb-4 truncate rounded-[7px] bg-paper px-3 py-2 text-[10px] text-ink-faint" title={entry.sourcePath}>
          {t("feedback.contextLabel")}: {entry.sourcePath}
        </div>
      )}

      <div className="grid gap-3 border-t border-line-soft pt-4 lg:grid-cols-[190px_minmax(0,1fr)_auto] lg:items-end">
        <label className="block">
          <span className="mb-1.5 block text-[10.5px] font-semibold text-ink-soft">
            Status
          </span>
          <select
            value={reviewStatus}
            onChange={(event) => setReviewStatus(event.target.value as FeedbackStatus)}
            className="h-10 w-full rounded-[8px] border border-line bg-paper px-3 text-[12px] text-ink outline-none focus:border-yellow"
          >
            {(Object.keys(statusKeys) as FeedbackStatus[]).map((status) => (
              <option key={status} value={status}>{t(statusKeys[status])}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[10.5px] font-semibold text-ink-soft">
            {t("admin.feedback.adminNote")}
          </span>
          <textarea
            value={adminNote}
            onChange={(event) => setAdminNote(event.target.value)}
            maxLength={2_000}
            rows={2}
            placeholder={t("admin.feedback.adminNotePlaceholder")}
            className="min-h-10 w-full resize-y rounded-[8px] border border-line bg-paper px-3 py-2 text-[12px] leading-5 text-ink outline-none placeholder:text-ink-faint focus:border-yellow"
          />
        </label>

        <button
          type="button"
          onClick={() => void saveReview()}
          disabled={isSaving}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-ink px-4 text-[11.5px] font-bold text-paper-raised disabled:opacity-50"
        >
          <Save size={14} />
          {isSaving ? t("admin.feedback.saving") : t("admin.feedback.save")}
        </button>
      </div>

      {message && (
        <p className="mt-2 text-[10.5px] text-ink-soft" role="status">{message}</p>
      )}
    </article>
  );
}

export default function AdminFeedbackPage() {
  const { locale, t } = useLanguage();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"" | FeedbackType>("");
  const [status, setStatus] = useState<"" | FeedbackStatus>("");
  const [data, setData] = useState<AdminFeedbackSubmission[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (requestedPage: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await listAdminFeedback({
        page: requestedPage,
        limit: PAGE_SIZE,
        search: search.trim() || undefined,
        type: type || undefined,
        status: status || undefined,
      });
      setData(result.data);
      setMeta(result.meta);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("admin.feedback.loadFailed"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [search, status, t, type]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(page), 180);
    return () => window.clearTimeout(timer);
  }, [load, page]);

  async function handleExport() {
    setError(null);
    try {
      await exportAdminFeedback({
        search: search.trim() || undefined,
        type: type || undefined,
        status: status || undefined,
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("admin.feedback.exportFailed"),
      );
    }
  }

  return (
    <>
      <Topbar
        eyebrow={t("admin.eyebrow")}
        title={t("admin.feedback.title")}
        description={t("admin.feedback.description")}
        actions={(
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleExport()}
              className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-line px-3 text-[11px] font-semibold text-ink-soft hover:bg-line-soft"
            >
              <Download size={14} />
              {t("admin.feedback.export")}
            </button>
            <button
              type="button"
              onClick={() => void load(page)}
              disabled={isLoading}
              className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-line px-3 text-[11px] font-semibold text-ink-soft hover:bg-line-soft disabled:opacity-50"
            >
              <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
              {t("admin.feedback.refresh")}
            </button>
          </div>
        )}
      />

      <div className="mb-4 grid gap-2 border-y border-line py-3 sm:grid-cols-3">
        <input
          value={search}
          onChange={(event) => { setSearch(event.target.value); setPage(1); }}
          placeholder={t("admin.feedback.searchPlaceholder")}
          className="h-10 rounded-[8px] border border-line bg-paper-raised px-3 text-[12px] outline-none focus:border-yellow"
        />
        <select
          value={type}
          onChange={(event) => { setType(event.target.value as typeof type); setPage(1); }}
          className="h-10 rounded-[8px] border border-line bg-paper-raised px-3 text-[12px] outline-none focus:border-yellow"
        >
          <option value="">{t("admin.feedback.allTypes")}</option>
          {(Object.keys(typeKeys) as FeedbackType[]).map((value) => (
            <option key={value} value={value}>{t(typeKeys[value])}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(event) => { setStatus(event.target.value as typeof status); setPage(1); }}
          className="h-10 rounded-[8px] border border-line bg-paper-raised px-3 text-[12px] outline-none focus:border-yellow"
        >
          <option value="">{t("admin.feedback.allStatuses")}</option>
          {(Object.keys(statusKeys) as FeedbackStatus[]).map((value) => (
            <option key={value} value={value}>{t(statusKeys[value])}</option>
          ))}
        </select>
      </div>

      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[10.5px] text-ink-faint">
          {meta ? t("admin.feedback.total", { count: meta.total.toLocaleString(locale) }) : ""}
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded-[8px] bg-coral-soft px-3 py-2.5 text-[12px] text-coral" role="alert">
          {error}
        </p>
      )}

      {isLoading && data.length === 0 ? (
        <p className="py-12 text-center text-[12px] text-ink-faint">{t("common.loading")}</p>
      ) : data.length === 0 ? (
        <p className="rounded-[10px] border border-line bg-paper-raised px-4 py-12 text-center text-[12px] text-ink-soft">
          {t("admin.feedback.empty")}
        </p>
      ) : (
        <div className={`space-y-3 transition-opacity ${isLoading ? "opacity-60" : "opacity-100"}`}>
          {data.map((entry) => (
            <ReviewCard
              key={entry.id}
              entry={entry}
              locale={locale}
              t={t}
              onUpdated={(updated) => {
                setData((current) => current.map((item) => item.id === updated.id ? updated : item));
              }}
            />
          ))}
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
          <button
            type="button"
            disabled={!meta.hasPrev || isLoading}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="inline-flex h-9 items-center gap-1 rounded-[8px] border border-line px-3 text-[11px] text-ink-soft disabled:opacity-40"
          >
            <ChevronLeft size={14} />
            {t("common.previous")}
          </button>
          <span className="text-[10.5px] text-ink-faint">{meta.page} / {meta.totalPages}</span>
          <button
            type="button"
            disabled={!meta.hasNext || isLoading}
            onClick={() => setPage((current) => current + 1)}
            className="inline-flex h-9 items-center gap-1 rounded-[8px] border border-line px-3 text-[11px] text-ink-soft disabled:opacity-40"
          >
            {t("common.next")}
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </>
  );
}
