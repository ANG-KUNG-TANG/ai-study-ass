import type { NextRequest, NextResponse } from "next/server";
import { env } from "@/server/config/env";
import {
  COOKIE_REFRESH_TOKEN,
  COOKIE_MAX_AGE_MS,
} from "@/server/utils/constants";

const cookieDomain = env.COOKIE_DOMAIN?.trim() || undefined;

function refreshCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge,
    path: "/",
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  };
}

export function setRefreshTokenCookie(
  response: NextResponse,
  token: string,
): NextResponse {
  response.cookies.set(
    COOKIE_REFRESH_TOKEN,
    token,
    refreshCookieOptions(
      Math.floor(COOKIE_MAX_AGE_MS / 1_000),
    ),
  );

  return response;
}

export function clearRefreshTokenCookie(
  response: NextResponse,
): NextResponse {
  response.cookies.set(
    COOKIE_REFRESH_TOKEN,
    "",
    refreshCookieOptions(0),
  );

  return response;
}

export function getRefreshTokenFromRequest(
  request: NextRequest,
): string | undefined {
  return request.cookies.get(COOKIE_REFRESH_TOKEN)?.value;
}
