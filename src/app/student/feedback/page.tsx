"use client";

import {
  Bug,
  CheckCircle2,
  Lightbulb,
  MessageSquareText,
  Send,
  Sparkles,
  Star,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/Button";
import { useLanguage } from "@/context/LanguageContext";
import type { TranslationKey } from "@/i18n/translations";
import {
  listOwnFeedback,
  submitFeedback,
} from "@/services/feedback.service";
import type {
  FeedbackStatus,
  FeedbackSubmission,
  FeedbackType,
} from "@/types/feedback";

const feedbackTypes: Array<{
  value: FeedbackType;
  label: TranslationKey;
  icon: typeof MessageSquareText;
  tone: string;
}> = [
  {
    value: "general",
    label: "feedback.type.general",
    icon: MessageSquareText,
    tone: "bg-slate-soft text-slate",
  },
  {
    value: "suggestion",
    label: "feedback.type.suggestion",
    icon: Lightbulb,
    tone: "bg-yellow-soft text-ink",
  },
  {
    value: "feature_request",
    label: "feedback.type.feature_request",
    icon: Sparkles,
    tone: "bg-violet-soft text-violet",
  },
  {
    value: "bug",
    label: "feedback.type.bug",
    icon: Bug,
    tone: "bg-coral-soft text-coral",
  },
];

const statusKeys: Record<FeedbackStatus, TranslationKey> = {
  new: "feedback.status.new",
  reviewing: "feedback.status.reviewing",
  planned: "feedback.status.planned",
  implemented: "feedback.status.implemented",
  closed: "feedback.status.closed",
};

const statusTone: Record<FeedbackStatus, string> = {
  new: "bg-slate-soft text-slate",
  reviewing: "bg-yellow-soft text-ink",
  planned: "bg-violet-soft text-violet",
  implemented: "bg-sage-soft text-sage",
  closed: "bg-line-soft text-ink-soft",
};

export default function StudentFeedbackPage() {
  const { locale, t } = useLanguage();
  const [type, setType] = useState<FeedbackType>("suggestion");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [sourcePath, setSourcePath] = useState("/student/feedback");
  const [recent, setRecent] = useState<FeedbackSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);

    try {
      setRecent(await listOwnFeedback(20));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("feedback.failed"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();

      try {
        const referrer = document.referrer ? new URL(document.referrer) : null;
        if (referrer?.origin === window.location.origin) {
          setSourcePath(`${referrer.pathname}${referrer.search}`.slice(0, 500));
        }
      } catch {
        // Keep the feedback page as the safe context fallback.
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await submitFeedback({ type, title, message, rating, sourcePath });
      setTitle("");
      setMessage("");
      setRating(null);
      setSuccess(t("feedback.success"));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("feedback.failed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Topbar
        eyebrow={t("feedback.eyebrow")}
        title={t("feedback.title")}
        description={t("feedback.description")}
      />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rounded-[10px] border border-line bg-paper-raised p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-3 border-b border-line pb-4">
            <span className="grid size-10 place-items-center rounded-[9px] bg-yellow-soft text-ink">
              <Send size={18} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <h2 className="text-[17px] font-bold tracking-[-0.025em] text-ink">
              {t("feedback.formTitle")}
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <fieldset>
              <legend className="mb-2 text-[12px] font-semibold text-ink-soft">
                {t("feedback.typeLabel")}
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {feedbackTypes.map(({ value, label, icon: Icon, tone }) => {
                  const selected = type === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setType(value)}
                      aria-pressed={selected}
                      className={`flex min-h-12 items-center gap-3 rounded-[9px] border px-3 text-left text-[12.5px] font-semibold transition-colors ${
                        selected
                          ? "border-ink bg-line-soft text-ink"
                          : "border-line bg-paper text-ink-soft hover:border-ink/30"
                      }`}
                    >
                      <span className={`grid size-8 shrink-0 place-items-center rounded-full ${tone}`}>
                        <Icon size={15} strokeWidth={1.8} aria-hidden="true" />
                      </span>
                      {t(label)}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div>
              <label htmlFor="feedback-title" className="mb-1.5 block text-[12px] font-semibold text-ink-soft">
                {t("feedback.titleLabel")}
              </label>
              <input
                id="feedback-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                minLength={5}
                maxLength={120}
                required
                placeholder={t("feedback.titlePlaceholder")}
                className="h-12 w-full rounded-[9px] border border-line bg-paper px-3.5 text-[13px] text-ink outline-none placeholder:text-ink-faint focus:border-yellow focus:ring-2 focus:ring-yellow-soft"
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <label htmlFor="feedback-message" className="text-[12px] font-semibold text-ink-soft">
                  {t("feedback.messageLabel")}
                </label>
                <span className="text-[10px] text-ink-faint">
                  {message.length.toLocaleString(locale)} / 5,000
                </span>
              </div>
              <textarea
                id="feedback-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                minLength={10}
                maxLength={5_000}
                required
                rows={7}
                placeholder={t("feedback.messagePlaceholder")}
                className="w-full resize-y rounded-[9px] border border-line bg-paper px-3.5 py-3 text-[13px] leading-6 text-ink outline-none placeholder:text-ink-faint focus:border-yellow focus:ring-2 focus:ring-yellow-soft"
              />
            </div>

            <fieldset>
              <legend className="mb-2 text-[12px] font-semibold text-ink-soft">
                {t("feedback.ratingLabel")}{" "}
                <span className="font-normal text-ink-faint">({t("feedback.ratingOptional")})</span>
              </legend>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRating(rating === value ? null : value)}
                    aria-label={`${value} of 5`}
                    aria-pressed={rating === value}
                    className={`grid size-10 place-items-center rounded-[8px] border transition-colors ${
                      rating !== null && value <= rating
                        ? "border-yellow-line bg-yellow-soft text-ink"
                        : "border-line bg-paper text-ink-faint hover:text-ink"
                    }`}
                  >
                    <Star size={17} fill={rating !== null && value <= rating ? "currentColor" : "none"} />
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="rounded-[8px] border border-line-soft bg-paper px-3 py-2 text-[10.5px] text-ink-faint">
              <strong className="font-semibold text-ink-soft">{t("feedback.contextLabel")}:</strong>{" "}
              {sourcePath}
            </div>

            {success && (
              <p className="flex items-start gap-2 rounded-[8px] bg-sage-soft px-3 py-2.5 text-[12px] leading-5 text-sage" role="status">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                {success}
              </p>
            )}
            {error && (
              <p className="rounded-[8px] bg-coral-soft px-3 py-2.5 text-[12px] leading-5 text-coral" role="alert">
                {error}
              </p>
            )}

            <Button
              type="submit"
              variant="yellow"
              disabled={isSubmitting}
              className="min-h-11 rounded-full px-5 font-bold"
            >
              <Send size={15} />
              {isSubmitting ? t("feedback.submitting") : t("feedback.submit")}
            </Button>
          </form>
        </section>

        <aside className="rounded-[10px] border border-line bg-paper-raised p-5">
          <h2 className="text-[16px] font-bold tracking-[-0.02em] text-ink">
            {t("feedback.recentTitle")}
          </h2>
          <p className="mt-1 text-[11.5px] leading-5 text-ink-soft">
            {t("feedback.recentDescription")}
          </p>

          <div className="mt-4 border-t border-line pt-4">
            {isLoading ? (
              <p className="text-[12px] text-ink-faint">{t("common.loading")}</p>
            ) : recent.length === 0 ? (
              <p className="rounded-[8px] bg-paper px-3 py-5 text-center text-[12px] text-ink-soft">
                {t("feedback.empty")}
              </p>
            ) : (
              <ul className="space-y-3">
                {recent.map((entry) => (
                  <li key={entry.id} className="rounded-[8px] border border-line-soft bg-paper p-3">
                    <div className="flex items-start justify-between gap-2">
                      <strong className="line-clamp-2 text-[12.5px] leading-5 text-ink">
                        {entry.title}
                      </strong>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-bold ${statusTone[entry.status]}`}>
                        {t(statusKeys[entry.status])}
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-[11px] leading-5 text-ink-soft">
                      {entry.message}
                    </p>
                    <p className="mt-2 text-[9.5px] text-ink-faint">
                      {new Date(entry.createdAt).toLocaleString(locale)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
