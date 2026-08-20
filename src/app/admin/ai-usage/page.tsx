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

function formatNumber(value: number): string {
  return value.toLocaleString();
}

function formatLatency(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "—";
  }

  return value >= 1_000
    ? `${(value / 1_000).toFixed(1)}s`
    : `${Math.round(value)}ms`;
}

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString();
}

function ActivityRow({
  item,
}: {
  item: AdminAIUsageActivity;
}) {
  return (
    <tr className="border-t border-line">
      <td className="px-3 py-3">
        {item.success ? (
          <span className="inline-flex items-center gap-1 text-sage">
            <CheckCircle2 size={12} />
            Success
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-coral">
            <XCircle size={12} />
            Failed
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
        {formatNumber(item.tokensUsed)}
      </td>

      <td className="px-3 py-3 font-mono">
        {formatLatency(item.latencyMs)}
      </td>

      <td className="px-3 py-3">
        {item.statusCode ?? "—"}
      </td>

      <td className="px-3 py-3">
        {item.quotaExceeded ? "Yes" : "No"}
      </td>

      <td className="px-3 py-3 whitespace-nowrap text-ink-faint">
        {formatTimestamp(item.createdAt)}
      </td>
    </tr>
  );
}

export default function AdminAIUsagePage() {
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
          : "AI usage is unavailable.",
      );
    } finally {
      setIsRefreshing(false);
    }
  }, []);

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
        eyebrow="System"
        title="AI usage & observability"
      />

      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-[12px] text-ink-faint">
          Durable provider telemetry from MongoDB.
          Daily boundaries use UTC.
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
          Refresh
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
            Loading durable AI usage…
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
              ["Requests today", formatNumber(data.summary.requestsToday)],
              ["Success rate", `${data.summary.successRate.toFixed(1)}%`],
              ["Failures", formatNumber(data.summary.failuresToday)],
              ["Tokens", formatNumber(data.summary.tokensToday)],
              ["Avg latency", formatLatency(data.summary.averageLatencyMs)],
              ["Quota errors", formatNumber(data.summary.quotaExceededToday)],
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
                      Last request: {formatTimestamp(provider.lastRequestAt)}
                    </p>
                  </div>

                  <span className="rounded-full bg-line-soft px-2.5 py-1 font-mono text-[10px] uppercase text-ink-soft">
                    {provider.status}
                  </span>
                </div>

                <div className="divide-y divide-line-soft">
                  {[
                    ["Requests today", formatNumber(provider.requestsToday)],
                    ["Successful", formatNumber(provider.successesToday)],
                    ["Failures", formatNumber(provider.failuresToday)],
                    ["Quota exceeded", formatNumber(provider.quotaExceededToday)],
                    ["Tokens today", formatNumber(provider.tokensToday)],
                    ["Average latency", formatLatency(provider.averageLatencyMs)],
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
                Requests · last 7 days
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
                      {formatNumber(item.value)}
                    </span>
                  </div>
                ))}
              </div>
            </AdminPanel>

            <AdminPanel>
              <h2 className="mb-4 font-serif text-[16px] font-semibold text-ink">
                Usage labels
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
                        {formatNumber(item.count)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-[12px] text-ink-faint">
                    No provider usage recorded yet.
                  </p>
                )}
              </div>
            </AdminPanel>
          </section>

          <section className="mb-5">
            <AdminPanel>
              <h2 className="mb-4 font-serif text-[16px] font-semibold text-ink">
                Provider / model breakdown
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-[12px] text-ink-soft">
                  <thead>
                    <tr>
                      <th className="px-3 py-2 font-medium">Provider</th>
                      <th className="px-3 py-2 font-medium">Model</th>
                      <th className="px-3 py-2 font-medium">Requests</th>
                      <th className="px-3 py-2 font-medium">Success</th>
                      <th className="px-3 py-2 font-medium">Failed</th>
                      <th className="px-3 py-2 font-medium">Tokens</th>
                      <th className="px-3 py-2 font-medium">Avg latency</th>
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
                          {formatNumber(item.tokens)}
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
                          No durable provider usage recorded yet.
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
                    Recent provider activity
                  </h2>
                  <p className="mt-1 text-[10px] text-ink-faint">
                    Latest durable AIUsage events.
                  </p>
                </div>

                <div className="text-right text-[10px] text-ink-faint">
                  <p>
                    Last success: {formatTimestamp(data.summary.lastSuccessAt)}
                  </p>
                  <p className="mt-1">
                    Last failure: {formatTimestamp(data.summary.lastFailureAt)}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-[12px] text-ink-soft">
                  <thead>
                    <tr>
                      <th className="px-3 py-2 font-medium">Result</th>
                      <th className="px-3 py-2 font-medium">Usage</th>
                      <th className="px-3 py-2 font-medium">Tokens</th>
                      <th className="px-3 py-2 font-medium">Latency</th>
                      <th className="px-3 py-2 font-medium">HTTP</th>
                      <th className="px-3 py-2 font-medium">Quota</th>
                      <th className="px-3 py-2 font-medium">Time</th>
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
                          No durable provider events yet.
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
              Monthly spend: ${data.monthlySpend.toFixed(2)}
            </span>
            <span className="inline-flex items-center gap-1">
              <AlertTriangle size={11} />
              Cost remains disabled until provider pricing is configured.
            </span>
          </div>
        </>
      )}
    </>
  );
}
