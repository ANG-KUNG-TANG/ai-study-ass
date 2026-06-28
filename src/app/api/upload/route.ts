import { connectDB } from "@/lib/mongodb";
import { withAuth } from "@/server/middleware/auth.middleware";
import { createResponse } from "@/server/utils/response";
import { extractFileFromRequest, processUpload } from "@/server/services/upload.service";
import { createNote } from "@/server/services/note.service";
import { authLimiter } from "@/server/middleware/rate_limiter.middleware";

export const POST = withAuth(async (req, _ctx, auth) => {
  authLimiter(req);
  await connectDB();

  const file = await extractFileFromRequest(req);
  const processed = await processUpload(file);
  const note = await createNote(auth.userId, processed);

  return createResponse(note, "Note created successfully");
});