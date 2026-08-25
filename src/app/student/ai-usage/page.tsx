"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  CheckCircle2,
  Clock3,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";

import {
  Topbar,
} from "@/components/layout/Topbar";

import {
  getStudentAIUsage,
} from "@/services/ai-usage.service";

import type {
  StudentAIUsage,
} from "@/types/ai-usage";
import { useLanguage } from "@/context/LanguageContext";
import type {
  Locale,
  TranslationKey,
  TranslationValues,
} from "@/i18n/translations";

type Translate = (
  key: TranslationKey,
  values?: TranslationValues,
) => string;

function formatLatency(
  value: number,
): string {
  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return "—";
  }

  return value >= 1_000
    ? `${(value / 1_000).toFixed(1)}s`
    : `${Math.round(value)}ms`;
}

function formatTime(
  value: string,
  locale: Locale,
): string {
  const date =
    new Date(value);

  return Number.isNaN(
    date.getTime(),
  )
    ? "—"
    : date.toLocaleString(locale);
}

function quotaValue(
  used: number,
  limit: number | null,
  remaining: number | null,
  locale: Locale,
  t: Translate,
): {
  main: string;
  detail: string;
} {
  if (limit === null) {
    return {
      main:
        used.toLocaleString(locale),

      detail:
        t("student.ai.unlimited"),
    };
  }

  return {
    main:
      `${used.toLocaleString(locale)} / ${limit.toLocaleString(locale)}`,

    detail:
      t("student.ai.remaining", {
        count: (remaining ?? 0).toLocaleString(locale),
      }),
  };
}

