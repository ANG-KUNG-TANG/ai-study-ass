import { z } from "zod";
import { STICKY_NOTE_RULES } from "@/server/entities/sticky-note.entity";

const createStickyNoteSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Write something before saving")
    .max(STICKY_NOTE_RULES.CONTENT_MAX),
  sourcePath: z
    .string()
    .trim()
    .max(STICKY_NOTE_RULES.SOURCE_PATH_MAX)
    .optional(),
});

const listStickyNotesSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export async function parseCreateStickyNote(req: Request) {
  const body: unknown = await req.json();
  return createStickyNoteSchema.parse(body);
}

export function parseStickyNoteQuery(req: Request): { limit: number } {
  const url = new URL(req.url);
  return listStickyNotesSchema.parse({
    limit: url.searchParams.get("limit") ?? undefined,
  });
}
