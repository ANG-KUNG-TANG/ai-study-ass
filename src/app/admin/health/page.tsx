"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  RefreshCw,
  XCircle,
} from "lucide-react";

import { Topbar } from "@/components/layout/Topbar";
import { Card } from "@/components/ui/Card";
import { getHealth } from "@/services/health.service";
import type { HealthCheck, QueueHealth, WorkerHealth } from "@/types/health";
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

function StatusIcon({ ok }: { ok: boolean | undefined }) {
  if (ok === true) {
    return <CheckCircle2 size={16} className="text-sage" />;
  }

  if (ok === false) {
    return <XCircle size={16} className="text-coral" />;
  }

  return <HelpCircle size={16} className="text-ink-faint" />;
}

function OverallStatusIcon({ status }: { status: HealthCheck["status"] }) {
  if (status === "healthy") {
    return <CheckCircle2 size={16} className="text-sage" />;
  }

  if (status === "degraded") {
    return <AlertTriangle size={16} className="text-amber-500" />;
  }

  return <XCircle size={16} className="text-coral" />;
}

function formatUptime(seconds: number | undefined, t: Translate): string {
  if (seconds === undefined || !Number.isFinite(seconds)) {
    return "—";
  }

  const days = Math.floor(seconds / 86_400);

  const hours = Math.floor((seconds % 86_400) / 3_600);

  const minutes = Math.floor((seconds % 3_600) / 60);

  return [
    days > 0 ? t("admin.health.days", { count: days }) : "",
    t("admin.health.hours", { count: hours }),
    t("admin.health.minutes", { count: minutes }),
  ]
    .filter(Boolean)
    .join(" ");
}

