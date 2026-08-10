import { withAuth } from "@/server/middleware/auth.middleware";

import { createLink } from "@/server/controller/telegram.controller";

export const POST = withAuth(createLink);
