import { withAuth } from "@/server/middleware/auth.middleware";

import { getStatus } from "@/server/controller/telegram.controller";

export const GET = withAuth(getStatus);
