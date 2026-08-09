import { withErrorHandler } from "@/server/middleware/error.middleware";
import { webhook } from "@/server/controller/telegram.controller";

export const POST = withErrorHandler(
  async (req, _context) => {
    return webhook(req);
  }
);