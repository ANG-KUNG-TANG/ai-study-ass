import { randomUUID } from "crypto";
import * as chatRepo from "@/server/repositories/chat.repo";
import * as noteRepo from "@/server/repositories/note.repo";
import * as intelligenceService from "@/server/services/intelligence.service";
import { ChatEntity } from "@/server/entities/chat.entity";
import { ForbiddenError, AIError } from "@/server/utils/errors";
import { logger } from "@/server/utils/logger";
import { generate as aiGenerate } from "@/server/services/ai.service";
import { CHAT_HISTORY_LIMIT } from "@/server/utils/constants";
import type { IntelligenceResultEntity, ConfidenceMode } from "@/server/entities/intelligence.entity";

// ─── Prompt building ──────────────────────────────────────────────────────────
// Inlined from the now-deleted services/chat/chat.prompt.ts. Kept as private
// helpers rather than a separate file since this merge deliberately chose the
// flat single-file layout over the nested services/<feature>/ pattern that
// quiz and summary use — worth knowing this is an intentional inconsistency
// with those two, not an oversight, if it comes up later.

const MAX_CONTRIBUTIONS = 3;
const MAX_CONCEPTS = 10;

interface ChatHistoryMessage {
  question: string;
  answer: string;
}

// ASSUMPTION TO VERIFY: ChatEntity.create's `provider` field type. ai.service.ts
// types AIGenerateResult.provider as AIProvider ('openai' | 'gemini') only — no
// 'symbolic' member. A true symbolic-only answer never calls a provider, so it
// needs a third value. Widen the provider union in chat.entity.ts (and the
// Mongoose Chat model / any enum) to include 'symbolic', or tell me to instead
// stamp AI_CONFIG.activeProvider with tokensUsed: 0 (less accurate but requires
// no entity/model change).
type ChatAnswerProvider = "openai" | "gemini" | "symbolic";

interface ChatAnswer {
  text: string;
  provider: ChatAnswerProvider;
  tokensUsed: number;
  degraded: boolean; // true when AI was attempted/desired but we fell back to symbolic
}

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

function buildSystemPrompt(
  noteTitle: string,
  intelligence: IntelligenceResultEntity,
  mode: ConfidenceMode,
): string {
  const factBlock = buildFactBlock(intelligence);
  const base = `You are a study assistant helping a student understand a document titled "${noteTitle}".\n\nExtracted facts:\n${factBlock}`;

  if (mode === "SYMBOLIC_WITH_OPTIONAL_AI_POLISH") {
    return `${base}\n\nAnswer based primarily on the facts above. You may add brief clarifying context, but never contradict the extracted facts.`;
  }
  return `${base}\n\nThe extracted facts above may be incomplete or unreliable for this document. Use them as a starting point, but reason more broadly from general knowledge to give a complete, helpful answer. Be clear when you're going beyond the extracted facts.`;
}

function buildUserPrompt(history: ChatHistoryMessage[], question: string): string {
  if (history.length === 0) return question;
  const historyContext = history.map((m) => `User: ${m.question}\nAssistant: ${m.answer}`).join("\n\n");
  return `Previous conversation:\n${historyContext}\n\nNew question: ${question}`;
}

function buildChatPrompt(
  noteTitle: string,
  intelligence: IntelligenceResultEntity,
  mode: ConfidenceMode,
  history: ChatHistoryMessage[],
  question: string,
): { systemPrompt: string; prompt: string } {
  return {
    systemPrompt: buildSystemPrompt(noteTitle, intelligence, mode),
    prompt: buildUserPrompt(history, question),
  };
}

// ─── Symbolic-only answer path ────────────────────────────────────────────────
// Deterministic, no AI call at all. Template-based against the extracted facts
// — matches SYMBOLIC_ONLY's contract of "never go beyond what was extracted".
//
// UPGRADE PATH: this is intentionally simple (keyword match against fact
// labels) rather than a real Prolog query against the note's graph/facts. If
// prolog.engine.ts exposes a query-by-question or query-by-concept interface,
// swap this out for that — it'll give sharper answers than substring matching.
// I don't have that interface's shape yet, so I went with the template
// approach for now per our last exchange.

