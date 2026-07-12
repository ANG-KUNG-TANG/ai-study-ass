// app/api/flashcards/[id]/review/route.ts
import { withAuth } from "@/server/middleware/auth.middleware";
import { updateFlashcardReview } from "@/server/controller/flashcard.controller";

export const PATCH = withAuth(updateFlashcardReview);