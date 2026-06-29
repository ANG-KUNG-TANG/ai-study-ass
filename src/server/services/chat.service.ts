import { randomUUID } from "crypto";
import * as chatRepo from "@/server/repositories/chat.repo";
import * as noteRepo from "@/server/repositories/note.repo";
import { findKnowledgeObjectByNoteId } from "@/server/repositories/knowledge_object.repo";
import { ChatEntity } from "@/server/entities/chat.entity";
import { ForbiddenError, NotFoundError } from "@/server/utils/errors";
import { logger } from "@/server/utils/logger";
import { CHAT_RULES } from "@/server/entities/chat.entity";

// ─── AI provider interface ────────────────────────────────────────────────────
// Injected by the route handler — keeps this service provider-agnostic.

export interface AIProvider {
  generate(prompt: string, system: string): Promise<{ text: string; tokensUsed: number; provider: "openai" | "gemini" }>;
}

// ─── Send message ─────────────────────────────────────────────────────────────
// Builds a context-aware prompt from the knowledge object + conversation history,
// calls the AI provider, persists the Q&A, returns the answer.

export async function sendMessage(
  noteId: string,
  userId: string,
  question: string,
  ai: AIProvider
): Promise<ReturnType<ChatEntity["toPublic"]>> {
  const note = await noteRepo.findByIdOrThrow(noteId);
  if (!note.belongsTo(userId)) throw new ForbiddenError();

  // ── Build context from knowledge object ────────────────────────────────────
  // Knowledge object gives structured facts — much better than raw text injection.
  const ko = await findKnowledgeObjectByNoteId(noteId);

  const knowledgeContext = ko
    ? buildKnowledgeContext(ko.core)
    : `Document: "${note.title}"\n\nContent:\n${note.content.slice(0, 3000)}`;

  // ── Conversation history ───────────────────────────────────────────────────
  const history = await chatRepo.findHistoryByNoteId(noteId, userId, CHAT_RULES.HISTORY_LIMIT);
  const historyContext = history
    .map((msg) => `User: ${msg.question}\nAssistant: ${msg.answer}`)
    .join("\n\n");

  // ── System prompt ──────────────────────────────────────────────────────────
  const systemPrompt = buildSystemPrompt(note.title, knowledgeContext);

  // ── User prompt ────────────────────────────────────────────────────────────
  const userPrompt = historyContext
    ? `Previous conversation:\n${historyContext}\n\nNew question: ${question}`
    : question;

  // ── Call AI ────────────────────────────────────────────────────────────────
  const response = await ai.generate(userPrompt, systemPrompt);

  // ── Persist ────────────────────────────────────────────────────────────────
  const entity = ChatEntity.create({
    id: randomUUID(),
    userId,
    noteId,
    question,
    answer: response.text,
    provider: response.provider,
    tokensUsed: response.tokensUsed,
  });

  const saved = await chatRepo.create(entity);

  logger.info("Chat message saved", {
    noteId,
    userId,
    tokensUsed: response.tokensUsed,
    provider: response.provider,
  });

  return saved.toPublic();
}

// ─── Get history ──────────────────────────────────────────────────────────────

export async function getChatHistory(
  noteId: string,
  userId: string
): Promise<ReturnType<ChatEntity["toPublic"]>[]> {
  const note = await noteRepo.findByIdOrThrow(noteId);
  if (!note.belongsTo(userId)) throw new ForbiddenError();

  const history = await chatRepo.findHistoryByNoteId(noteId, userId);
  return history.map((m) => m.toPublic());
}

// ─── Clear history ────────────────────────────────────────────────────────────

export async function clearHistory(
  noteId: string,
  userId: string
): Promise<void> {
  const note = await noteRepo.findByIdOrThrow(noteId);
  if (!note.belongsTo(userId)) throw new ForbiddenError();

  await chatRepo.deleteByNoteId(noteId);

  logger.info("Chat history cleared", { noteId, userId });
}

// ─── Context builders ─────────────────────────────────────────────────────────

function buildKnowledgeContext(core: ReturnType<import("@/server/entities/knowledge_object.entity").KnowledgeObjectEntity["core"]["valueOf"]>): string {
  const lines: string[] = [];

  if (core.topic)        lines.push(`Domain: ${core.topic.replace(/_/g, " ")}`);
  if (core.problem)      lines.push(`Problem: ${core.problem}`);
  if (core.method)       lines.push(`Method: ${core.method}`);
  if (core.dataset)      lines.push(`Dataset: ${core.dataset}`);
  if (core.metric)       lines.push(`Metric: ${core.metric}`);
  if (core.accuracy)     lines.push(`Result: ${core.accuracy}`);
  if (core.contribution) lines.push(`Contribution: ${core.contribution}`);
  if (core.limitations)  lines.push(`Limitations: ${core.limitations}`);
  if (core.futureWork)   lines.push(`Future work: ${core.futureWork}`);

  if (core.keywords.length > 0) {
    lines.push(`Key concepts: ${core.keywords.slice(0, 10).join(", ")}`);
  }

  return lines.join("\n");
}

function buildSystemPrompt(noteTitle: string, knowledgeContext: string): string {
  return `You are a study assistant helping a student understand a document titled "${noteTitle}".

Here is the structured knowledge extracted from the document:
${knowledgeContext}

Instructions:
- Answer questions based on the document content above
- Be concise and educational
- If a question cannot be answered from the document, say so clearly
- Use specific facts and figures from the document when relevant
- Explain concepts in a way that aids studying and retention`;
}