function buildSymbolicAnswer(intelligence: IntelligenceResultEntity, question: string): string {
  const core = intelligence.core;
  const q = question.toLowerCase();

  const factPairs: Array<[RegExp, string | null | undefined]> = [
    [/method|approach|technique/, core?.method],
    [/dataset|data set|corpus/, core?.dataset],
    [/accuracy|performance|result/, core?.accuracy != null ? `${core.accuracy}%` : undefined],
    [/problem|goal|aim/, core?.problem],
  ];

  for (const [pattern, value] of factPairs) {
    if (pattern.test(q) && value) {
      return value;
    }
  }

  if (core?.contributions?.length && /contribut/.test(q)) {
    return core.contributions.slice(0, MAX_CONTRIBUTIONS).join(" "); // <15 words per item expected from extraction, not a copyright concern here — this is the user's own uploaded document, not a third-party source.
  }

  const concepts = intelligence.resolvedConcepts().map((c) => c.concept.label).slice(0, MAX_CONCEPTS);
  if (concepts.length > 0) {
    return `Based on this document's extracted facts, I don't have a direct answer to that specific question, but the key concepts covered are: ${concepts.join(", ")}. Could you rephrase your question around one of these?`;
  }

  return "I don't have enough extracted information from this document to answer that confidently. Try asking about the document's method, dataset, results, or main problem statement.";
}

async function answerQuestion(
  intelligence: IntelligenceResultEntity,
  mode: ConfidenceMode,
  noteTitle: string,
  history: ChatHistoryMessage[],
  question: string,
): Promise<ChatAnswer> {
  if (mode === "SYMBOLIC_ONLY") {
    return {
      text: buildSymbolicAnswer(intelligence, question),
      provider: "symbolic",
      tokensUsed: 0,
      degraded: false,
    };
  }

  const { systemPrompt, prompt } = buildChatPrompt(noteTitle, intelligence, mode, history, question);

  try {
    const aiResult = await aiGenerate({ prompt, systemPrompt });
    return {
      text: aiResult.text,
      provider: aiResult.provider,
      tokensUsed: aiResult.tokensUsed,
      degraded: false,
    };
  } catch (err) {
    if (!(err instanceof AIError)) throw err; // unexpected error type — don't silently swallow

    logger.warn("AI generation failed for chat — falling back to symbolic answer", {
      mode,
      error: err.message,
    });

    return {
      text: buildSymbolicAnswer(intelligence, question),
      provider: "symbolic",
      tokensUsed: 0,
      degraded: true,
    };
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────
// Function names match what chat.controller.ts already imports — no
// controller changes needed as part of this merge.

export async function askQuestion(
  noteId: string,
  userId: string,
  question: string
): Promise<ReturnType<ChatEntity["toPublic"]>> {
  const note = await noteRepo.findByIdOrThrow(noteId);
  if (!note.belongsTo(userId)) throw new ForbiddenError();

  const intelligence = await intelligenceService.getOrRunPipeline(noteId);
  const mode = intelligence.getConfidenceMode();

  // Uses findByNoteIdAndUserId — the only history-fetch function that
  // actually exists in chat.repo.ts (confirmed against the real file;
  // the nested version's findHistoryByNoteId never existed).
  const history = await chatRepo.findByNoteIdAndUserId(noteId, userId, CHAT_HISTORY_LIMIT);

  const answer = await answerQuestion(intelligence, mode, note.title, history, question);

  const entity = ChatEntity.create({
    id: randomUUID(),
    noteId,
    userId,
    question,
    answer: answer.text,
    provider: answer.provider,
    tokensUsed: answer.tokensUsed,
  });

  const saved = await chatRepo.create(entity);
  logger.info("Chat answered", {
    noteId,
    userId,
    mode,
    provider: answer.provider,
    tokensUsed: answer.tokensUsed,
    degraded: answer.degraded,
  });

  return saved.toPublic();
}

export async function getChatHistory(
  noteId: string,
  userId: string
): Promise<ReturnType<ChatEntity["toPublic"]>[]> {
  const note = await noteRepo.findByIdOrThrow(noteId);
  if (!note.belongsTo(userId)) throw new ForbiddenError();

  const history = await chatRepo.findByNoteIdAndUserId(noteId, userId);
  return history.map((h) => h.toPublic());
}

export async function clearChatHistory(noteId: string, userId: string): Promise<void> {
  const note = await noteRepo.findByIdOrThrow(noteId);
  if (!note.belongsTo(userId)) throw new ForbiddenError();

  // Scoped to this user only — deleteByNoteId (no userId) would wipe every
  // user's chat history for a shared note. This was the cross-user-wipe bug
  // caught in the nested version; fixed here before it ever went live.
  await chatRepo.deleteByNoteIdAndUserId(noteId, userId);
  logger.info("Chat history cleared", { noteId, userId });
}

export async function deleteForNote(noteId: string): Promise<void> {
  await chatRepo.deleteByNoteId(noteId);
  logger.info("Chat data deleted", { noteId });
}