import type {
  IntelligenceStageProgress,
  IntelligenceStageStatus,
} from "@/server/intelligence/types";
import { createPendingStageProgress } from "@/server/intelligence/stage-catalog";

export interface IntelligenceProgressSnapshot {
  noteId: string;
  state: "idle" | "running" | "complete" | "failed";
  currentStage: string | null;
  overallProgress: number;
  stages: IntelligenceStageProgress[];
  error: string | null;
  startedAt: string | null;
  updatedAt: string;
  completedAt: string | null;
}

const TTL_MS = 60 * 60 * 1000;

type ProgressStore = Map<string, IntelligenceProgressSnapshot>;

declare global {
  var __intelligenceProgressStore: ProgressStore | undefined;
}

const store: ProgressStore =
  globalThis.__intelligenceProgressStore ??
  new Map<string, IntelligenceProgressSnapshot>();

if (process.env.NODE_ENV !== "production") {
  globalThis.__intelligenceProgressStore = store;
}

export function begin(noteId: string): IntelligenceProgressSnapshot {
  cleanupExpired();
  const now = new Date().toISOString();
  const snapshot: IntelligenceProgressSnapshot = {
    noteId,
    state: "running",
    currentStage: "document_received",
    overallProgress: 0,
    stages: createPendingStageProgress(),
    error: null,
    startedAt: now,
    updatedAt: now,
    completedAt: null,
  };
  store.set(noteId, snapshot);
  return snapshot;
}

export function record(
  noteId: string,
  event: IntelligenceStageProgress,
): IntelligenceProgressSnapshot {
  const current = store.get(noteId) ?? begin(noteId);
  const index = current.stages.findIndex(
    (stage) => stage.stage === event.stage,
  );
  const stages = [...current.stages];
  const serialized = cloneStage(event);

  if (index >= 0) stages[index] = serialized;
  else stages.push(serialized);

  const terminal = event.stage === "complete" && event.status === "complete";
  const failed = event.status === "failed";
  const next: IntelligenceProgressSnapshot = {
    ...current,
    state: failed ? "failed" : terminal ? "complete" : "running",
    currentStage: event.stage,
    overallProgress:
      event.status === "running"
        ? Math.max(0, event.progress - 3)
        : event.progress,
    stages,
    error: failed
      ? (event.message ?? "Intelligence processing failed.")
      : current.error,
    updatedAt: new Date().toISOString(),
    completedAt: terminal || failed ? new Date().toISOString() : null,
  };
  store.set(noteId, next);
  return next;
}

export function fail(
  noteId: string,
  error: string,
): IntelligenceProgressSnapshot {
  const current = store.get(noteId) ?? begin(noteId);
  const next: IntelligenceProgressSnapshot = {
    ...current,
    state: "failed",
    error,
    updatedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };
  store.set(noteId, next);
  return next;
}

export function complete(noteId: string): IntelligenceProgressSnapshot {
  const current = store.get(noteId) ?? begin(noteId);
  const next: IntelligenceProgressSnapshot = {
    ...current,
    state: "complete",
    overallProgress: 100,
    error: null,
    updatedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };
  store.set(noteId, next);
  return next;
}

export function get(noteId: string): IntelligenceProgressSnapshot | null {
  cleanupExpired();
  return store.get(noteId) ?? null;
}

export function clear(noteId: string): void {
  store.delete(noteId);
}

function cloneStage(
  stage: IntelligenceStageProgress,
): IntelligenceStageProgress {
  return {
    ...stage,
    startedAt: stage.startedAt ? new Date(stage.startedAt) : undefined,
    completedAt: stage.completedAt ? new Date(stage.completedAt) : undefined,
    warnings: [...stage.warnings],
    metrics: stage.metrics ? { ...stage.metrics } : undefined,
  };
}

function cleanupExpired(): void {
  const cutoff = Date.now() - TTL_MS;
  for (const [noteId, snapshot] of store) {
    if (new Date(snapshot.updatedAt).getTime() < cutoff) store.delete(noteId);
  }
}

export function isTerminal(status: IntelligenceStageStatus): boolean {
  return ["complete", "failed", "skipped"].includes(status);
}
