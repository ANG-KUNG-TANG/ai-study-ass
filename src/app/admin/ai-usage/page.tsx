"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  RefreshCw,
  XCircle,
} from "lucide-react";

import { Topbar } from "@/components/layout/Topbar";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { getAdminAIUsage } from "@/services/admin.service";
import type {
  AdminAIUsage,
  AdminAIUsageActivity,
} from "@/types/admin";
import { useLanguage } from "@/context/LanguageContext";
import type { Locale } from "@/i18n/translations";

function formatNumber(value: number, locale: Locale): string {
  return value.toLocaleString(locale);
}

function formatLatency(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "—";
  }

  return value >= 1_000
    ? `${(value / 1_000).toFixed(1)}s`
    : `${Math.round(value)}ms`;
}

function formatTimestamp(value: string | null, locale: Locale): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString(locale);
}

function ActivityRow({
  item,
}: {
  item: AdminAIUsageActivity;
}) {
  const { locale, t } = useLanguage();

  return (
    <tr className="border-t border-line">
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

      <td className="px-3 py-3">
        <p className="font-medium text-ink">
          {item.usageLabel}
        </p>
        <p className="mt-0.5 text-[10px] text-ink-faint">
          {item.provider} · {item.model}
        </p>
      </td>

      <td className="px-3 py-3 font-mono">
        {formatNumber(item.tokensUsed, locale)}
      </td>

      <td className="px-3 py-3 font-mono">
        {formatLatency(item.latencyMs)}
      </td>

      <td className="px-3 py-3">
        {item.statusCode ?? "—"}
      </td>

      <td className="px-3 py-3">
        {item.quotaExceeded ? t("admin.ai.yes") : t("admin.ai.no")}
      </td>

      <td className="px-3 py-3 whitespace-nowrap text-ink-faint">
        {formatTimestamp(item.createdAt, locale)}
      </td>
    </tr>
  );
}

