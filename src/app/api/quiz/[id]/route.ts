// =============================================================================
// src/app/api/quiz/[id]/route.ts
//
// GET /api/quiz/[id] — fetch a previously generated quiz by its id.
// All request handling lives in quiz.controller.ts.
// =============================================================================

import { withErrorHandler } from '@/server/middleware/error.middleware';
import { withAuth } from '@/server/middleware/auth.middleware';
import { getQuizController, listQuizzesByNoteController } from '@/server/controller/quiz.controller';


export const GET = withErrorHandler(withAuth(getQuizController));

// export const GET = withErrorHandler(withAuth(listQuizzesByNoteController));