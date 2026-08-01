import { withAuth } from "@/server/middleware/auth.middleware";
import {
  generateFlashcards,
  listFlashcards,
} from "@/server/controller/flashcard.controller";

export const GET = withAuth(listFlashcards);
export const POST = withAuth(generateFlashcards);