export default function AdminAIUsagePage() {
  const { locale, t } = useLanguage();
  const [data, setData] =
    useState<AdminAIUsage | null>(null);
  const [error, setError] =
    useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] =
    useState(false);

  const load = useCallback(async (): Promise<void> => {
    try {
      const result = await getAdminAIUsage();
      setData(result);
      setError(null);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("admin.ai.unavailable"),
      );
    } finally {
      setIsRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [load]);

  const refresh = useCallback(() => {
    setIsRefreshing(true);
    void load();
  }, [load]);

  return (
    <>
      <Topbar
        eyebrow={t("admin.system")}
        title={t("admin.ai.observabilityTitle")}
      />

      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-[12px] text-ink-faint">
          {t("admin.ai.description")}
        </p>

        <button
          type="button"
          disabled={isRefreshing}
          onClick={refresh}
          className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-[12px] text-ink-soft disabled:opacity-50"
        >
          <RefreshCw
            size={14}
            className={isRefreshing ? "animate-spin" : ""}
          />
          {t("common.refresh")}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-coral/30 bg-coral-soft px-4 py-3 text-[12px] text-coral">
          {error}
        </div>
      )}

      {!data && !error && (
        <AdminPanel>
          <p className="py-8 text-center text-[12px] text-ink-faint">
            {t("admin.ai.loading")}
          </p>
        </AdminPanel>
      )}

      {data && (
        <>
          {data.warning && (
            <div className="mb-5 rounded-xl border border-line bg-paper-raised px-4 py-3 text-[12px] text-ink-soft">
              {data.warning}
            </div>
          )}

          <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
            {[
              [t("admin.ai.requestsToday"), formatNumber(data.summary.requestsToday, locale)],
              [t("admin.ai.successRate"), `${data.summary.successRate.toFixed(1)}%`],
              [t("admin.ai.failures"), formatNumber(data.summary.failuresToday, locale)],
              [t("admin.ai.tokens"), formatNumber(data.summary.tokensToday, locale)],
              [t("admin.ai.averageLatency"), formatLatency(data.summary.averageLatencyMs)],
              [t("admin.ai.quotaErrors"), formatNumber(data.summary.quotaExceededToday, locale)],
            ].map(([label, value]) => (
              <AdminPanel key={label}>
                <p className="text-[11px] text-ink-faint">
                  {label}
                </p>
                <p className="mt-2 font-serif text-2xl font-semibold text-ink">
                  {value}
                </p>
              </AdminPanel>
            ))}
          </section>

          <section className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            {data.providers.map((provider) => (
              <AdminPanel key={provider.provider}>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="font-serif text-[16px] font-semibold capitalize text-ink">
                      {provider.provider}
                    </h2>
                    <p className="mt-1 text-[10px] text-ink-faint">
                      {t("admin.ai.lastRequest", {
                        value: formatTimestamp(provider.lastRequestAt, locale),
                      })}
                    </p>
                  </div>

                  <span className="rounded-full bg-line-soft px-2.5 py-1 font-mono text-[10px] uppercase text-ink-soft">
                    {provider.status}
                  </span>
                </div>

                <div className="divide-y divide-line-soft">
                  {[
                    [t("admin.ai.requestsToday"), formatNumber(provider.requestsToday, locale)],
                    [t("admin.ai.successful"), formatNumber(provider.successesToday, locale)],
                    [t("admin.ai.failures"), formatNumber(provider.failuresToday, locale)],
                    [t("admin.ai.quotaExceeded"), formatNumber(provider.quotaExceededToday, locale)],
                    [t("admin.ai.tokensToday"), formatNumber(provider.tokensToday, locale)],
                    [t("admin.ai.averageLatency"), formatLatency(provider.averageLatencyMs)],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="flex justify-between py-2.5 text-[12px]"
                    >
                      <span className="text-ink-soft">{label}</span>
                      <span className="font-mono text-ink">{value}</span>
                    </div>
                  ))}
                </div>
              </AdminPanel>
            ))}
          </section>

          <section className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <AdminPanel>
              <h2 className="mb-4 font-serif text-[16px] font-semibold text-ink">
                {t("admin.ai.lastSevenDays")}
              </h2>

              <div className="divide-y divide-line-soft">
                {data.requestsLastSevenDays.map((item) => (
                  <div
                    key={item.date}
                    className="flex items-center justify-between py-2.5 text-[12px]"
                  >
                    <span className="text-ink-soft">
                      {item.label} · {item.date}
                    </span>
                    <span className="font-mono text-ink">
                      {formatNumber(item.value, locale)}
                    </span>
                  </div>
                ))}
              </div>
            </AdminPanel>

            <AdminPanel>
              <h2 className="mb-4 font-serif text-[16px] font-semibold text-ink">
                {t("admin.ai.usageLabels")}
              </h2>

              <div className="space-y-3">
                {data.requestsByRoute.length > 0 ? (
                  data.requestsByRoute.map((item) => (
                    <div
                      key={item.route}
                      className="flex items-center justify-between text-[12px]"
                    >
                      <span className="text-ink-soft">
                        {item.route}
                      </span>
                      <span className="font-mono text-ink">
                        {formatNumber(item.count, locale)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-[12px] text-ink-faint">
                    {t("admin.ai.noProviderUsage")}
                  </p>
                )}
              </div>
            </AdminPanel>
          </section>

          <section className="mb-5">
            <AdminPanel>
              <h2 className="mb-4 font-serif text-[16px] font-semibold text-ink">
                {t("admin.ai.modelBreakdown")}
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-[12px] text-ink-soft">
                  <thead>
                    <tr>
                      <th className="px-3 py-2 font-medium">{t("admin.ai.provider")}</th>
                      <th className="px-3 py-2 font-medium">{t("admin.ai.model")}</th>
                      <th className="px-3 py-2 font-medium">{t("admin.ai.requests")}</th>
                      <th className="px-3 py-2 font-medium">{t("admin.ai.success")}</th>
                      <th className="px-3 py-2 font-medium">{t("admin.ai.failed")}</th>
                      <th className="px-3 py-2 font-medium">{t("admin.ai.tokens")}</th>
                      <th className="px-3 py-2 font-medium">{t("admin.ai.averageLatency")}</th>
                    </tr>
                  </thead>

                  <tbody>
                    {data.models.map((item) => (
                      <tr
                        key={`${item.provider}:${item.model}`}
                        className="border-t border-line"
                      >
                        <td className="px-3 py-3 capitalize text-ink">
                          {item.provider}
                        </td>
                        <td className="px-3 py-3 font-mono text-[11px]">
                          {item.model}
                        </td>
                        <td className="px-3 py-3">{item.requests}</td>
                        <td className="px-3 py-3">{item.successes}</td>
                        <td className="px-3 py-3">{item.failures}</td>
                        <td className="px-3 py-3">
                          {formatNumber(item.tokens, locale)}
                        </td>
                        <td className="px-3 py-3">
                          {formatLatency(item.averageLatencyMs)}
                        </td>
                      </tr>
                    ))}

                    {data.models.length === 0 && (
                      <tr>
                        <td
                          colSpan={7}
                          className="border-t border-line px-3 py-8 text-center text-ink-faint"
                        >
                          {t("admin.ai.noDurableUsage")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </AdminPanel>
          </section>

          <section>
            <AdminPanel>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="font-serif text-[16px] font-semibold text-ink">
                    {t("admin.ai.recentActivity")}
                  </h2>
                  <p className="mt-1 text-[10px] text-ink-faint">
                    {t("admin.ai.recentActivityDescription")}
                  </p>
                </div>

                <div className="text-right text-[10px] text-ink-faint">
                  <p>
                    {t("admin.ai.lastSuccess", {
                      value: formatTimestamp(data.summary.lastSuccessAt, locale),
                    })}
                  </p>
                  <p className="mt-1">
                    {t("admin.ai.lastFailure", {
                      value: formatTimestamp(data.summary.lastFailureAt, locale),
                    })}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-[12px] text-ink-soft">
                  <thead>
                    <tr>
                      <th className="px-3 py-2 font-medium">{t("admin.ai.result")}</th>
                      <th className="px-3 py-2 font-medium">{t("admin.ai.usage")}</th>
                      <th className="px-3 py-2 font-medium">{t("admin.ai.tokens")}</th>
                      <th className="px-3 py-2 font-medium">{t("admin.ai.latency")}</th>
                      <th className="px-3 py-2 font-medium">HTTP</th>
                      <th className="px-3 py-2 font-medium">{t("admin.ai.quota")}</th>
                      <th className="px-3 py-2 font-medium">{t("admin.ai.time")}</th>
                    </tr>
                  </thead>

                  <tbody>
                    {data.recentActivity.map((item) => (
                      <ActivityRow
                        key={item.id}
                        item={item}
                      />
                    ))}

                    {data.recentActivity.length === 0 && (
                      <tr>
                        <td
                          colSpan={7}
                          className="border-t border-line px-3 py-8 text-center text-ink-faint"
                        >
                          {t("admin.ai.noEvents")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </AdminPanel>
          </section>

          <div className="mt-4 flex flex-wrap gap-4 text-[10px] text-ink-faint">
            <span className="inline-flex items-center gap-1">
              <Clock3 size={11} />
              {t("admin.ai.monthlySpendValue", {
                value: `$${data.monthlySpend.toFixed(2)}`,
              })}
            </span>
            <span className="inline-flex items-center gap-1">
              <AlertTriangle size={11} />
              {t("admin.ai.costDisabled")}
            </span>
          </div>
        </>
      )}
    </>
  );
}
