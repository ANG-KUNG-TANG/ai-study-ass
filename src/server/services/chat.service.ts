import { randomUUID } from "crypto";
import * as chatRepo from "@/server/repositories/chat.repo";
import * as noteRepo from "@/server/repositories/note.repo";
import { ChatEntity } from "@/server/entities/chat.entity";
import { ForbiddenError } from "@/server/utils/errors";
import { logger } from "@/server/utils/logger";
import { generate as aiGenerate } from "@/server/services/ai.service";
import { CHAT_HISTORY_LIMIT } from "@/server/utils/constants";

const NOTE_CONTENT_CHARS_IN_PROMPT = 6000; // keep prompt size predictable, same idea as summary.prompt.ts

function buildChatPrompt(
  noteTitle: string,
  noteContent: string,
  history: ChatEntity[],
  question: string
): { systemPrompt: string; prompt: string } {
  const systemPrompt =
    `You are a study assistant helping a student understand a specific document. ` +
    `Answer the student's question using the document content and the conversation so far. ` +
    `If the answer isn't in the document, say so honestly rather than guessing.`;

  const historyBlock = history.length
    ? history
        .map((h) => `Student: ${h.question}\nAssistant: ${h.answer}`)
        .join("\n\n")
    : "(no previous messages)";

  const prompt = [
    `Document title: ${noteTitle}`,
    `Document excerpt:\n${noteContent.slice(0, NOTE_CONTENT_CHARS_IN_PROMPT)}`,
    `Conversation so far:\n${historyBlock}`,
    `New question: ${question}`,
  ].join("\n\n");

  return { systemPrompt, prompt };
}

export async function askQuestion(
  noteId: string,
  userId: string,
  question: string
): Promise<ReturnType<ChatEntity["toPublic"]>> {
  const note = await noteRepo.findByIdOrThrow(noteId);
  if (!note.belongsTo(userId)) throw new ForbiddenError();

  const history = await chatRepo.findByNoteIdAndUserId(noteId, userId, CHAT_HISTORY_LIMIT);

  const { systemPrompt, prompt } = buildChatPrompt(note.title, note.content, history, question);

  const aiResult = await aiGenerate({
    prompt,
    systemPrompt,
    temperature: 0.4,
  });

  const entity = ChatEntity.create({
    id: randomUUID(),
    noteId,
    userId,
    question,
    answer: aiResult.text,
    tokensUsed: aiResult.tokensUsed,
    provider: aiResult.provider,
  });

  const saved = await chatRepo.create(entity);
  logger.info("Chat answered", { noteId, userId, tokensUsed: aiResult.tokensUsed });

  return saved.toPublic();
}

export async function getChatHistory(
  noteId: string,
  userId: string
): Promise<ReturnType<ChatEntity["toPublic"]>[]> {
  const note = await noteRepo.findByIdOrThrow(noteId);
  if (!note.belongsTo(userId)) throw new ForbiddenError();

  const history = await chatRepo.findByNoteIdAndUserId(noteId, userId, CHAT_HISTORY_LIMIT);
  return history.map((h) => h.toPublic());
}

export async function clearChatHistory(noteId: string, userId: string): Promise<void> {
  const note = await noteRepo.findByIdOrThrow(noteId);
  if (!note.belongsTo(userId)) throw new ForbiddenError();

  await chatRepo.deleteByNoteIdAndUserId(noteId, userId);
}

export async function deleteForNote(noteId: string): Promise<void> {
  await chatRepo.deleteByNoteId(noteId);
  logger.info("Chat data deleted", { noteId });
}