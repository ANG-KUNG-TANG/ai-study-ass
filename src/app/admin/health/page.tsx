"use client";

import {
  useEffect,
  useState,
} from "react";
import {
  CheckCircle2,
  HelpCircle,
  XCircle,
} from "lucide-react";
import {
  Topbar,
} from "@/components/layout/Topbar";
import {
  Card,
} from "@/components/ui/Card";
import {
  getHealth,
} from "@/services/health.service";
import type {
  HealthCheck,
} from "@/types/health";

function StatusIcon({
  ok,
}: {
  ok: boolean | undefined;
}) {
  if (ok === true) {
    return (
      <CheckCircle2
        size={16}
        className="text-sage"
      />
    );
  }

  if (ok === false) {
    return (
      <XCircle
        size={16}
        className="text-coral"
      />
    );
  }

  return (
    <HelpCircle
      size={16}
      className="text-ink-faint"
    />
  );
}

function formatUptime(
  seconds?: number,
): string {
  if (
    seconds === undefined ||
    !Number.isFinite(seconds)
  ) {
    return "—";
  }

  const days =
    Math.floor(
      seconds / 86_400,
    );

  const hours =
    Math.floor(
      (
        seconds %
        86_400
      ) /
        3_600,
    );

  const minutes =
    Math.floor(
      (
        seconds %
        3_600
      ) /
        60,
    );

  return [
    days > 0
      ? `${days}d`
      : "",
    `${hours}h`,
    `${minutes}m`,
  ]
    .filter(Boolean)
    .join(" ");
}

function formatBytes(
  value?: number,
): string {
  if (
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return "—";
  }

  return `${(
    value /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}

export default function AdminHealthPage() {
  const [
    health,
    setHealth,
  ] =
    useState<HealthCheck | null>(
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
    isLoading,
    setIsLoading,
  ] =
    useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const result =
          await getHealth();

        if (active) {
          setHealth(result);
        }
      } catch (cause) {
        if (active) {
          setHealth(null);

          setError(
            cause instanceof Error
              ? cause.message
              : "Failed to load system health.",
          );
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <Topbar
        eyebrow="Admin"
        title="System health"
      />

      {isLoading && (
        <p className="text-[13px] text-ink-soft">
          Checking system health…
        </p>
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-coral/30 bg-coral-soft px-4 py-3">
          <p className="text-[13px] text-coral">
            {error}
          </p>
        </div>
      )}

      {health && (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-[12px] font-medium text-ink-soft">
                  Database
                </h4>

                <StatusIcon
                  ok={
                    health.database
                      .connected
                  }
                />
              </div>

              <p className="text-[13px]">
                {health.database.connected
                  ? "Connected"
                  : health.database.state}
              </p>

              <p className="mt-1 text-[11px] text-ink-faint">
                Latency:{" "}
                {health.database
                  .latencyMs === null
                  ? "—"
                  : `${health.database.latencyMs}ms`}
              </p>
            </Card>

            <Card>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-[12px] font-medium text-ink-soft">
                  AI provider
                </h4>

                <StatusIcon
                  ok={
                    health.ai
                      .reachable
                  }
                />
              </div>

              <p className="text-[13px] capitalize">
                {health.ai.provider}
              </p>

              <p className="mt-1 truncate text-[11px] text-ink-faint">
                {health.ai.model}
              </p>
            </Card>

            <Card>
              <h4 className="mb-2 text-[12px] font-medium text-ink-soft">
                Uptime
              </h4>

              <p className="text-[13px]">
                {formatUptime(
                  health.uptime,
                )}
              </p>
            </Card>

            <Card>
              <h4 className="mb-2 text-[12px] font-medium text-ink-soft">
                Memory
              </h4>

              <p className="text-[13px]">
                {formatBytes(
                  health.memory.used,
                )}
              </p>

              <p className="mt-1 text-[11px] text-ink-faint">
                Heap total:{" "}
                {formatBytes(
                  health.memory.total,
                )}
              </p>
            </Card>
          </div>

          <details className="mt-4">
            <summary className="cursor-pointer text-[12px] text-ink-faint">
              Raw response
            </summary>

            <pre className="mt-2 overflow-x-auto rounded-card border border-line bg-paper-raised p-3 text-[11px] text-ink-soft">
              {JSON.stringify(
                health,
                null,
                2,
              )}
            </pre>
          </details>
        </>
      )}
    </>
  );
}
