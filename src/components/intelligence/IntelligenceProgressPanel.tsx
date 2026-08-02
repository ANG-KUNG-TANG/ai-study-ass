"use client";

import { useEffect, useMemo, useState } from "react";

interface StageView {
  stage: string;
  label: string;
  description: string;
  status: "pending" | "running" | "complete" | "partial" | "failed" | "skipped";
  progress: number;
  message?: string;
  warnings: string[];
  metrics?: Record<string, number | string | boolean>;
}

interface ProgressSnapshot {
  noteId: string;
  state: "idle" | "running" | "complete" | "failed";
  currentStage: string | null;
  overallProgress: number;
  stages: StageView[];
  error: string | null;
  updatedAt: string;
}

interface StatusResponse {
  exists: boolean;
  isComplete: boolean;
  hasFailed: boolean;
  confidence: number | null;
  progress: ProgressSnapshot | null;
}

export interface IntelligenceProgressPanelProps {
  noteId: string;
  pollIntervalMs?: number;
  onComplete?: () => void;
}

export function IntelligenceProgressPanel({
  noteId,
  pollIntervalMs = 900,
  onComplete,
}: IntelligenceProgressPanelProps) {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const load = async () => {
      try {
        const response = await fetch(
          `/api/notes/${encodeURIComponent(noteId)}/intelligence/status`,
          { cache: "no-store" },
        );
        if (!response.ok) throw new Error(`Status request failed (${response.status})`);
        const next = await response.json() as StatusResponse;
        if (cancelled) return;
        setData(next);
        setRequestError(null);

        const terminal =
          next.isComplete ||
          next.hasFailed ||
          next.progress?.state === "complete" ||
          next.progress?.state === "failed";
        if (next.isComplete || next.progress?.state === "complete") onComplete?.();
        if (!terminal) timer = setTimeout(load, pollIntervalMs);
      } catch (error) {
        if (cancelled) return;
        setRequestError(error instanceof Error ? error.message : String(error));
        timer = setTimeout(load, Math.max(1500, pollIntervalMs));
      }
    };

    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [noteId, onComplete, pollIntervalMs]);

  const progress = data?.progress;
  const orderedStages = useMemo(
    () => [...(progress?.stages ?? [])].sort((a, b) => a.progress - b.progress),
    [progress?.stages],
  );

  if (!progress && data?.isComplete) {
    return (
      <section className="rounded-xl border bg-background p-5" aria-live="polite">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Document intelligence</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Analysis completed. The detailed live-stage history has expired,
              but validated intelligence is available.
            </p>
          </div>
          <span className="text-sm font-semibold">100%</span>
        </div>
        {data.confidence !== null ? (
          <p className="mt-4 border-t pt-4 text-sm">
            Evidence confidence: <strong>{Math.round(data.confidence * 100)}%</strong>
          </p>
        ) : null}
      </section>
    );
  }

  if (!progress && data?.hasFailed) {
    return (
      <section className="rounded-xl border bg-background p-5" aria-live="polite">
        <h2 className="text-base font-semibold">Document intelligence</h2>
        <p className="mt-2 text-sm text-destructive">
          Intelligence analysis failed. Regenerate the study materials to retry the pipeline.
        </p>
      </section>
    );
  }

  if (!progress && !requestError) {
    return (
      <section className="rounded-xl border p-5" aria-live="polite">
        <p className="text-sm font-medium">Preparing intelligence analysis…</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border bg-background p-5" aria-live="polite">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Document intelligence</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {progress?.state === "complete"
              ? "Analysis completed. Study materials can now use validated evidence."
              : progress?.state === "failed"
                ? "Analysis stopped before completion."
                : "The engine is analysing each stage and preserving its evidence."}
          </p>
        </div>
        <span className="text-sm font-semibold tabular-nums">
          {Math.round(progress?.overallProgress ?? 0)}%
        </span>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-foreground transition-[width] duration-500"
          style={{ width: `${Math.max(0, Math.min(100, progress?.overallProgress ?? 0))}%` }}
        />
      </div>

      {requestError ? (
        <p className="mt-3 text-sm text-destructive">{requestError}</p>
      ) : null}
      {progress?.error ? (
        <p className="mt-3 rounded-md border border-destructive/30 p-3 text-sm text-destructive">
          {progress.error}
        </p>
      ) : null}

      <ol className="mt-5 space-y-3">
        {orderedStages.map((stage) => (
          <li key={stage.stage} className="flex gap-3">
            <StageMarker status={stage.status} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">{stage.label}</p>
                <span className="text-xs capitalize text-muted-foreground">
                  {stage.status}
                </span>
              </div>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                {stage.message ?? stage.description}
              </p>
              {stage.warnings.length > 0 ? (
                <ul className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                  {stage.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                </ul>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      {data?.confidence !== null && data?.confidence !== undefined ? (
        <p className="mt-5 border-t pt-4 text-sm">
          Evidence confidence: <strong>{Math.round(data.confidence * 100)}%</strong>
        </p>
      ) : null}
    </section>
  );
}

function StageMarker({ status }: { status: StageView["status"] }) {
  const symbol =
    status === "complete" ? "✓" :
    status === "partial" ? "!" :
    status === "failed" ? "×" :
    status === "running" ? "•" :
    status === "skipped" ? "–" : "○";

  return (
    <span
      className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border text-xs"
      aria-hidden="true"
    >
      {symbol}
    </span>
  );
}
