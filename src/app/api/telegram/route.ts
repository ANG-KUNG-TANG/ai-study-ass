import { withAuth } from "@/server/middleware/auth.middleware";

import { disconnect } from "@/server/controller/telegram.controller";

export const DELETE = withAuth(disconnect);
