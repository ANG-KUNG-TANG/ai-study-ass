import type { NextRequest, NextResponse } from "next/server";
import * as authService from "@/server/services/auth.service";
import { validateBody } from "@/server/middleware/validation.middleware";
import { successResponse, createdResponse, noContentResponse } from "@/server/utils/response";
import { UnauthorizedError } from "@/server/utils/errors";
import { sendVerificationEmail, sendPasswordResetEmail } from "@/server/utils/mailer";
import {
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  getRefreshTokenFromRequest,
} from "@/server/utils/cookies";
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/server/validators/auth.validators";
import { z } from "zod";
import type { AuthContext, RouteContext } from "@/server/middleware/auth.middleware";
import { handleError } from "@/server/middleware/error.middleware";
import { COOKIE_REFRESH_TOKEN } from "../utils/constants";
import { logActivity } from "../services/auditLog.service";


// ─── Purpose ──────────────────────────────────────────────────────────────────
// Public routes (register, login, refresh, verify, forgot/reset password) take
// only `req`. Routes that need an identity (logout, me, change password) sit
// behind withAuth and take (req, context, auth) — matching withAuth's real
// call signature. auth.userId (NOT context) is where the identity lives.

const resendVerificationSchema = z.object({
  email: z.string({ error: "Email is required" }).email("Invalid email format").toLowerCase().trim(),
});

function requireRefreshCookie(req: NextRequest): string {
  const token = getRefreshTokenFromRequest(req);
  if (!token) throw new UnauthorizedError("No refresh token provided");
  return token;
}

// ─── Registration / verification ───────────────────────────────────────────────

// POST /api/auth/register
export async function register(req: NextRequest): Promise<NextResponse> {
  const input = await validateBody(req, registerSchema);
  const result = await authService.register(input, sendVerificationEmail);
  // result may be a simple message object or a user object. Guard before logging.
  if ((result as any)?.id) {
    const r = result as any;
    logActivity({ actorId: r.id, actorEmail: r.email, action: "auth.register" });
  }
  return createdResponse(result);
}

// POST /api/auth/verify-email
export async function verifyEmail(req: NextRequest): Promise<NextResponse> {
  const { token } = await validateBody(req, verifyEmailSchema);
  const result = await authService.verifyEmail(token);
  return successResponse(result);
}

// POST /api/auth/resend-verification
export async function resendVerification(req: NextRequest): Promise<NextResponse> {
  const { email } = await validateBody(req, resendVerificationSchema);
  const result = await authService.resendVerification(email, sendVerificationEmail);
  return successResponse(result);
}

// ─── Login / logout / refresh ──────────────────────────────────────────────────

// POST /api/auth/login
export async function login(req: NextRequest): Promise<NextResponse> {
  const input = await validateBody(req, loginSchema);
  const { user, tokens } = await authService.login(input);
  logActivity({ actorId: user.id, actorEmail: user.email, action: "auth.login" });
  const res = successResponse({ user, accessToken: tokens.accessToken });
  return setRefreshTokenCookie(res, tokens.refreshToken);
}

// POST /api/auth/logout
export async function logout(
  req: NextRequest,
  _context: RouteContext,
  auth: AuthContext
): Promise<NextResponse> {
  const authHeader = req.headers.get("Authorization");
  const accessToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : undefined;

  await authService.logout(auth.userId, accessToken);
  logActivity({ actorId: auth.userId, actorEmail: auth.email, action: "auth.logout" });
  const res = noContentResponse();
  return clearRefreshTokenCookie(res);
}

// POST /api/auth/refresh
export async function refresh(req: NextRequest): Promise<NextResponse> {
  const incomingRefreshToken = requireRefreshCookie(req);
  try {
    const tokens = await authService.refreshTokens(incomingRefreshToken);
    const res = successResponse({ accessToken: tokens.accessToken });
    return setRefreshTokenCookie(res, tokens.refreshToken);
  } catch (err) {
    // The refresh cookie the client is holding is dead (expired, reused, or
    // the user no longer exists) — clear it so the client stops resending it.
    // Without this, a failed refresh loops forever: same bad cookie in,
    // same 401 out, burning the authLimiter budget every retry.
    const res = handleError(err);
    return clearRefreshTokenCookie(res);
  }
}

// ─── Profile / password ────────────────────────────────────────────────────────

// GET /api/auth/me
export async function getMe(
  _req: NextRequest,
  _context: RouteContext,
  auth: AuthContext
): Promise<NextResponse> {
  const user = await authService.getMe(auth.userId);
  return successResponse(user);
}

// PATCH /api/auth/password
export async function changePassword(
  req: NextRequest,
  _context: RouteContext,
  auth: AuthContext
): Promise<NextResponse> {
  const input = await validateBody(req, changePasswordSchema);
  await authService.changePassword(auth.userId, input);
  // changePassword revokes all sessions server-side — clear this device's cookie too
  const res = successResponse({ message: "Password changed — please log in again" });
  return clearRefreshTokenCookie(res);
}

// ─── Forgot / reset password ───────────────────────────────────────────────────

// POST /api/auth/forgot-password
export async function forgotPassword(req: NextRequest): Promise<NextResponse> {
  const { email } = await validateBody(req, forgotPasswordSchema);
  const result = await authService.forgotPassword(email, sendPasswordResetEmail);
  return successResponse(result);
}

// POST /api/auth/reset-password
export async function resetPassword(req: NextRequest): Promise<NextResponse> {
  const { token, newPassword } = await validateBody(req, resetPasswordSchema);
  const result = await authService.resetPassword(token, newPassword);
  return successResponse(result);
}