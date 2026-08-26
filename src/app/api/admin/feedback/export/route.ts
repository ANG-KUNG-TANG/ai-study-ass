import { exportFeedback } from "@/server/controller/feedback.controller";
import { withRole } from "@/server/middleware/auth.middleware";
import { apiLimiter } from "@/server/middleware/rate_limiter.middleware";

export const GET = withRole("admin")(async (req, context, auth) => {
  await apiLimiter(req, `admin:${auth.userId}:feedback:export`);
  return exportFeedback(req, context, auth);
});
