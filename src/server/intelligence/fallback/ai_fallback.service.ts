// =============================================================================
// server/intelligence/fallback/ai_fallback.service.ts
//
// AI-Assisted Completion (doc's "AI Hybrid (Optional)" branch). Fires only
// when needsAIFallback(confidence) is true — see intelligence-result.entity.ts.
//
// Scope is deliberately narrow: this only fills KnowledgeCore's strict
// fields (method, dataset, accuracy, problem) that gap_detector.ts flagged
// as missing. It does NOT generate summaries, does NOT invent sections, and
// does NOT touch fields that already have a value — the symbolic pipeline's
// output is trusted wherever it produced one; AI only fills the specific
// holes it left. This keeps the system's explainability property intact:
// every field in the final KnowledgeCore is either "the NLP/ontology/graph
// pipeline found this" or "the AI inferred this because the pipeline
// couldn't" (tracked via KnowledgeExtras.aiAssisted/aiFilledFields), never
// an ambiguous mix.
//
// This module does not import a concrete AI service — engine.ts doesn't
// know your real ai.service.ts's module path or call signature, so the
// caller injects a thin adapter conforming to AIGenerateFn (see types.ts).
// Retry/backoff/timeout/provider-selection all stay exactly where the
// roadmap already puts them: inside your real ai.service.ts, not duplicated
// here.
// =============================================================================

import type {
  AIFallbackFields,
  AIFallbackResult,
  AIGenerateFn,
  ExpectedField,
  KnowledgeCore,
  KnowledgeGap,
} from '../types';

// ─── Prompt construction ─────────────────────────────────────────────────────
// Truncate the source text — this is a targeted "fill these specific gaps"
// prompt, not a full-document summarization call, so it doesn't need (and
// shouldn't spend tokens on) the entire paper. 6000 chars comfortably covers
// an abstract + methodology + results section for most academic papers.

const MAX_SOURCE_CHARS = 6000;

function buildPrompt(missingFields: ExpectedField[], sourceText: string): string {
  const fieldDescriptions: Record<ExpectedField, string> = {
    method: '"method": the primary algorithm/model/technique the paper uses (string, or null if genuinely not determinable)',
    dataset: '"dataset": the primary dataset used for training/evaluation (string, or null)',
    accuracy: '"accuracy": the headline accuracy/performance metric as a plain number 0-100, no "%" sign (number, or null)',
    problem: '"problem": one sentence describing the problem/task the paper addresses (string, or null)',
  };

  const requestedFields = missingFields.map((f) => `  - ${fieldDescriptions[f]}`).join('\n');

  return [
    'You are extracting specific structured facts from an academic paper excerpt.',
    'A symbolic extraction pipeline already processed this paper and could NOT confidently determine the following fields:',
    requestedFields,
    '',
    'Return ONLY a JSON object with exactly these keys, no other text, no markdown code fences.',
    'If you genuinely cannot determine a field from the text, use null for that field rather than guessing.',
    '',
    '--- PAPER EXCERPT ---',
    sourceText.slice(0, MAX_SOURCE_CHARS),
    '--- END EXCERPT ---',
  ].join('\n');
}

// ─── Response parsing ────────────────────────────────────────────────────────
// Defensive: strip markdown code fences if the model added them despite
// instructions not to, then parse. Any field with the wrong type or an
// empty string is treated as null rather than trusted as-is — an AI
// fallback returning garbage should degrade to "still missing", not
// silently corrupt KnowledgeCore with a malformed value.

function parseResponse(text: string): AIFallbackFields {
  const cleaned = text.replace(/```json|```/g, '').trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return { method: null, dataset: null, accuracy: null, problem: null };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { method: null, dataset: null, accuracy: null, problem: null };
  }

  const obj = parsed as Record<string, unknown>;

  const asString = (v: unknown): string | null =>
    typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;

  const asNumber = (v: unknown): number | null => {
    if (typeof v === 'number' && Number.isFinite(v)) {
      return v >= 0 && v <= 100 ? v : null;
    }
    if (typeof v === 'string') {
      const parsedNum = parseFloat(v.replace('%', ''));
      return !Number.isNaN(parsedNum) && parsedNum >= 0 && parsedNum <= 100
        ? parsedNum
        : null;
    }
    return null;
  };

  return {
    method: asString(obj.method),
    dataset: asString(obj.dataset),
    accuracy: asNumber(obj.accuracy),
    problem: asString(obj.problem),
  };
}


function rebuildKeyPoints(core: KnowledgeCore): KnowledgeCore['keyPoints'] {
  const points: KnowledgeCore['keyPoints'] = [];
  if (core.method) points.push({ label: 'Method', value: core.method });
  if (core.dataset) points.push({ label: 'Dataset', value: core.dataset });
  if (core.extras?.metric) points.push({ label: 'Metric', value: core.extras.metric });
  if (core.accuracy !== null) points.push({ label: 'Accuracy', value: `${core.accuracy}%` });
  return points;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Attempt to fill KnowledgeCore's missing strict fields via AI.
 *
 * Returns both the merged KnowledgeCore (existing non-null values are never
 * overwritten, even if the AI also returned a value for them) and an
 * AIFallbackResult describing what happened, for IntelligenceResult.aiFallback.
 *
 * Never throws — an AI call failure degrades to "fields stay missing",
 * matching the doc's framing of AI Hybrid as an *optional* enhancement, not
 * a required stage the pipeline can fail on.
 */
export async function completeWithAI(
  core: KnowledgeCore,
  gaps: KnowledgeGap,
  sourceText: string,
  generate: AIGenerateFn,
): Promise<{ core: KnowledgeCore; result: AIFallbackResult }> {
  if (gaps.missingFields.length === 0) {
    return {
      core,
      result: { used: false, filledFields: [], skippedReason: 'no missing fields' },
    };
  }

  let response: Awaited<ReturnType<AIGenerateFn>>;
  try {
    const prompt = buildPrompt(gaps.missingFields, sourceText);
    response = await generate(prompt);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      core,
      result: { used: false, filledFields: [], skippedReason: `AI call failed: ${message}` },
    };
  }

  const aiFields = parseResponse(response.text);

  // Merge: only fill fields that were actually missing AND the AI actually
  // returned a non-null value for. Never overwrite an existing value.
  const filledFields: ExpectedField[] = [];
  const mergedCore: KnowledgeCore = { ...core };

  for (const field of gaps.missingFields) {
    const aiValue = aiFields[field];
    if (aiValue === null) continue;

    if (field === 'accuracy') {
      mergedCore.accuracy = aiValue as number;
    } else {
      (mergedCore as Record<ExpectedField, unknown>)[field] = aiValue;
    }
    filledFields.push(field);
  }

  if (filledFields.length > 0) {
    mergedCore.keyPoints = rebuildKeyPoints(mergedCore);
    mergedCore.extras = {
      ...(mergedCore.extras ?? { metric: null, limitations: null, futureWork: null, topic: null, keywords: [] }),
      aiAssisted: true,
      aiFilledFields: filledFields,
    };
  }

  return {
    core: mergedCore,
    result: {
      used: filledFields.length > 0,
      filledFields,
      raw: response.text,
      provider: response.provider,
      tokensUsed: response.tokensUsed,
      ...(filledFields.length === 0 ? { skippedReason: 'AI returned no usable values' } : {}),
    },
  };
}
