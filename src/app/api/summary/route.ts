// src/app/api/summary/route.ts
//
// POST /api/summary  { noteId: string, force?: boolean, mode?: SummaryMode }
//
// Thin per DDD — no logic here, just wiring the controller through auth.
// Dropped the outer withErrorHandler: withAuth already calls handleError()
// internally on any thrown error (see auth.middleware.ts's catch block), so
// wrapping it again here doesn't add coverage, only redundancy. If you have
// unauthenticated routes elsewhere that skip withAuth entirely, those are
// the ones that actually need withErrorHandler on their own.

import { withAuth } from "@/server/middleware/auth.middleware";
import { postSummary } from "@/server/controller/summary.controller";

export const POST = withAuth(postSummary);
