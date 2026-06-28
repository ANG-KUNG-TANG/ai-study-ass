import { logger } from "@/server/utils/logger";

// ─── Skipped paths ────────────────────────────────────────────────────────────

const SKIP_PATHS = ["/api/health", "/_next", "/favicon.ico"];

function shouldSkip(pathname: string): boolean {
  return SKIP_PATHS.some((p) => pathname.startsWith(p));
}

function getIP(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

// ─── Request logger ───────────────────────────────────────────────────────────
// Wraps a route handler and logs method, path, status, and response time.
// Optionally logs userId if injected (e.g. from auth context).
//
// Usage:
//   export const GET = withRequestLogger(withAuth(async (req, ctx, auth) => {
//     ...
//   }))
//
// Or call logRequest() manually at the top of a handler.

export async function logRequest(
  req: Request,
  handler: () => Promise<Response>
): Promise<Response> {
  const url = new URL(req.url);

  if (shouldSkip(url.pathname)) return handler();

  const start = Date.now();
  const method = req.method;
  const path = url.pathname;
  const ip = getIP(req);

  let status = 500;
  try {
    const response = await handler();
    status = response.status;
    return response;
  } finally {
    const ms = Date.now() - start;
    logger.info(`${method} ${path}`, { status, ms, ip });
  }
}