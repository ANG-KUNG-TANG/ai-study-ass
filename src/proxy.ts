import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { COOKIE_REFRESH_TOKEN } from "@/server/utils/constants";
import { verifyBrowserSession } from "@/server/services/browser-session.service";

// ─── Route config ─────────────────────────────────────────────────────────────

// Public pages — no session required. Prefixed with /auth to match actual
// page locations (src/app/auth/login, src/app/auth/logout, ...).
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
  "/api/auth/resend-verification",
  "/api/health",
  '/api/telegram/webhook', // Telegram bot webhook
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isPublicPage = (p: string) => PUBLIC_ROUTES.some((r) => p.startsWith(r));
const isPublicApi = (p: string) => PUBLIC_API_ROUTES.some((r) => p.startsWith(r));
const isApiRoute = (p: string) => p.startsWith("/api/");

async function verifyAccessToken(token: string): Promise<boolean> {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET);
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

// ─── Proxy ────────────────────────────────────────────────────────────────────
// Next.js 16: proxy.ts replaces the deprecated middleware.ts. Runs on the
// Node.js runtime before any route handler. Handles page redirect logic +
// blocks unauthenticated API calls early. DB revocation check still happens
// in auth.middleware.ts's withAuth — this is a fast, lightweight gate only.

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/public")
  ) {
    return NextResponse.next();
  }

  // ── API routes ───────────────────────────────────────────────────────────────
  if (isApiRoute(pathname)) {
    if (isPublicApi(pathname)) return NextResponse.next();

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

    if (!token || !(await verifyAccessToken(token))) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  // ── Page routes ─────────────────────────────────────────────────────────────
  const session = await verifyBrowserSession(
    req.cookies.get(COOKIE_REFRESH_TOKEN)?.value,
  );
  const isPublicPageRoute = isPublicPage(pathname);

  if (session && isPublicPageRoute) {
    const url = req.nextUrl.clone();
    url.pathname = session.role === "admin" ? "/admin/overview" : "/student/dashboard";
    return NextResponse.redirect(url);
  }

  if (!session && !isPublicPageRoute) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth/login"; // was "/login" — didn't exist, caused the redirect loop
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  if (session && pathname.startsWith("/admin") && session.role !== "admin") {
    const url = req.nextUrl.clone();
    url.pathname = "/student/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/|.well-known/).*)"],
};