"use client";

import { useMemo } from "react";

import { useGenerationStatus } from "@/hooks/useGenerationStatus";

import type {
  FeatureGenerationState,
  FeatureGenerationStatus,
  StudyGenerationStage,
  StudyGenerationState,
} from "@/types/generation";

// ─── Types ────────────────────────────────────────────────────────────────────

type FeatureName = keyof StudyGenerationState["features"];

// ─── Labels ───────────────────────────────────────────────────────────────────

const FEATURE_LABELS: Record<FeatureName, string> = {
  summary: "Summary",

  quiz: "Quiz",

  flashcards: "Flashcards",

  chatKnowledge: "Knowledge",
};

const FEATURE_ORDER: FeatureName[] = [
  "summary",
  "quiz",
  "flashcards",
  "chatKnowledge",
];

// ─── Stage helpers ─────────────────────────────────────────────────────────────

function getStageLabel(stage: StudyGenerationStage): string {
  switch (stage) {
    case "extracting":
      return "Extracting document";

    case "vision_ocr":
      return "Recovering scanned pages";

    case "ocr_failed":
      return "Text recovery paused";

    case "pending":
      return "Waiting to start";

    case "analyzing":
      return "Analyzing document";

    case "generating":
      return "Generating study materials";

    case "complete":
      return "Study materials ready";

    case "partial":
      return "Generation partially completed";

    case "failed":
      return "Generation failed";
  }
}

function getStageDescription(stage: StudyGenerationStage): string {
  switch (stage) {
    case "extracting":
      return "The document is being prepared and its native text is being extracted.";

    case "vision_ocr":
      return "The PDF contains scanned or image-based pages. Vision OCR is recovering the document text.";

    case "ocr_failed":
      return "The scanned document could not be processed right now. The original PDF was preserved and text recovery can be retried.";

    case "pending":
      return "Document processing is complete and the generation worker is waiting to start.";

    case "analyzing":
      return "The intelligence engine is identifying concepts, structure, and knowledge from your document.";

    case "generating":
      return "Summary, quiz, flashcards, and study knowledge are being prepared.";

    case "complete":
      return "All study materials are ready to use.";

    case "partial":
      return "Some study materials were created, but one or more features could not be completed.";

    case "failed":
      return "Study material generation could not be completed successfully.";
  }
}

// ─── Status helpers ────────────────────────────────────────────────────────────

function getFeatureStatusLabel(status: FeatureGenerationStatus): string {
  switch (status) {
    case "pending":
      return "Pending";

    case "generating":
      return "Generating";

    case "ready":
      return "Ready";

    case "partial":
      return "Partial";

    case "failed":
      return "Failed";
  }
}

function getFeatureStatusClasses(status: FeatureGenerationStatus): string {
  switch (status) {
    case "pending":
      return "border-black/10 bg-black/[0.03] text-ink-soft";

    case "generating":
      return "border-amber-200 bg-amber-50 text-amber-700";

    case "ready":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "partial":
      return "border-orange-200 bg-orange-50 text-orange-700";

    case "failed":
      return "border-red-200 bg-red-50 text-red-700";
  }
}

// ─── Progress calculation ──────────────────────────────────────────────────────

function calculateProgress(state: StudyGenerationState): number {
  switch (state.stage) {
    case "extracting":
      return 10;

    case "vision_ocr":
      return 25;

    case "ocr_failed":
      return 25;

    case "pending":
      return 35;

    case "analyzing":
      return 50;

    case "generating": {
      const featureStates = Object.values(state.features);

      const completed = featureStates.filter(
        (feature) =>
          feature.status === "ready" ||
          feature.status === "partial" ||
          feature.status === "failed",
      ).length;

      const generationProgress =
        featureStates.length > 0 ? completed / featureStates.length : 0;

      return Math.round(55 + generationProgress * 40);
    }

    case "complete":
    case "partial":
    case "failed":
      return 100;
  }
}

// ─── Feature row ───────────────────────────────────────────────────────────────

