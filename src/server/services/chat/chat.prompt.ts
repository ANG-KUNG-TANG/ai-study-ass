// =============================================================================
// server/services/chat.prompt.ts
//
// Builds the system + user prompt for answering a chat question about a
// note. Separate from chat.service.ts so the prompt text can be iterated
// on independently of the history-fetching/persistence logic around it —
// same split as quiz.prompt.ts.
// =============================================================================

import type { IntelligenceResultEntity, ConfidenceMode } from "@/server/entities/intelligence.entity";

const MAX_CONTRIBUTIONS = 3;
const MAX_CONCEPTS = 10;

export interface ChatHistoryMessage {
  question: string;
  answer: string;
}

export interface ChatPromptResult {
  systemPrompt: string;
  prompt: string;
}

/**
 * Builds the "Extracted facts" block from the intelligence result's core
 * data + resolved concepts.
 */
function buildFactBlock(intelligence: IntelligenceResultEntity): string {
  const factLines: string[] = [];
  const core = intelligence.core;

  if (core?.method) factLines.push(`Method: ${core.method}`);
  if (core?.dataset) factLines.push(`Dataset: ${core.dataset}`);
  if (core?.accuracy !== null && core?.accuracy !== undefined) factLines.push(`Accuracy: ${core.accuracy}%`);
  if (core?.problem) factLines.push(`Problem: ${core.problem}`);
  for (const c of core?.contributions.slice(0, MAX_CONTRIBUTIONS) ?? []) {
    factLines.push(`Contribution: ${c}`);
  }

  const concepts = intelligence.resolvedConcepts().map((c) => c.concept.label).slice(0, MAX_CONCEPTS);
  if (concepts.length > 0) factLines.push(`Key concepts: ${concepts.join(", ")}`);

  return factLines.length > 0 ? factLines.join("\n") : "(no structured facts extracted)";
}

/**
 * Grounding strictness scales with confidence mode: the higher the
 * confidence in the extracted facts, the less the model is allowed to
 * stray from them.
 */
function buildSystemPrompt(
  noteTitle: string,
  intelligence: IntelligenceResultEntity,
  mode: ConfidenceMode,
): string {
  const factBlock = buildFactBlock(intelligence);
  const base = `You are a study assistant helping a student understand a document titled "${noteTitle}".\n\nExtracted facts:\n${factBlock}`;

  if (mode === "SYMBOLIC_ONLY") {
    return `${base}\n\nAnswer ONLY using the facts above. Do not add information beyond them. If the facts don't cover the question, say so clearly rather than guessing.`;
  }
  if (mode === "SYMBOLIC_WITH_OPTIONAL_AI_POLISH") {
    return `${base}\n\nAnswer based primarily on the facts above. You may add brief clarifying context, but never contradict the extracted facts.`;
  }
  return `${base}\n\nThe extracted facts above may be incomplete or unreliable for this document. Use them as a starting point, but reason more broadly from general knowledge to give a complete, helpful answer. Be clear when you're going beyond the extracted facts.`;
}

/**
 * Folds prior Q&A turns into the user prompt so the model has conversation
 * context. Falls back to the bare question when there's no history yet.
 */
function buildUserPrompt(history: ChatHistoryMessage[], question: string): string {
  if (history.length === 0) return question;
  const historyContext = history.map((m) => `User: ${m.question}\nAssistant: ${m.answer}`).join("\n\n");
  return `Previous conversation:\n${historyContext}\n\nNew question: ${question}`;
}

export function buildChatPrompt(
  noteTitle: string,
  intelligence: IntelligenceResultEntity,
  mode: ConfidenceMode,
  history: ChatHistoryMessage[],
  question: string,
): ChatPromptResult {
  return {
    systemPrompt: buildSystemPrompt(noteTitle, intelligence, mode),
    prompt: buildUserPrompt(history, question),
  };
}