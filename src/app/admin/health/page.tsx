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

function formatUptime(seconds?: number): string {
  if (seconds === undefined || !Number.isFinite(seconds)) {
    return "—";
  }

  const days = Math.floor(seconds / 86_400);

  const hours = Math.floor((seconds % 86_400) / 3_600);

  const minutes = Math.floor((seconds % 3_600) / 60);

  return [days > 0 ? `${days}d` : "", `${hours}h`, `${minutes}m`]
    .filter(Boolean)
    .join(" ");
}

function formatBytes(value?: number): string {
  if (value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatHeartbeat(worker: WorkerHealth): string {
  if (!worker.online || worker.ageMs === null) {
    return "No fresh heartbeat";
  }

  const seconds = Math.max(0, Math.round(worker.ageMs / 1_000));

  return `${seconds}s ago`;
}

function queueValue(input: number | null): string {
  return input === null ? "—" : String(input);
}

function WorkerCard({
  title,
  worker,
}: {
  title: string;
  worker: WorkerHealth;
}) {
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-[12px] font-medium text-ink-soft">{title}</h4>

        <StatusIcon ok={worker.online} />
      </div>

      <p className="text-[13px]">{worker.online ? "Online" : "Offline"}</p>

      <p className="mt-1 text-[11px] text-ink-faint">
        Heartbeat: {formatHeartbeat(worker)}
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
  return (
    <tr className="border-t border-line">
      <td className="px-3 py-3 font-medium text-ink">{name}</td>

      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <StatusIcon ok={queue.available} />

          <span>{queue.available ? "Available" : "Unavailable"}</span>
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
          : "Failed to load system health.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

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
      <Topbar eyebrow="Admin" title="System health" />

      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[12px] text-ink-faint">
            Live infrastructure status. Refreshes every 10 seconds.
          </p>

          {health && (
            <p className="mt-1 text-[10px] text-ink-faint">
              Last server snapshot:{" "}
              {new Date(health.timestamp).toLocaleString()}
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
          Refresh
        </button>
      </div>

      {isLoading && !health && (
        <p className="mb-4 text-[13px] text-ink-soft">
          Checking system health…
        </p>
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-coral/30 bg-coral-soft px-4 py-3">
          <p className="text-[13px] text-coral">{error}</p>

          {health && (
            <p className="mt-1 text-[11px] text-coral">
              Showing the most recent successful snapshot.
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
                  System
                </h4>

                <OverallStatusIcon status={health.status} />
              </div>

              <p className="text-[13px] capitalize">{health.status}</p>

              <p className="mt-1 text-[11px] text-ink-faint">
                Uptime: {formatUptime(health.uptime)}
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
                  ? "Connected"
                  : health.database.state}
              </p>

              <p className="mt-1 text-[11px] text-ink-faint">
                Latency:{" "}
                {health.database.latencyMs === null
                  ? "—"
                  : `${health.database.latencyMs}ms`}
              </p>
            </Card>

            <Card>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-[12px] font-medium text-ink-soft">Redis</h4>

                <StatusIcon ok={health.redis.connected} />
              </div>

              <p className="text-[13px]">
                {health.redis.connected ? "Connected" : "Unavailable"}
              </p>

              <p className="mt-1 text-[11px] text-ink-faint">
                Latency:{" "}
                {health.redis.latencyMs === null
                  ? "—"
                  : `${health.redis.latencyMs}ms`}
              </p>
            </Card>

            <Card>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-[12px] font-medium text-ink-soft">
                  AI provider
                </h4>

                <StatusIcon ok={health.ai.configured} />
              </div>

              <p className="text-[13px] capitalize">{health.ai.provider}</p>

              <p className="mt-1 truncate text-[11px] text-ink-faint">
                {health.ai.model}
              </p>

              <p className="mt-1 text-[10px] text-ink-faint">
                Configuration check only
              </p>
            </Card>
          </div>

          <section>
            <h3 className="mb-2 text-[13px] font-semibold text-ink">Workers</h3>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <WorkerCard
                title="Study generation worker"
                worker={health.workers.studyGeneration}
              />

              <WorkerCard
                title="PDF ingestion worker"
                worker={health.workers.pdfIngestion}
              />
            </div>
          </section>

          <Card>
            <div className="mb-3">
              <h3 className="text-[13px] font-semibold text-ink">
                BullMQ queues
              </h3>

              <p className="mt-1 text-[11px] text-ink-faint">
                Current queue state. Completed and failed values represent
                retained BullMQ jobs, not lifetime totals.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-[12px] text-ink-soft">
                <thead>
                  <tr>
                    <th className="px-3 py-2 font-medium">Queue</th>

                    <th className="px-3 py-2 font-medium">Status</th>

                    <th className="px-3 py-2 font-medium">Waiting</th>

                    <th className="px-3 py-2 font-medium">Active</th>

                    <th className="px-3 py-2 font-medium">Delayed</th>

                    <th className="px-3 py-2 font-medium">Failed</th>

                    <th className="px-3 py-2 font-medium">Completed</th>
                  </tr>
                </thead>

                <tbody>
                  <QueueRow
                    name="Study generation"
                    queue={health.queues.studyGeneration}
                  />

                  <QueueRow
                    name="PDF ingestion"
                    queue={health.queues.pdfIngestion}
                  />
                </tbody>
              </table>
            </div>
          </Card>

          <section>
            <h3 className="mb-2 text-[13px] font-semibold text-ink">
              Telegram integration
            </h3>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Card>
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-[12px] font-medium text-ink-soft">
                    Telegram bot
                  </h4>

                  <StatusIcon ok={health.telegram.reachable} />
                </div>

                <p className="text-[13px]">
                  {health.telegram.reachable
                    ? "Online"
                    : health.telegram.configured
                      ? "Unavailable"
                      : "Not configured"}
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
                    Telegram webhook
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
                      ? "URL mismatch"
                      : "Active"
                    : "Not configured"}
                </p>

                <p className="mt-1 truncate text-[11px] text-ink-faint">
                  {health.telegram.webhook.url ?? "—"}
                </p>
              </Card>

              <Card>
                <h4 className="mb-2 text-[12px] font-medium text-ink-soft">
                  Pending updates
                </h4>

                <p className="text-[13px]">
                  {health.telegram.webhook.pendingUpdates === null
                    ? "—"
                    : health.telegram.webhook.pendingUpdates}
                </p>

                <p className="mt-1 text-[11px] text-ink-faint">
                  Webhook secret:{" "}
                  {health.telegram.webhook.secretConfigured
                    ? "Configured"
                    : "Missing"}
                </p>
              </Card>

              <Card>
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-[12px] font-medium text-ink-soft">
                    Last webhook error
                  </h4>

                  <StatusIcon ok={!health.telegram.webhook.lastErrorMessage} />
                </div>

                <p className="truncate text-[13px]">
                  {health.telegram.webhook.lastErrorMessage ?? "None"}
                </p>

                <p className="mt-1 text-[11px] text-ink-faint">
                  {health.telegram.webhook.lastErrorAt ??
                    "No recent Telegram error"}
                </p>
              </Card>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Card>
              <h4 className="mb-2 text-[12px] font-medium text-ink-soft">
                Runtime
              </h4>

              <p className="text-[13px]">Version {health.version}</p>

              <p className="mt-1 text-[11px] text-ink-faint">
                Uptime: {formatUptime(health.uptime)}
              </p>
            </Card>

            <Card>
              <h4 className="mb-2 text-[12px] font-medium text-ink-soft">
                Memory
              </h4>

              <p className="text-[13px]">
                Heap used: {formatBytes(health.memory.used)}
              </p>

              <p className="mt-1 text-[11px] text-ink-faint">
                Heap total: {formatBytes(health.memory.total)}
                {" · "}
                RSS: {formatBytes(health.memory.rss)}
              </p>
            </Card>
          </div>

          <details>
            <summary className="cursor-pointer text-[12px] text-ink-faint">
              Raw response
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
