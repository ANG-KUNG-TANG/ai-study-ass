// =============================================================================
// src/app/api/quiz/generate/route.ts
//
// POST /api/quiz/generate  { noteId: string, questionCount?: number, questionTypes?: string[] }
// All request handling lives in quiz.controller.ts — this file only wires
// it through the middleware composition.
// =============================================================================

import { withErrorHandler } from '@/server/middleware/error.middleware';
import { withAuth } from '@/server/middleware/auth.middleware';
import { generateQuizController } from '@/server/controller/quiz.controller';

export const POST = withErrorHandler(withAuth(generateQuizController));