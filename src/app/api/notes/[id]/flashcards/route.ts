// app/api/notes/[id]/flashcards/route.ts
import { withAuth } from "@/server/middleware/auth.middleware";
import { generateFlashcards, listFlashcards } from "@/server/controller/flashcard.controller";

export const POST = withAuth(generateFlashcards);
export const GET = withAuth(listFlashcards);