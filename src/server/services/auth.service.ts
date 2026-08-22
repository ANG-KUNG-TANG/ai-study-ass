import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import {
  signTokenPair,
  verifyRefreshToken,
  revokeAllUserTokens,
  revokeToken,
  clearUserRevocation,
  areAllUserTokensRevoked,
  type TokenPair,
} from "@/server/utils/jwt";
import * as userRepo from "@/server/repositories/user.repo"
import { UserEntity } from "@/server/entities/user.entity";
import { USER_RULES } from "@/server/entities/user.entity";
import {
  UnauthorizedError,
  NotFoundError,
  BadRequestError,
} from "@/server/utils/errors";
import { logger } from "@/server/utils/logger";
import type {
  RegisterInput,
  LoginInput,
  ChangePasswordInput,
} from "@/server/validators/auth.validators";
import { env } from "../config/env";
import { logActivity } from "@/server/services/auditLog.service";
import {
  generateActionToken,
  hashActionToken,
} from "@/server/utils/action-token";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthResult {
  user: ReturnType<UserEntity["toPublic"]>;
  tokens: TokenPair;
}

const GENERIC_REGISTRATION_MESSAGE =
  "If registration can proceed, check your email for verification instructions";

function isDuplicateKeyError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === 11000,
  );
}

// ─── Register ─────────────────────────────────────────────────────────────────

