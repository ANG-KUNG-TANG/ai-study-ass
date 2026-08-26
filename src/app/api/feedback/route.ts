import { createFeedback, listOwnFeedback } from "@/server/controller/feedback.controller";
import { withAuth } from "@/server/middleware/auth.middleware";
import { apiLimiter } from "@/server/middleware/rate_limiter.middleware";

export const GET = withAuth(async (req, context, auth) => {
  await apiLimiter(req, `feedback:${auth.userId}:list`);
  return listOwnFeedback(req, context, auth);
});

export const POST = withAuth(async (req, context, auth) => {
  await apiLimiter(req, `feedback:${auth.userId}:create`);
  return createFeedback(req, context, auth);
});
