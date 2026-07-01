// =============================================================================
// server/services/summary.service.ts
//
// First feature service on top of the intelligence engine. Reads an
// IntelligenceResult (from cache or a fresh runPipeline() call) and produces
// a SummaryResult. No Prolog query needed here — summary only needs
// core + ontology, not graph traversal or rule inference.
//
// Fallback rule: if IntelligenceResult.confidence < 0.6, delegate to
// ai.service.ts instead of trusting the engine's extraction. This is the
// ONE threshold check every feature service repeats — keep it identical
// across summary/quiz/flashcard/chat so the AI-fallback behavior is
// predictable and easy to reason about.
// =============================================================================

import type { IntelligenceResult, SummaryResult } from '../intelligence/types';
import { generate as aiGenerate } from './ai.service'; // Week 6 block — stubbed for now

const CONFIDENCE_THRESHOLD = 0.6;

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Build a summary from an already-computed IntelligenceResult.
 * Callers (note.service.ts) are responsible for getting/creating the
 * IntelligenceResult — this function never calls runPipeline() itself,
 * so it stays testable with a plain mock object.
 */
export async function generateSummary(
  result: IntelligenceResult,
): Promise<SummaryResult> {
  if (result.confidence < CONFIDENCE_THRESHOLD) {
    return generateSummaryViaAI(result);
  }
  return generateSummaryFromEngine(result);
}

// ─── Engine path ─────────────────────────────────────────────────────────────

function generateSummaryFromEngine(result: IntelligenceResult): SummaryResult {
  const { core, ontology } = result;

  const text = buildSummaryText(result);
  const keyPoints = core.keyPoints.map((kp) => `${kp.label}: ${kp.value}`);

  // Only include concepts the ontology actually resolved (confidence > 0),
  // using canonical labels rather than raw extracted strings.
  const concepts = ontology
    .filter((r) => r.matchType !== 'unknown')
    .map((r) => r.concept.label);

  return {
    text,
    keyPoints,
    concepts,
    resolvedBy: 'engine',
  };
}

/**
 * Compose the prose summary from KnowledgeCore fields.
 * Deliberately template-based, not free text generation — this is the
 * classical-engine path, so output should read as assembled facts,
 * not AI prose. Falls back to core.extras.topic/keywords when the
 * strict fields (method/dataset/problem) are all null, e.g. a note
 * that isn't a research-paper-shaped document.
 */
function buildSummaryText(result: IntelligenceResult): string {
  const { core } = result;
  const parts: string[] = [];

  if (core.problem) parts.push(core.problem);
  if (core.method) {
    const label = result.ontology.find((r) => r.rawInput === core.method)?.concept.label ?? core.method;
    parts.push(`The work uses ${label}.`);
  }
  if (core.dataset) {
    const label = result.ontology.find((r) => r.rawInput === core.dataset)?.concept.label ?? core.dataset;
    parts.push(`It is evaluated on ${label}.`);
  }
  if (core.accuracy !== null) {
    parts.push(`Reported accuracy: ${core.accuracy}%.`);
  }
  if (core.contributions.length > 0) {
    parts.push(core.contributions[0]);
  }

  if (parts.length > 0) return parts.join(' ');

  // Nothing extracted — fall back to extras or a generic notice.
  if (core.extras?.topic) {
    return `This document relates to ${core.extras.topic.replace(/_/g, ' ')}.`;
  }
  return 'No summary could be generated from the extracted content.';
}

// ─── AI fallback path ─────────────────────────────────────────────────────────

async function generateSummaryViaAI(result: IntelligenceResult): Promise<SummaryResult> {
  const prompt = buildFallbackPrompt(result);
  const aiText = await aiGenerate(prompt);

  return {
    text: aiText,
    keyPoints: result.core.keyPoints.map((kp) => `${kp.label}: ${kp.value}`),
    concepts: result.ontology
      .filter((r) => r.matchType !== 'unknown')
      .map((r) => r.concept.label),
    resolvedBy: 'ai',
  };
}

/**
 * Give the AI whatever the engine DID manage to extract, even at low
 * confidence — partial engine output is still useful grounding for the
 * prompt, cheaper than sending raw document text, and keeps the AI's
 * summary anchored to the same facts a high-confidence run would have used.
 */
function buildFallbackPrompt(result: IntelligenceResult): string {
  const { core } = result;
  const known = [
    core.method && `Method: ${core.method}`,
    core.dataset && `Dataset: ${core.dataset}`,
    core.accuracy !== null && `Accuracy: ${core.accuracy}%`,
    core.problem && `Problem: ${core.problem}`,
  ].filter(Boolean).join('\n');

  return [
    'Summarize the following study material in 3-4 sentences.',
    'Known extracted facts (may be incomplete):',
    known || '(none extracted)',
    '',
    'Top sentences from the document:',
    result.nlp.topSentences.join(' '),
  ].join('\n');
}