export default function StudentAIUsagePage() {
  const { locale, t } = useLanguage();
  const [
    data,
    setData,
  ] =
    useState<StudentAIUsage | null>(
      null,
    );

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);

  const load =
    useCallback(
      async () => {
        try {
          const result =
            await getStudentAIUsage();

          setData(result);
          setError(null);
        } catch (cause) {
          setError(
            cause instanceof Error
              ? cause.message
              : t("student.ai.unavailable"),
          );
        } finally {
          setRefreshing(false);
        }
      },
      [t],
    );

  useEffect(() => {
    const timer =
      window.setTimeout(
        () => {
          void load();
        },
        0,
      );

    return () => {
      window.clearTimeout(
        timer,
      );
    };
  }, [load]);

  const refresh =
    useCallback(() => {
      setRefreshing(true);
      void load();
    }, [load]);

  return (
    <>
      <Topbar
        eyebrow={t("student.ai.account")}
        title={t("student.ai.title")}
      />

      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-[12px] text-ink-faint">
          {t("student.ai.description")}
        </p>

        <button
          type="button"
          disabled={refreshing}
          onClick={refresh}
          className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-[12px] text-ink-soft disabled:opacity-50"
        >
          <RefreshCw
            size={14}
            className={
              refreshing
                ? "animate-spin"
                : ""
            }
          />
          {t("common.refresh")}
        </button>
      </div>

      {error && (
        <div className="mb-5 rounded-xl border border-coral/30 bg-coral-soft px-4 py-3 text-[12px] text-coral">
          {error}
        </div>
      )}

      {!data && !error && (
        <div className="rounded-xl border border-line bg-paper-raised px-4 py-10 text-center text-[12px] text-ink-faint">
          {t("student.ai.loading")}
        </div>
      )}

      {data && (
        <>
          <section className="mb-5 rounded-xl border border-line bg-paper-raised p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck
                    size={17}
                    className="text-ink-faint"
                  />

                  <h2 className="font-serif text-[16px] font-semibold text-ink">
                    {t("student.ai.allowance")}
                  </h2>
                </div>

                <p className="mt-1 text-[11px] text-ink-faint">
                  {t("student.ai.allowanceDescription")}
                </p>
              </div>

              <span
                className={
                  data.quota.allowed
                    ? "rounded-full bg-line-soft px-2.5 py-1 text-[10px] font-medium text-ink-soft"
                    : "rounded-full bg-coral-soft px-2.5 py-1 text-[10px] font-medium text-coral"
                }
              >
                {!data.quota.providerAccessEnabled
                  ? "Provider access disabled"
                  : data.quota.enabled
                    ? data.quota.allowed
                      ? t("student.ai.available")
                      : t("student.ai.limitReached")
                    : t("student.ai.unlimited")}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              {[
                {
                  label:
                    t("student.ai.providerRequests"),
                  ...quotaValue(
                    data.quota.requestsUsed,
                    data.quota.requestLimit,
                    data.quota.requestsRemaining,
                    locale,
                    t,
                  ),
                },
                {
                  label:
                    t("student.ai.providerTokens"),
                  ...quotaValue(
                    data.quota.tokensUsed,
                    data.quota.tokenLimit,
                    data.quota.tokensRemaining,
                    locale,
                    t,
                  ),
                },
                {
                  label: "Estimated cost today",
                  main: `$${data.quota.estimatedCostUsd.toFixed(4)}`,
                  detail:
                    data.quota.source === "user_override"
                      ? "Your administrator configured a custom AI policy."
                      : "Using the system AI policy.",
                },
              ].map(
                (item) => (
                  <div
                    key={item.label}
                    className="rounded-lg border border-line-soft p-4"
                  >
                    <p className="text-[11px] text-ink-faint">
                      {item.label}
                    </p>

                    <p className="mt-2 font-mono text-[18px] font-semibold text-ink">
                      {item.main}
                    </p>

                    <p className="mt-1 text-[10px] text-ink-faint">
                      {item.detail}
                    </p>
                  </div>
                ),
              )}
            </div>

            <p className="mt-3 text-[10px] text-ink-faint">
              {t("student.ai.resets", {
                value: formatTime(data.quota.resetsAt, locale),
              })}
            </p>
          </section>

          <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-7">
            {[
              [
                t("admin.ai.requestsToday"),
                data.summary.requestsToday.toLocaleString(locale),
              ],
              [
                t("admin.ai.tokensToday"),
                data.summary.tokensToday.toLocaleString(locale),
              ],
              [
                t("admin.ai.successRate"),
                `${data.summary.successRate.toFixed(1)}%`,
              ],
              [
                t("admin.ai.successful"),
                data.summary.successesToday.toLocaleString(locale),
              ],
              [
                t("admin.ai.failed"),
                data.summary.failuresToday.toLocaleString(locale),
              ],
              [
                t("admin.ai.averageLatency"),
                formatLatency(
                  data.summary.averageLatencyMs,
                ),
              ],
              [
                "Estimated cost",
                `$${data.summary.estimatedCostToday.toFixed(4)}`,
              ],
            ].map(
              ([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-line bg-paper-raised p-4"
                >
                  <p className="text-[11px] text-ink-faint">
                    {label}
                  </p>

                  <p className="mt-2 font-serif text-2xl font-semibold text-ink">
                    {value}
                  </p>
                </div>
              ),
            )}
          </section>

          <section className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-line bg-paper-raised p-5">
              <h2 className="font-serif text-[16px] font-semibold text-ink">
                {t("student.ai.lastSevenDays")}
              </h2>

              <div className="mt-4 divide-y divide-line-soft">
                {data.lastSevenDays.map(
                  (day) => (
                    <div
                      key={day.date}
                      className="flex items-center justify-between py-3 text-[12px]"
                    >
                      <div>
                        <p className="text-ink">
                          {day.label}
                        </p>

                        <p className="mt-0.5 text-[10px] text-ink-faint">
                          {day.date}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="font-mono text-ink">
                          {t(
                            day.requests === 1
                              ? "student.ai.requestCountOne"
                              : "student.ai.requestCount",
                            { count: day.requests },
                          )}
                        </p>

                        <p className="mt-0.5 font-mono text-[10px] text-ink-faint">
                          {t("student.ai.tokenCount", {
                            count: day.tokens.toLocaleString(locale),
                          })}
                        </p>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>

            <div className="rounded-xl border border-line bg-paper-raised p-5">
              <h2 className="font-serif text-[16px] font-semibold text-ink">
                {t("student.ai.providerUsage")}
              </h2>

              <div className="mt-4 space-y-3">
                {data.providers.map(
                  (provider) => (
                    <div
                      key={provider.provider}
                      className="rounded-lg border border-line-soft p-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="capitalize text-[12px] font-medium text-ink">
                          {provider.provider}
                        </span>

                        <span className="font-mono text-[11px] text-ink-soft">
                          {t("student.ai.requestCount", {
                            count: provider.requests,
                          })}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-3 text-[10px]">
                        <div>
                          <p className="text-ink-faint">
                            {t("admin.ai.tokens")}
                          </p>
                          <p className="mt-1 font-mono text-ink">
                            {provider.tokens.toLocaleString(locale)}
                          </p>
                        </div>

                        <div>
                          <p className="text-ink-faint">
                            {t("admin.ai.success")}
                          </p>
                          <p className="mt-1 font-mono text-ink">
                            {provider.successes}
                          </p>
                        </div>

                        <div>
                          <p className="text-ink-faint">
                            {t("admin.ai.failed")}
                          </p>
                          <p className="mt-1 font-mono text-ink">
                            {provider.failures}
                          </p>
                        </div>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          </section>

          <section className="mb-5 rounded-xl border border-line bg-paper-raised p-5">
            <h2 className="font-serif text-[16px] font-semibold text-ink">
              {t("student.ai.byFeature")}
            </h2>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-[12px]">
                <thead className="text-ink-faint">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t("student.ai.feature")}</th>
                    <th className="px-3 py-2 font-medium">{t("admin.ai.requests")}</th>
                    <th className="px-3 py-2 font-medium">{t("admin.ai.success")}</th>
                    <th className="px-3 py-2 font-medium">{t("admin.ai.failed")}</th>
                    <th className="px-3 py-2 font-medium">{t("admin.ai.tokens")}</th>
                  </tr>
                </thead>

                <tbody>
                  {data.features.map(
                    (feature) => (
                      <tr
                        key={feature.label}
                        className="border-t border-line-soft"
                      >
                        <td className="px-3 py-3 font-medium text-ink">
                          {feature.label}
                        </td>
                        <td className="px-3 py-3 font-mono text-ink-soft">
                          {feature.requests}
                        </td>
                        <td className="px-3 py-3 font-mono text-ink-soft">
                          {feature.successes}
                        </td>
                        <td className="px-3 py-3 font-mono text-ink-soft">
                          {feature.failures}
                        </td>
                        <td className="px-3 py-3 font-mono text-ink-soft">
                          {feature.tokens.toLocaleString(locale)}
                        </td>
                      </tr>
                    ),
                  )}

                  {data.features.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="border-t border-line-soft px-3 py-8 text-center text-ink-faint"
                      >
                        {t("student.ai.noFeatureUsage")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-line bg-paper-raised p-5">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles
                size={16}
                className="text-ink-faint"
              />

              <h2 className="font-serif text-[16px] font-semibold text-ink">
                {t("admin.ai.recentActivity")}
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-[12px]">
                <thead className="text-ink-faint">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t("admin.ai.result")}</th>
                    <th className="px-3 py-2 font-medium">{t("student.ai.feature")}</th>
                    <th className="px-3 py-2 font-medium">{t("admin.ai.provider")}</th>
                    <th className="px-3 py-2 font-medium">{t("admin.ai.tokens")}</th>
                    <th className="px-3 py-2 font-medium">Cost</th>
                    <th className="px-3 py-2 font-medium">{t("admin.ai.latency")}</th>
                    <th className="px-3 py-2 font-medium">{t("admin.ai.time")}</th>
                  </tr>
                </thead>

                <tbody>
                  {data.recentActivity.map(
                    (item) => (
                      <tr
                        key={item.id}
                        className="border-t border-line-soft"
                      >
                        <td className="px-3 py-3">
                          {item.success ? (
                            <span className="inline-flex items-center gap-1 text-sage">
                              <CheckCircle2 size={12} />
                              {t("admin.ai.success")}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-coral">
                              <XCircle size={12} />
                              {t("admin.ai.failed")}
                            </span>
                          )}
                        </td>

                        <td className="px-3 py-3 text-ink">
                          {item.usageLabel}
                        </td>

                        <td className="px-3 py-3">
                          <p className="capitalize text-ink">
                            {item.provider}
                          </p>
                          <p className="mt-0.5 font-mono text-[10px] text-ink-faint">
                            {item.model}
                          </p>
                        </td>

                        <td className="px-3 py-3 font-mono text-ink-soft">
                          {item.tokensUsed.toLocaleString(locale)}
                        </td>

                        <td className="px-3 py-3 font-mono text-ink-soft">
                          ${item.estimatedCostUsd.toFixed(6)}
                        </td>

                        <td className="px-3 py-3 font-mono text-ink-soft">
                          <span className="inline-flex items-center gap-1">
                            <Clock3 size={11} />
                            {formatLatency(item.latencyMs)}
                          </span>
                        </td>

                        <td className="px-3 py-3 whitespace-nowrap text-ink-faint">
                          {formatTime(item.createdAt, locale)}
                        </td>
                      </tr>
                    ),
                  )}

                  {data.recentActivity.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="border-t border-line-soft px-3 py-8 text-center text-ink-faint"
                      >
                        {t("student.ai.noActivity")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
