import { withErrorHandler } from '@/server/middleware/error.middleware';
import { withAuth } from '@/server/middleware/auth.middleware';
import { getQuizController, deleteQuizController } from '@/server/controller/quiz.controller';

export const GET = withErrorHandler(withAuth(getQuizController));
export const DELETE = withErrorHandler(withAuth(deleteQuizController));