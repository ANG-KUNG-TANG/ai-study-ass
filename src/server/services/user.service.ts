import bcrypt from "bcryptjs";
import * as userRepo from "@/server/repositories/user.repo";
import * as noteRepo from "@/server/repositories/note.repo";
import * as quizRepo from "@/server/repositories/quiz.repo";
import * as flashcardRepo from "@/server/repositories/flashcard.repo";
import * as chatRepo from "@/server/repositories/chat.repo";
import * as intelligenceRepo from "@/server/repositories/intelligence.repo";
import * as generationRepo from "@/server/repositories/study-generation.repo";
import * as aiUsageRepo from "@/server/repositories/ai-usage.repo";
import { UserEntity } from "@/server/entities/user.entity";
import { revokeAllUserTokens } from "@/server/utils/jwt";
import { NotFoundError, ForbiddenError } from "@/server/utils/errors";
import { logger } from "@/server/utils/logger";

export async function getProfile(
  userId: string,
): Promise<ReturnType<UserEntity["toPublic"]>> {
  const user = await userRepo.findById(userId);
  if (!user) throw new NotFoundError("User");
  return user.toPublic();
}

export async function updateProfile(
  userId: string,
  data: { name?: string },
): Promise<ReturnType<UserEntity["toPublic"]>> {
  const user = await userRepo.findById(userId);
  if (!user) throw new NotFoundError("User");

  const updated = await userRepo.updateProfile(userId, data);
  if (!updated) throw new NotFoundError("User");

  logger.info("Profile updated", { userId });
  return updated.toPublic();
}

/** Permanently removes a user's account and all owned study data. */
export async function deleteAccount(
  userId: string,
  passwordConfirmation: string,
): Promise<void> {
  const user = await userRepo.findById(userId, { withPassword: true });
  if (!user) throw new NotFoundError("User");

  const match = await bcrypt.compare(
    passwordConfirmation,
    user.passwordHash,
  );
  if (!match) throw new ForbiddenError("Password confirmation failed");

  const noteIds = await noteRepo.findIdsByUserId(userId);

  await Promise.all(
    noteIds.map((noteId) =>
      Promise.all([
        quizRepo.deleteByNoteId(noteId),
        flashcardRepo.deleteByNoteId(noteId),
        chatRepo.deleteByNoteId(noteId),
        intelligenceRepo.deleteByNoteId(noteId),
        generationRepo.deleteByNoteId(noteId),
      ]),
    ),
  );

  // Clean possible legacy/orphan records in addition to note-scoped deletion.
  await Promise.all([
    quizRepo.deleteByUserId(userId),
    flashcardRepo.deleteByUserId(userId),
    chatRepo.deleteByUserId(userId),
    aiUsageRepo.deleteByUserId(userId),
    noteRepo.deleteByUserId(userId),
    revokeAllUserTokens(userId),
  ]);

  await userRepo.deleteById(userId);
  logger.info("Account and owned study data deleted by user", { userId });
}
