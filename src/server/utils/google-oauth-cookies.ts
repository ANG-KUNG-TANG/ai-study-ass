import { timingSafeEqual } from "crypto";
import type { NextRequest, NextResponse } from "next/server";

import { env } from "@/server/config/env";

const COOKIE_STATE = "google_oauth_state";
const COOKIE_NONCE = "google_oauth_nonce";
const COOKIE_CODE_VERIFIER = "google_oauth_code_verifier";
const COOKIE_PATH = "/api/auth/google";
const COOKIE_MAX_AGE_SECONDS = 10 * 60;

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: COOKIE_PATH,
    maxAge,
  };
}

export interface GoogleOAuthCookieValues {
  state: string;
  nonce: string;
  codeVerifier: string;
}

export function setGoogleOAuthCookies(
  response: NextResponse,
  values: GoogleOAuthCookieValues,
): NextResponse {
  const options = cookieOptions(COOKIE_MAX_AGE_SECONDS);
  response.cookies.set(COOKIE_STATE, values.state, options);
  response.cookies.set(COOKIE_NONCE, values.nonce, options);
  response.cookies.set(COOKIE_CODE_VERIFIER, values.codeVerifier, options);
  return response;
}

export function readGoogleOAuthCookies(
  request: NextRequest,
): Partial<GoogleOAuthCookieValues> {
  return {
    state: request.cookies.get(COOKIE_STATE)?.value,
    nonce: request.cookies.get(COOKIE_NONCE)?.value,
    codeVerifier: request.cookies.get(COOKIE_CODE_VERIFIER)?.value,
  };
}

export function clearGoogleOAuthCookies(
  response: NextResponse,
): NextResponse {
  const options = cookieOptions(0);
  response.cookies.set(COOKIE_STATE, "", options);
  response.cookies.set(COOKIE_NONCE, "", options);
  response.cookies.set(COOKIE_CODE_VERIFIER, "", options);
  return response;
}

export function secureStringEqual(
  left: string | undefined,
  right: string | undefined,
): boolean {
  if (!left || !right) return false;

  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;

  return timingSafeEqual(leftBuffer, rightBuffer);
}
