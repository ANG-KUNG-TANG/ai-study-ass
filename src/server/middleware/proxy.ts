import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { COOKIE_REFRESH_TOKEN } from "@/server/utils/constants";

// ─── Route config ─────────────────────────────────────────────────────────────

// Public routes — no token required
const PUBLIC_ROUTES = [
  "/auth/login",
  "/auth/register",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/verify-email",
];

// Public API routes — no token required
const PUBLIC_API_ROUTES = [
  "/api/auth/register",
  "/api/auth/login",
  "/api/auth/refresh",
  "/api/auth/verify-email",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/health",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isPublicPage = (p: string) => PUBLIC_ROUTES.some((r) => p.startsWith(r));

const isPublicApi = (p: string) => PUBLIC_API_ROUTES.some((r) => p.startsWith(r));

const isApiRoute = (p: string) => p.startsWith("/api/");

async function verifyToken(token: string): Promise<boolean> {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET);
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

// ─── Proxy ────────────────────────────────────────────────────────────────────
// Runs on the Node.js runtime before any route handler (Next.js 16: proxy.ts
// replaces the deprecated middleware.ts — same job, new name, no edge runtime).
// Handles redirect logic for pages + blocks unauthenticated API calls early.
// Note: DB revocation check (verifyAccessTokenFull) still happens in
// auth.middleware.ts's withAuth — this is a fast lightweight gate, not the
// full trust check.

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Skip static/internal assets ─────────────────────────────────────────────
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/public")
  ) {
    return NextResponse.next();
  }

  // ── API routes ───────────────────────────────────────────────────────────────
  if (isApiRoute(pathname)) {
    // Public API routes — always allow through
    if (isPublicApi(pathname)) return NextResponse.next();

    // Protected API — must have a valid Bearer token
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;

    if (!token || !(await verifyToken(token))) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        },
        { status: 401 }
      );
    }

    return NextResponse.next();
  }

  // ── Page routes ─────────────────────────────────────────────────────────────
  // Access token lives in memory on the client (not in a cookie). We use the
  // refresh token cookie as a proxy signal for "is logged in" — the real auth
  // check happens when the page loads and calls /api/auth/me.
  const hasSession = Boolean(req.cookies.get(COOKIE_REFRESH_TOKEN)?.value);

  // Already logged in — redirect away from auth pages
  if (isPublicPage(pathname) && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Not logged in — redirect to login, preserve destination
  if (!isPublicPage(pathname) && !hasSession) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)"],
};