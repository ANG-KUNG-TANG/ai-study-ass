import { NotFoundError } from "@/server/utils/errors";
import { StickyNoteEntity } from "@/server/entities/sticky-note.entity";
import * as stickyNoteRepo from "@/server/repositories/sticky-note.repo";

export async function createStickyNote(
  userId: string,
  input: {
    content: string;
    sourcePath?: string;
  },
) {
  const entity = StickyNoteEntity.create({
    userId,
    content: input.content,
    sourcePath: input.sourcePath,
  });

  return (await stickyNoteRepo.create(entity)).toPublic();
}

export async function listStickyNotes(userId: string, limit: number) {
  const notes = await stickyNoteRepo.findRecentByUser(userId, limit);
  return notes.map((note) => note.toPublic());
}

export async function deleteStickyNote(
  id: string,
  userId: string,
): Promise<void> {
  const deleted = await stickyNoteRepo.deleteByIdAndUserId(id, userId);

  if (!deleted) {
    throw new NotFoundError("Sticky note");
  }
}
