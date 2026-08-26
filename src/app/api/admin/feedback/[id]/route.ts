import { reviewFeedback } from "@/server/controller/feedback.controller";
import { withRole } from "@/server/middleware/auth.middleware";
import { apiLimiter } from "@/server/middleware/rate_limiter.middleware";

export const PATCH = withRole("admin")(async (req, context, auth) => {
  await apiLimiter(req, `admin:${auth.userId}:feedback:update`);
  return reviewFeedback(req, context, auth);
});
