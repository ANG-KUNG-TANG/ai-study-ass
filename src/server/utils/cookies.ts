import type { NextRequest, NextResponse } from "next/server";
import { COOKIE_REFRESH_TOKEN, COOKIE_MAX_AGE_MS } from "@/server/utils/constants";

// ─── Purpose ──────────────────────────────────────────────────────────────────
// Centralizes refresh-token cookie handling so auth.controller.ts doesn't
// duplicate cookie options across login / refresh / logout / changePassword.
//
// ⚠ COOKIE_MAX_AGE_MS in your constants.ts is currently:
//     export const COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 1000;
//   That's ~12 hours, not 30 days — missing one `* 60` (seconds→minutes step
//   is there twice, hours→days step is missing). Should be:
//     export const COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
//   Until that's fixed, every refresh cookie will silently expire in 12h even
//   though the refresh JWT itself is signed for 30d — users get logged out
//   client-side well before their token actually expires. This file divides
//   by 1000 to get seconds for NextResponse's cookie API either way, so no
//   change needed here once you fix the constant.

const REFRESH_COOKIE_MAX_AGE_SECONDS = COOKIE_MAX_AGE_MS / 1000;

export function setRefreshTokenCookie(res: NextResponse, token: string): NextResponse {
  res.cookies.set(COOKIE_REFRESH_TOKEN, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: REFRESH_COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });
  return res;
}

export function clearRefreshTokenCookie(res: NextResponse): NextResponse {
  res.cookies.set(COOKIE_REFRESH_TOKEN, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  });
  return res;
}

export function getRefreshTokenFromRequest(req: NextRequest): string | undefined {
  return req.cookies.get(COOKIE_REFRESH_TOKEN)?.value;
}