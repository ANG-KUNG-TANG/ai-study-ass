import { withErrorHandler } from '@/server/middleware/error.middleware';
import { withAuth } from '@/server/middleware/auth.middleware';
import { listQuizzesByNoteController } from '@/server/controller/quiz.controller';

export const GET = withErrorHandler(withAuth(listQuizzesByNoteController));