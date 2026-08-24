import { NextRequest, NextResponse } from "next/server";

import { connectDb } from "@/server/config/database";
import { authLimiter } from "@/server/middleware/rate_limiter.middleware";
import * as authService from "@/server/services/auth.service";
import { logActivity } from "@/server/services/auditLog.service";
import { verifyGoogleAuthorizationCode } from "@/server/services/google-oauth.service";
import { setRefreshTokenCookie } from "@/server/utils/cookies";
import { isAppError } from "@/server/utils/errors";
import {
  clearGoogleOAuthCookies,
  readGoogleOAuthCookies,
  secureStringEqual,
} from "@/server/utils/google-oauth-cookies";
import { logger } from "@/server/utils/logger";
import { publicAppUrl } from "@/server/utils/public-app-url";

export const runtime = "nodejs";

type OAuthErrorCode =
  | "access_denied"
  | "account_link_required"
  | "failed"
  | "invalid_state"
  | "not_configured"
  | "rate_limited";

function redirectToLogin(
  code: OAuthErrorCode,
): NextResponse {
  const url = publicAppUrl("/auth/login");
  url.searchParams.set("oauth_error", code);

  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "no-store");
  return clearGoogleOAuthCookies(response);
}

function errorCodeFor(error: unknown): OAuthErrorCode {
  if (!isAppError(error)) return "failed";
  if (error.code === "CONFLICT") return "account_link_required";
  if (error.code === "RATE_LIMIT_EXCEEDED") return "rate_limited";
  if (error.code === "SERVICE_UNAVAILABLE") return "not_configured";
  return "failed";
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await authLimiter(request, "google-oauth-callback");

    const returnedState = request.nextUrl.searchParams.get("state") ?? undefined;
    const providerError = request.nextUrl.searchParams.get("error");
    const code = request.nextUrl.searchParams.get("code");
    const stored = readGoogleOAuthCookies(request);

    if (!secureStringEqual(returnedState, stored.state)) {
      logger.warn("Google OAuth state validation failed");
      return redirectToLogin("invalid_state");
    }

    if (providerError) {
      return redirectToLogin("access_denied");
    }

    if (!code || !stored.nonce || !stored.codeVerifier) {
      return redirectToLogin("failed");
    }

    const identity = await verifyGoogleAuthorizationCode({
      code,
      codeVerifier: stored.codeVerifier,
      expectedNonce: stored.nonce,
    });

    await connectDb();
    const { user, tokens } = await authService.loginWithGoogle(identity);

    void logActivity({
      actorId: user.id,
      actorEmail: user.email,
      action: "auth.login",
      metadata: { provider: "google" },
    });

    const destination =
      user.role === "admin" ? "/admin/overview" : "/student/dashboard";
    const destinationUrl = publicAppUrl(destination);

    const response = NextResponse.redirect(destinationUrl);
    response.headers.set("Cache-Control", "no-store");
    setRefreshTokenCookie(response, tokens.refreshToken);
    return clearGoogleOAuthCookies(response);
  } catch (error) {
    logger.warn("Google OAuth callback failed", {
      code: isAppError(error) ? error.code : "UNKNOWN",
      error: error instanceof Error ? error.message : String(error),
    });
    return redirectToLogin(errorCodeFor(error));
  }
}
