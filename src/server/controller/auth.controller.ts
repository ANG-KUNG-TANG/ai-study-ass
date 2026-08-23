import type { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as authService from "@/server/services/auth.service";
import { validateBody } from "@/server/middleware/validation.middleware";
import {
  successResponse,
  createdResponse,
  noContentResponse,
} from "@/server/utils/response";
import { UnauthorizedError } from "@/server/utils/errors";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "@/server/utils/mailer";
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
  type RegisterInput,
  type LoginInput,
  type ChangePasswordInput,
  type VerifyEmailInput,
  type ForgotPasswordInput,
  type ResetPasswordInput,
} from "@/server/validators/auth.validators";
import type {
  AuthContext,
  RouteContext,
} from "@/server/middleware/auth.middleware";
import { handleError } from "@/server/middleware/error.middleware";
import { logActivity } from "@/server/services/auditLog.service";

const resendVerificationSchema = z.object({
  email: z.string().email("Invalid email format").toLowerCase().trim(),
});
type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;

function requireRefreshCookie(req: NextRequest): string {
  const token = getRefreshTokenFromRequest(req);
  if (!token) throw new UnauthorizedError("No refresh token provided");
  return token;
}

export async function register(req: NextRequest): Promise<NextResponse> {
  const input = await validateBody<RegisterInput>(req, registerSchema);
  return createdResponse(
    await authService.register(input, sendVerificationEmail),
  );
}

export async function verifyEmail(req: NextRequest): Promise<NextResponse> {
  const { token } = await validateBody<VerifyEmailInput>(
    req,
    verifyEmailSchema,
  );
  return successResponse(await authService.verifyEmail(token));
}

export async function resendVerification(
  req: NextRequest,
): Promise<NextResponse> {
  const { email } = await validateBody<ResendVerificationInput>(
    req,
    resendVerificationSchema,
  );
  return successResponse(
    await authService.resendVerification(email, sendVerificationEmail),
  );
}

export async function login(req: NextRequest): Promise<NextResponse> {
  const input = await validateBody<LoginInput>(req, loginSchema);
  const { user, tokens } = await authService.login(input);

  await logActivity({
    actorId: user.id,
    actorEmail: user.email,
    action: "auth.login",
  });

  return setRefreshTokenCookie(
    successResponse({ user, accessToken: tokens.accessToken }),
    tokens.refreshToken,
  );
}

export async function logout(
  req: NextRequest,
  _context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const authHeader = req.headers.get("Authorization");
  const accessToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : undefined;

  await authService.logout(auth.userId, accessToken);

  await logActivity({
    actorId: auth.userId,
    actorEmail: auth.email,
    action: "auth.logout",
  });

  return clearRefreshTokenCookie(noContentResponse());
}

export async function refresh(req: NextRequest): Promise<NextResponse> {
  const incomingRefreshToken = requireRefreshCookie(req);

  try {
    const tokens = await authService.refreshTokens(incomingRefreshToken);
    return setRefreshTokenCookie(
      successResponse({ accessToken: tokens.accessToken }),
      tokens.refreshToken,
    );
  } catch (error) {
    return clearRefreshTokenCookie(handleError(error));
  }
}

export async function getMe(
  _req: NextRequest,
  _context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  return successResponse(await authService.getMe(auth.userId));
}

export async function changePassword(
  req: NextRequest,
  _context: RouteContext,
  auth: AuthContext,
): Promise<NextResponse> {
  const input = await validateBody<ChangePasswordInput>(
    req,
    changePasswordSchema,
  );
  await authService.changePassword(auth.userId, input);

  return clearRefreshTokenCookie(
    successResponse({ message: "Password changed — please log in again" }),
  );
}

export async function forgotPassword(req: NextRequest): Promise<NextResponse> {
  const { email } = await validateBody<ForgotPasswordInput>(
    req,
    forgotPasswordSchema,
  );
  return successResponse(
    await authService.forgotPassword(email, sendPasswordResetEmail),
  );
}

export async function resetPassword(req: NextRequest): Promise<NextResponse> {
  const { token, newPassword } = await validateBody<ResetPasswordInput>(
    req,
    resetPasswordSchema,
  );
  return successResponse(await authService.resetPassword(token, newPassword));
}
