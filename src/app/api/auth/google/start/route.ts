import { NextRequest, NextResponse } from "next/server";

import { authLimiter } from "@/server/middleware/rate_limiter.middleware";
import { createGoogleAuthorizationRequest } from "@/server/services/google-oauth.service";
import { isAppError } from "@/server/utils/errors";
import {
  clearGoogleOAuthCookies,
  setGoogleOAuthCookies,
} from "@/server/utils/google-oauth-cookies";
import { logger } from "@/server/utils/logger";
import { publicAppUrl } from "@/server/utils/public-app-url";

export const runtime = "nodejs";

function loginErrorRedirect(
  code: "failed" | "not_configured" | "rate_limited",
): NextResponse {
  const url = publicAppUrl("/auth/login");
  url.searchParams.set("oauth_error", code);
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "no-store");
  return clearGoogleOAuthCookies(response);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await authLimiter(request, "google-oauth-start");

    const { authorizationUrl, state, nonce, codeVerifier } =
      await createGoogleAuthorizationRequest();
    const response = NextResponse.redirect(authorizationUrl);
    response.headers.set("Cache-Control", "no-store");

    return setGoogleOAuthCookies(response, {
      state,
      nonce,
      codeVerifier,
    });
  } catch (error) {
    logger.warn("Google OAuth could not be started", {
      error: error instanceof Error ? error.message : String(error),
    });
    const code =
      isAppError(error) && error.code === "RATE_LIMIT_EXCEEDED"
        ? "rate_limited"
        : isAppError(error) && error.code === "SERVICE_UNAVAILABLE"
          ? "not_configured"
          : "failed";
    return loginErrorRedirect(code);
  }
}
