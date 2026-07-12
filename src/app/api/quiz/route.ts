import { withErrorHandler } from '@/server/middleware/error.middleware';
import { withAuth } from '@/server/middleware/auth.middleware';
import { listAllQuizzesController } from '@/server/controller/quiz.controller';

export const GET = withErrorHandler(withAuth(listAllQuizzesController));