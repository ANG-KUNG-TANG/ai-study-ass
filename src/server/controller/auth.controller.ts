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
import type { AuthContext } from "@/server/middleware/auth.middleware";

// ─── Purpose ──────────────────────────────────────────────────────────────────
// Public routes (register, login, refresh, verify, forgot/reset password) take
// only `req`. Routes that need an identity (logout, me, change password) take
// `(req, ctx)` and are expected to sit behind withAuth.

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

  const res = successResponse({ user, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
  return setRefreshTokenCookie(res, tokens.refreshToken);
}

// POST /api/auth/logout
export async function logout(_req: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  await authService.logout(ctx.userId);
  const res = noContentResponse();
  return clearRefreshTokenCookie(res);
}

// POST /api/auth/refresh
export async function refresh(req: NextRequest): Promise<NextResponse> {
  const incomingRefreshToken = requireRefreshCookie(req);
  const tokens = await authService.refreshTokens(incomingRefreshToken);

  const res = successResponse({ accessToken: tokens.accessToken });
  return setRefreshTokenCookie(res, tokens.refreshToken);
}

// ─── Profile / password ────────────────────────────────────────────────────────

// GET /api/auth/me
export async function getMe(_req: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const user = await authService.getMe(ctx.userId);
  return successResponse(user);
}

// PATCH /api/auth/password
export async function changePassword(req: NextRequest, ctx: AuthContext): Promise<NextResponse> {
  const input = await validateBody(req, changePasswordSchema);
  await authService.changePassword(ctx.userId, input);
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