export async function register(
  input: RegisterInput,
  sendVerificationEmail: (email: string, token: string) => Promise<void>
): Promise<{ message: string }> {
  // Perform the expensive password hash before the account-existence
  // decision so the easiest registration timing signal is reduced.
  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);

  const taken = await userRepo.existsByEmail(input.email);
  if (taken) {
    return { message: GENERIC_REGISTRATION_MESSAGE };
  }

  const verificationToken = generateActionToken();
  const verificationTokenHash = hashActionToken(verificationToken);

  const entity = UserEntity.create({
    id: randomUUID(),
    name: input.name,
    email: input.email,
    passwordHash,
    emailVerificationToken: verificationTokenHash,
  });

  try {
    await userRepo.create(entity);
  } catch (error) {
    // Two concurrent requests can both pass existsByEmail(). MongoDB's
    // unique email index is the final authority; do not expose that race
    // as an account-existence signal.
    if (isDuplicateKeyError(error)) {
      return { message: GENERIC_REGISTRATION_MESSAGE };
    }
    throw error;
  }

  void logActivity({
    actorId: entity.id,
    actorEmail: entity.email,
    action: "auth.register",
    targetType: "user",
    targetId: entity.id,
  });

  // Email delivery is best-effort: the account is already created and valid.
  // If sending fails (provider outage, misconfig, etc.), log it and let the
  // user request a fresh link via resendVerification — don't fail the whole
  // registration over a transport-layer problem.
  try {
    await sendVerificationEmail(entity.email, verificationToken);
  } catch (err) {
    logger.warn("Verification email failed to send — user can request resend", {
      userId: entity.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  logger.info("User registered — awaiting verification", { userId: entity.id });

  return { message: GENERIC_REGISTRATION_MESSAGE };
}

// ─── Verify email ─────────────────────────────────────────────────────────────

export async function verifyEmail(token: string): Promise<{ message: string }> {
  const tokenHash = hashActionToken(token);

  const user = await userRepo.consumeVerificationToken(
    tokenHash,
    new Date(),
  );

  if (!user) {
    throw new BadRequestError("Invalid or expired verification token");
  }

  logger.info("User email verified", { userId: user.id });

  return { message: "Email verified — you can now log in" };
}

// ─── Resend verification email ────────────────────────────────────────────────

export async function resendVerification(
  email: string,
  sendVerificationEmail: (email: string, token: string) => Promise<void>
): Promise<{ message: string }> {
  const user = await userRepo.findByEmail(email);
  const genericMessage = "If that email is registered and unverified, a new link has been sent";

  if (!user) return { message: genericMessage };
  if (user.isActive) return { message: genericMessage };

  const newToken = generateActionToken();
  const newTokenHash = hashActionToken(newToken);
  const expires = new Date(Date.now() + USER_RULES.emailVerification.expiresInMs);

  await userRepo.updateVerificationToken(user.id, newTokenHash, expires);

  try {
    await sendVerificationEmail(user.email, newToken);
  } catch (err) {
    logger.warn("Resend verification email failed", {
      userId: user.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  logger.info("Verification email resend attempted", { userId: user.id });

  return { message: genericMessage };
}

// ─── Login ────────────────────────────────────────────────────────────────────

export async function login(input: LoginInput): Promise<AuthResult> {
  // Need passwordHash to compare — explicit opt-in
  const user = await userRepo.findByEmail(input.email, { withPassword: true });

  // Same error for wrong email OR wrong password — prevents user enumeration
  if (!user) throw new UnauthorizedError("Invalid email or password");

  // Domain rule: must be verified before login
  const { allowed, reason } = user.canLogin();
  if (!allowed) throw new UnauthorizedError(reason);

  const passwordMatch = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordMatch) throw new UnauthorizedError("Invalid email or password");

  // Clear any all-user revocation (e.g. after password change) before issuing new tokens
  await clearUserRevocation(user.id);

  const tokens = signTokenPair({ userId: user.id, email: user.email, role: user.role, jti: randomUUID() });

  // Store refresh token ID for rotation tracking
  await userRepo.updateRefreshTokenId(user.id, tokens.refreshTokenId);

  logger.info("User logged in", { userId: user.id });

  return { user: user.toPublic(), tokens };
}

// ─── Logout ───────────────────────────────────────────────────────────────────

export async function logout(userId: string, accessToken?: string): Promise<void> {
  if (accessToken){
    await revokeToken(accessToken, env.JWT_ACCESS_SECRET)
  }
  await userRepo.updateRefreshTokenId(userId, null);
  logger.info("User logged out", { userId });
}

// ─── Refresh tokens ───────────────────────────────────────────────────────────

export async function refreshTokens(incomingRefreshToken: string): Promise<TokenPair> {
  // Verify signature + expiry first (no DB)
  const payload = verifyRefreshToken(incomingRefreshToken);

  // Load the current account state and explicit all-session revocation.
  const [user, allRevoked] = await Promise.all([
    userRepo.findById(payload.userId, { withRefreshTokenId: true }),
    areAllUserTokensRevoked(payload.userId),
  ]);

  if (!user) {
    throw new UnauthorizedError("Session invalidated — please log in again");
  }

  // A banned/inactive account or an explicit revoke-all decision must not be
  // able to rotate its refresh token into a new credential pair.
  if (!user.isActive || allRevoked) {
    if (user.refreshTokenId !== null) {
      await userRepo.updateRefreshTokenId(payload.userId, null);
    }
    throw new UnauthorizedError("Session invalidated — please log in again");
  }

  // Reuse detection — incoming jti must match what's stored
  // Mismatch = old token replayed → attacker or token leak → revoke everything
  if (user.refreshTokenId !== payload.jti) {
    await userRepo.updateRefreshTokenId(payload.userId, null);
    await revokeAllUserTokens(payload.userId);
    logger.warn("Refresh token reuse detected — all tokens revoked", {
      userId: payload.userId,
    });
    throw new UnauthorizedError("Session invalidated — please log in again");
  }

  // Issue new pair, rotate stored ID — old token is now dead
  const tokens = signTokenPair({ userId: user.id, email: user.email, role: user.role, jti: randomUUID() });
  await userRepo.updateRefreshTokenId(user.id, tokens.refreshTokenId);

  logger.info("Tokens rotated", { userId: user.id });

  return tokens;
}

// ─── Get current user ─────────────────────────────────────────────────────────

export async function getMe(userId: string): Promise<ReturnType<UserEntity["toPublic"]>> {
  const user = await userRepo.findById(userId);
  if (!user) throw new NotFoundError("User");
  return user.toPublic();
}

// ─── Change password ──────────────────────────────────────────────────────────

export async function changePassword(
  userId: string,
  input: ChangePasswordInput
): Promise<void> {
  const user = await userRepo.findById(userId, { withPassword: true });
  if (!user) throw new NotFoundError("User");

  const match = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!match) throw new UnauthorizedError("Current password is incorrect");

  const newHash = await bcrypt.hash(input.newPassword, env.BCRYPT_ROUNDS);

  // updatePassword clears refreshTokenId — invalidates all sessions
  await userRepo.updatePassword(userId, newHash);

  // Revoke all access tokens in the blocklist too
  await revokeAllUserTokens(userId);

  logger.info("Password changed — all sessions invalidated", { userId });
}

// ─── Forgot password — request reset link ────────────────────────────────────

export async function forgotPassword(
  email: string,
  sendResetEmail: (email: string, token: string) => Promise<void>
): Promise<{ message: string }> {
  const genericMessage = "If that email is registered, a password reset link has been sent";

  const user = await userRepo.findByEmail(email);
  if (!user) return { message: genericMessage };
  if (!user.isActive) return { message: genericMessage };

  const resetToken = generateActionToken();
  const resetTokenHash = hashActionToken(resetToken);
  const expires = new Date(Date.now() + USER_RULES.passwordReset.expiresInMs);

  await userRepo.updatePasswordResetToken(user.id, resetTokenHash, expires);

  try {
    await sendResetEmail(user.email, resetToken);
  } catch (err) {
    logger.warn("Password reset email failed to send", {
      userId: user.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return { message: genericMessage };
}

// ─── Reset password — submit new password via token ──────────────────────────

export async function resetPassword(
  token: string,
  newPassword: string
): Promise<{ message: string }> {
  const tokenHash = hashActionToken(token);
  const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);

  const user = await userRepo.consumePasswordResetToken(
    tokenHash,
    passwordHash,
    new Date(),
  );

  if (!user) {
    throw new BadRequestError("Invalid or expired reset token");
  }

  await revokeAllUserTokens(user.id);

  logger.info("Password reset completed — all sessions invalidated", {
    userId: user.id,
  });

  return {
    message: "Password reset successful — please log in with your new password",
  };
}