function FeatureRow({
  name,
  state,
}: {
  name: FeatureName;

  state: FeatureGenerationState;
}) {
  return (
    <div
      className="
        flex items-center justify-between
        gap-3 border-t border-black/[0.06]
        py-2.5 first:border-t-0
      "
    >
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-ink">
          {FEATURE_LABELS[name]}
        </div>

        {state.error ? (
          <div className="mt-0.5 line-clamp-1 text-[11px] text-red-600">
            {state.error}
          </div>
        ) : state.aiFallbackUsed ? (
          <div className="mt-0.5 text-[11px] text-ink-soft">
            AI fallback used
          </div>
        ) : state.source ? (
          <div className="mt-0.5 text-[11px] text-ink-soft">
            Source: {state.source.replaceAll("_", " ")}
          </div>
        ) : null}
      </div>

      <span
        className={`
          shrink-0 rounded-full
          border px-2 py-0.5
          text-[10px] font-medium
          ${getFeatureStatusClasses(state.status)}
        `}
      >
        {getFeatureStatusLabel(state.status)}
      </span>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function StudyGenerationProgress({ noteId }: { noteId: string }) {
  const {
    status,
    isLoading,
    isRegenerating,
    isRetryingOcr,
    error,
    refetch,
    regenerate,
    retryOcr,
  } = useGenerationStatus(noteId, 2_000);

  const progress = useMemo(
    () => (status ? calculateProgress(status) : 0),
    [status],
  );

  // ─────────────────────────────────────────────────────────────
  // Initial load
  // ─────────────────────────────────────────────────────────────

  if (isLoading && !status) {
    return (
      <div className="mb-5 rounded-xl border border-black/[0.08] bg-white p-4">
        <div className="text-[12px] text-ink-soft">
          Checking generation status…
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Status API error
  // ─────────────────────────────────────────────────────────────

  if (error && !status) {
    return (
      <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4">
        <div className="text-[13px] font-medium text-red-700">
          Could not load generation status
        </div>

        <div className="mt-1 text-[12px] text-red-600">{error}</div>

        <button
          type="button"
          onClick={() => {
            void refetch();
          }}
          className="
            mt-3 rounded-md
            border border-red-200
            bg-white px-3 py-1.5
            text-[11px] font-medium
            text-red-700
          "
        >
          Retry
        </button>
      </div>
    );
  }

  if (!status) {
    return null;
  }

  const isRunning =
    status.stage === "extracting" ||
    status.stage === "vision_ocr" ||
    status.stage === "pending" ||
    status.stage === "analyzing" ||
    status.stage === "generating";

  const canRetryOcr = status.stage === "ocr_failed";

  const canRegenerate = status.stage === "partial" || status.stage === "failed";

  // ─────────────────────────────────────────────────────────────
  // Complete
  // ─────────────────────────────────────────────────────────────

  if (status.stage === "complete") {
    return (
      <div className="mb-5 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
        <span className="text-[12px]">✓</span>

        <span className="text-[12px] font-medium text-emerald-700">
          All study materials are ready
        </span>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Running / partial / failed
  // ─────────────────────────────────────────────────────────────

  return (
    <div className="mb-5 overflow-hidden rounded-xl border border-black/[0.08] bg-white">
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[13px] font-semibold text-ink">
              {getStageLabel(status.stage)}
            </div>

            <p className="mt-1 max-w-xl text-[11px] leading-5 text-ink-soft">
              {getStageDescription(status.stage)}
            </p>
          </div>

          <span className="shrink-0 font-mono text-[11px] text-ink-soft">
            {progress}%
          </span>
        </div>

        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
          <div
            className="
              h-full rounded-full
              bg-coral
              transition-[width]
              duration-500
            "
            style={{
              width: `${progress}%`,
            }}
          />
        </div>

        {isRunning ? (
          <div className="mt-2 text-[10px] text-ink-soft">
            Status updates automatically.
          </div>
        ) : null}

        {/* API/action error while status already exists */}
        {error ? (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
            {error}
          </div>
        ) : null}

        {/* OCR-specific retry */}
        {canRetryOcr ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="text-[11px] leading-5 text-amber-800">
              The original PDF is still available. You can retry text recovery
              without uploading the document again.
            </div>

            <button
              type="button"
              disabled={isRetryingOcr}
              onClick={() => {
                void retryOcr();
              }}
              className="
                mt-2 rounded-md
                border border-amber-300
                bg-white
                px-3 py-1.5
                text-[11px]
                font-medium
                text-amber-800
                transition
                hover:bg-amber-100
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
            >
              {isRetryingOcr ? "Retrying OCR…" : "Retry OCR"}
            </button>
          </div>
        ) : null}

        {/* Normal generation retry */}
        {canRegenerate ? (
          <div className="mt-4">
            <button
              type="button"
              disabled={isRegenerating}
              onClick={() => {
                void regenerate();
              }}
              className="
                rounded-md
                border border-black/[0.1]
                bg-white
                px-3 py-1.5
                text-[11px]
                font-medium
                text-ink
                transition
                hover:bg-black/[0.03]
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
            >
              {isRegenerating ? "Regenerating…" : "Regenerate study materials"}
            </button>
          </div>
        ) : null}
      </div>

      <div className="border-t border-black/[0.06] px-4">
        {FEATURE_ORDER.map((feature) => (
          <FeatureRow
            key={feature}
            name={feature}
            state={status.features[feature]}
          />
        ))}
      </div>
    </div>
  );
}