function formatBytes(value?: number): string {
  if (value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatHeartbeat(worker: WorkerHealth, t: Translate): string {
  if (!worker.online || worker.ageMs === null) {
    return t("admin.health.noHeartbeat");
  }

  const seconds = Math.max(0, Math.round(worker.ageMs / 1_000));

  return t("admin.health.secondsAgo", { count: seconds });
}

function queueValue(input: number | null): string {
  return input === null ? "—" : String(input);
}

function formatHealthTimestamp(
  value: string | null,
  locale: Locale,
): string {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  return Number.isNaN(
    date.getTime(),
  )
    ? "—"
    : date.toLocaleString(locale);
}

function WorkerCard({
  title,
  worker,
}: {
  title: string;
  worker: WorkerHealth;
}) {
  const { t } = useLanguage();

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-[12px] font-medium text-ink-soft">{title}</h4>

        <StatusIcon ok={worker.online} />
      </div>

      <p className="text-[13px]">
        {worker.online ? t("admin.health.online") : t("admin.health.offline")}
      </p>

      <p className="mt-1 text-[11px] text-ink-faint">
        {t("admin.health.heartbeat", { value: formatHeartbeat(worker, t) })}
      </p>

      {worker.lastHeartbeatAt && (
        <p className="mt-1 truncate text-[10px] text-ink-faint">
          {worker.lastHeartbeatAt}
        </p>
      )}
    </Card>
  );
}

function QueueRow({ name, queue }: { name: string; queue: QueueHealth }) {
  const { t } = useLanguage();

  return (
    <tr className="border-t border-line">
      <td className="px-3 py-3 font-medium text-ink">{name}</td>

      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <StatusIcon ok={queue.available} />

          <span>
            {queue.available
              ? t("admin.health.available")
              : t("admin.health.unavailable")}
          </span>
        </div>
      </td>

      <td className="px-3 py-3">{queueValue(queue.waiting)}</td>

      <td className="px-3 py-3">{queueValue(queue.active)}</td>

      <td className="px-3 py-3">{queueValue(queue.delayed)}</td>

      <td className="px-3 py-3">{queueValue(queue.failed)}</td>

      <td className="px-3 py-3">{queueValue(queue.completed)}</td>
    </tr>
  );
}

export default function AdminHealthPage() {
  const { locale, t } = useLanguage();
  const [health, setHealth] = useState<HealthCheck | null>(null);

  const [error, setError] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  /**
   * IMPORTANT:
   *
   * This function may update React state, so the effect below does not call
   * it directly. The initial request and recurring requests are both invoked
   * from timer callbacks. This keeps the component compatible with the
   * react-hooks/set-state-in-effect rule.
   */
  const loadHealth = useCallback(async (): Promise<void> => {
    try {
      const result = await getHealth();

      setHealth(result);
      setError(null);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("admin.health.loadFailed"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    /**
     * Do not call loadHealth() directly here.
     *
     * The zero-delay timer starts the first request after the effect has
     * completed, avoiding synchronous state-update tracing from the effect.
     */
    const initialTimer = window.setTimeout(() => {
      void loadHealth();
    }, 0);

    const refreshTimer = window.setInterval(() => {
      void loadHealth();
    }, 10_000);

    return () => {
      window.clearTimeout(initialTimer);

      window.clearInterval(refreshTimer);
    };
  }, [loadHealth]);

  const handleRefresh = useCallback(() => {
    setIsLoading(true);
    void loadHealth();
  }, [loadHealth]);

  return (
    <>
      <Topbar eyebrow={t("admin.eyebrow")} title={t("admin.health.title")} description={t("admin.health.description")} />

      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          {health && (
            <p className="mt-1 text-[10px] text-ink-faint">
              {t("admin.health.lastSnapshot", {
                value: new Date(health.timestamp).toLocaleString(locale),
              })}
            </p>
          )}
        </div>

        <button
          type="button"
          disabled={isLoading}
          onClick={handleRefresh}
          className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-[12px] text-ink-soft disabled:opacity-50"
        >
          <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
          {t("common.refresh")}
        </button>
      </div>

      {isLoading && !health && (
        <p className="mb-4 text-[13px] text-ink-soft">
          {t("admin.health.checking")}
        </p>
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-coral/30 bg-coral-soft px-4 py-3">
          <p className="text-[13px] text-coral">{error}</p>

          {health && (
            <p className="mt-1 text-[11px] text-coral">
              {t("admin.health.staleSnapshot")}
            </p>
          )}
        </div>
      )}

      {health && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-[12px] font-medium text-ink-soft">
                  {t("admin.health.system")}
                </h4>

                <OverallStatusIcon status={health.status} />
              </div>

              <p className="text-[13px] capitalize">
                {health.status === "healthy"
                  ? t("admin.health.healthy")
                  : health.status === "degraded"
                    ? t("admin.health.degraded")
                    : t("admin.health.unhealthy")}
              </p>

              <p className="mt-1 text-[11px] text-ink-faint">
                {t("admin.health.uptimeValue", {
                  value: formatUptime(health.uptime, t),
                })}
              </p>
            </Card>

            <Card>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-[12px] font-medium text-ink-soft">
                  MongoDB
                </h4>

                <StatusIcon ok={health.database.connected} />
              </div>

              <p className="text-[13px]">
                {health.database.connected
                  ? t("admin.health.connected")
                  : t("admin.health.unavailable")}
              </p>

              <p className="mt-1 text-[11px] text-ink-faint">
                {t("admin.health.latency", {
                  latency:
                    health.database.latencyMs === null
                      ? "—"
                      : `${health.database.latencyMs}ms`,
                })}
              </p>
            </Card>

            <Card>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-[12px] font-medium text-ink-soft">Redis</h4>

                <StatusIcon ok={health.redis.connected} />
              </div>

              <p className="text-[13px]">
                {health.redis.connected
                  ? t("admin.health.connected")
                  : t("admin.health.unavailable")}
              </p>

              <p className="mt-1 text-[11px] text-ink-faint">
                {t("admin.health.latency", {
                  latency:
                    health.redis.latencyMs === null
                      ? "—"
                      : `${health.redis.latencyMs}ms`,
                })}
              </p>
            </Card>

            <Card>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-[12px] font-medium text-ink-soft">
                  {t("admin.health.aiProvider")}
                </h4>

                <StatusIcon
                  ok={
                    health.ai.status === "operational"
                      ? true
                      : health.ai.status === "quota_exhausted" ||
                          health.ai.status === "degraded"
                        ? false
                        : undefined
                  }
                />
              </div>

              <p className="text-[13px] capitalize">
                {health.ai.provider}
              </p>

              <p className="mt-1 truncate text-[11px] text-ink-faint">
                {health.ai.model}
              </p>

              <p className="mt-2 text-[11px] capitalize text-ink-soft">
                {health.ai.status === "operational"
                  ? t("admin.health.operational")
                  : health.ai.status === "quota_exhausted"
                    ? t("admin.health.quotaExhausted")
                    : health.ai.status === "degraded"
                      ? t("admin.health.degraded")
                      : t("admin.health.unavailable")}
              </p>

              <p className="mt-1 text-[10px] text-ink-faint">
                {t("admin.health.aiToday", {
                  successes: health.ai.successesToday,
                  failures: health.ai.failuresToday,
                })}
              </p>

              <p className="mt-1 text-[10px] text-ink-faint">
                {t("admin.health.quotaErrors", {
                  count: health.ai.quotaExceededToday,
                })}
              </p>
            </Card>
          </div>

          {health.ai.status === "quota_exhausted" && (
            <div className="rounded-xl border border-coral/30 bg-coral-soft px-4 py-3">
              <div className="flex items-start gap-2">
                <AlertTriangle
                  size={16}
                  className="mt-0.5 shrink-0 text-coral"
                />

                <div>
                  <p className="text-[12px] font-medium text-coral">
                    {t("admin.health.quotaAlertTitle")}
                  </p>

                  <p className="mt-1 text-[11px] text-coral">
                    {t("admin.health.quotaAlertDescription", {
                      provider: health.ai.provider,
                    })}
                  </p>

                  <p className="mt-1 text-[10px] text-coral">
                    {t("admin.health.lastFailure", {
                      value: formatHealthTimestamp(
                        health.ai.lastFailureAt,
                        locale,
                      ),
                    })}
                  </p>
                </div>
              </div>
            </div>
          )}

          {health.ai.status === "degraded" && (
            <div className="rounded-xl border border-amber-500/30 px-4 py-3">
              <div className="flex items-start gap-2">
                <AlertTriangle
                  size={16}
                  className="mt-0.5 shrink-0 text-amber-500"
                />

                <div>
                  <p className="text-[12px] font-medium text-ink">
                    {t("admin.health.recentFailureTitle")}
                  </p>

                  <p className="mt-1 text-[11px] text-ink-soft">
                    {t("admin.health.recentFailureDescription")}
                  </p>

                  <p className="mt-1 text-[10px] text-ink-faint">
                    {t("admin.health.lastSuccessAndFailure", {
                      success: formatHealthTimestamp(
                        health.ai.lastSuccessAt,
                        locale,
                      ),
                      failure: formatHealthTimestamp(
                        health.ai.lastFailureAt,
                        locale,
                      ),
                    })}
                  </p>
                </div>
              </div>
            </div>
          )}

          <section>
            <h3 className="mb-2 text-[13px] font-semibold text-ink">
              {t("admin.health.workers")}
            </h3>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <WorkerCard
                title={t("admin.health.studyWorker")}
                worker={health.workers.studyGeneration}
              />

              <WorkerCard
                title={t("admin.health.pdfWorker")}
                worker={health.workers.pdfIngestion}
              />
            </div>
          </section>

          <Card>
            <div className="mb-3">
              <h3 className="text-[13px] font-semibold text-ink">
                {t("admin.health.queues")}
              </h3>

              <p className="mt-1 text-[11px] text-ink-faint">
                {t("admin.health.queuesDescription")}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-[12px] text-ink-soft">
                <thead>
                  <tr>
                    <th className="px-3 py-2 font-medium">{t("admin.health.queue")}</th>

                    <th className="px-3 py-2 font-medium">{t("admin.health.status")}</th>

                    <th className="px-3 py-2 font-medium">{t("admin.health.waiting")}</th>

                    <th className="px-3 py-2 font-medium">{t("admin.health.active")}</th>

                    <th className="px-3 py-2 font-medium">{t("admin.health.delayed")}</th>

                    <th className="px-3 py-2 font-medium">{t("admin.health.failed")}</th>

                    <th className="px-3 py-2 font-medium">{t("admin.health.completed")}</th>
                  </tr>
                </thead>

                <tbody>
                  <QueueRow
                    name={t("admin.health.studyGeneration")}
                    queue={health.queues.studyGeneration}
                  />

                  <QueueRow
                    name={t("admin.health.pdfIngestion")}
                    queue={health.queues.pdfIngestion}
                  />
                </tbody>
              </table>
            </div>
          </Card>

          <section>
            <h3 className="mb-2 text-[13px] font-semibold text-ink">
              {t("admin.health.telegram")}
            </h3>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Card>
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-[12px] font-medium text-ink-soft">
                    {t("admin.health.telegramBot")}
                  </h4>

                  <StatusIcon ok={health.telegram.reachable} />
                </div>

                <p className="text-[13px]">
                  {health.telegram.reachable
                    ? t("admin.health.online")
                    : health.telegram.configured
                      ? t("admin.health.unavailable")
                      : t("admin.health.notConfigured")}
                </p>

                <p className="mt-1 text-[11px] text-ink-faint">
                  {health.telegram.bot.username
                    ? `@${health.telegram.bot.username}`
                    : (health.telegram.bot.displayName ?? "—")}
                </p>
              </Card>

              <Card>
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-[12px] font-medium text-ink-soft">
                    {t("admin.health.telegramWebhook")}
                  </h4>

                  <StatusIcon
                    ok={
                      health.telegram.webhook.configured &&
                      health.telegram.webhook.matchesExpectedUrl !== false
                    }
                  />
                </div>

                <p className="text-[13px]">
                  {health.telegram.webhook.configured
                    ? health.telegram.webhook.matchesExpectedUrl === false
                      ? t("admin.health.urlMismatch")
                      : t("admin.health.active")
                    : t("admin.health.notConfigured")}
                </p>

                <p className="mt-1 truncate text-[11px] text-ink-faint">
                  {health.telegram.webhook.url ?? "—"}
                </p>
              </Card>

              <Card>
                <h4 className="mb-2 text-[12px] font-medium text-ink-soft">
                  {t("admin.health.pendingUpdates")}
                </h4>

                <p className="text-[13px]">
                  {health.telegram.webhook.pendingUpdates === null
                    ? "—"
                    : health.telegram.webhook.pendingUpdates}
                </p>

                <p className="mt-1 text-[11px] text-ink-faint">
                  {t("admin.health.webhookSecret", {
                    value: health.telegram.webhook.secretConfigured
                      ? t("admin.health.configured")
                      : t("admin.health.missing"),
                  })}
                </p>
              </Card>

              <Card>
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-[12px] font-medium text-ink-soft">
                    {t("admin.health.lastWebhookError")}
                  </h4>

                  <StatusIcon ok={!health.telegram.webhook.lastErrorMessage} />
                </div>

                <p className="truncate text-[13px]">
                  {health.telegram.webhook.lastErrorMessage ?? t("admin.health.none")}
                </p>

                <p className="mt-1 text-[11px] text-ink-faint">
                  {health.telegram.webhook.lastErrorAt ??
                    t("admin.health.noRecentTelegramError")}
                </p>
              </Card>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Card>
              <h4 className="mb-2 text-[12px] font-medium text-ink-soft">
                {t("admin.health.runtime")}
              </h4>

              <p className="text-[13px]">
                {t("admin.health.version", { value: health.version })}
              </p>

              <p className="mt-1 text-[11px] text-ink-faint">
                {t("admin.health.uptimeValue", {
                  value: formatUptime(health.uptime, t),
                })}
              </p>
            </Card>

            <Card>
              <h4 className="mb-2 text-[12px] font-medium text-ink-soft">
                {t("admin.health.memory")}
              </h4>

              <p className="text-[13px]">
                {t("admin.health.heapUsed", {
                  value: formatBytes(health.memory.used),
                })}
              </p>

              <p className="mt-1 text-[11px] text-ink-faint">
                {t("admin.health.heapDetails", {
                  total: formatBytes(health.memory.total),
                  rss: formatBytes(health.memory.rss),
                })}
              </p>
            </Card>
          </div>

          <details>
            <summary className="cursor-pointer text-[12px] text-ink-faint">
              {t("admin.health.raw")}
            </summary>

            <pre className="mt-2 overflow-x-auto rounded-card border border-line bg-paper-raised p-3 text-[11px] text-ink-soft">
              {JSON.stringify(health, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </>
  );
}
