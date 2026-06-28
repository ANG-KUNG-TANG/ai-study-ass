import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { COOKIE_REFRESH_TOKEN } from "../utils/constants";
import { success } from "zod";

// ─── Route config ─────────────────────────────────────────────────────────────

// Public routes — no token required
const PUBLIC_ROUTES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
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

const isApiRoute = (p: string) => p.startsWith('/api/')


async function verifyToken(token: string): Promise<boolean> {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET);
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

// ─── Middleware ───────────────────────────────────────────────────────────────
// Runs on the edge before any route handler.
// Handles redirect logic for pages + blocks unauthenticated API calls early.
// Note: DB revocation check (verifyAccessTokenFull) still happens in auth middleware —
// this is a fast lightweight gate, not the full trust check.

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── API routes ──────────────────────────────────────────────────────────────
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/public')
  ) {
    return NextResponse.next();
  }
  //Public API routes - always allow
  if (isApiRoute(pathname)) {
    if (isPublicApi(pathname)) return NextResponse.next();
  }

  //protect api - must have valid Beared token
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (!token || !(await verifyToken(token))){
    return NextResponse.json(
        {
            success: false,
            error: { code : "UNAUTHORIZED", message: "Authentication required"},
        },
        { status: 401}
    )
    return NextResponse.next();
}

    // ── Page routes ─────────────────────────────────────────────────────────────
    /**
     * access token lives in memeory on the cliednt (not ina cookie).
     * we use the refresh token cookie as a proxy signal for "is logged in"
     * the real auth check happes when the apage loasds and call /api/auth/me
     */
    const hasSession = Boolean(req.cookies.get(COOKIE_REFRESH_TOKEN)?.value);
    // already loggedin -> redirect away from auth pages 
    if (isPublicPage(pathname) && hasSession){
        return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    
    //not logged in -> redirect to login, preserve destinaitn
    if (!isPublicPage(pathname) && !hasSession) {
        const loginUrl = new URL("/login", req.url);
        loginUrl.searchParams.set('from', pathname);
        return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
}

export const config = {
    matcher : ["/((?!_next/static|_next/image|favicon.ico|public/).*)"],
};

