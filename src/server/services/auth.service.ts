import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import {
  signTokenPair,
  verifyRefreshToken,
  revokeAllUserTokens,
  clearUserRevocation,
  type TokenPair,
} from "@/server/utils/jwt";
import * as userRepo from "@/server/repositories/user.repo;
import { UserEntity } from "@/server/entities/user.entity";
import { BCRYPT_ROUNDS } from "@/server/utils/constants";
import { USER_RULES } from "@/server/entities/user.entity";
import {
  ConflictError,
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

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthResult {
  user: ReturnType<UserEntity["toPublic"]>;
  tokens: TokenPair;
}

// ─── Register ─────────────────────────────────────────────────────────────────

export async function register(
  input: RegisterInput,
  sendVerificationEmail: (email: string, token: string) => Promise<void>
): Promise<{ message: string }> {
  // Fast duplicate check before doing any hashing
  const taken = await userRepo.existsByEmail(input.email);
  if (taken) throw new ConflictError("Email already registered");

  // Hash password here — entity stays free of bcrypt
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const verificationToken = randomUUID();

  // Entity validates name + email and sets isActive=false, role="user"
  const entity = UserEntity.create({
    id: randomUUID(),
    name: input.name,
    email: input.email,
    passwordHash,
    emailVerificationToken: verificationToken,
  });

  await userRepo.create(entity);

  // Send email AFTER DB write — if email fails, user can request resend
  await sendVerificationEmail(entity.email, verificationToken);

  logger.info("User registered — awaiting verification", { userId: entity.id });

  return { message: "Account created — please check your email to verify your account" };
}

// ─── Verify email ─────────────────────────────────────────────────────────────

export async function verifyEmail(token: string): Promise<{ message: string }> {
  const user = await userRepo.findByVerificationToken(token);

  if (!user) throw new BadRequestError("Invalid verification token");

  if (!user.isVerificationTokenValid(token)) {
    throw new BadRequestError("Verification token has expired — please request a new one");
  }

  // Flip isActive=true, clear token fields
  await userRepo.activate(user.id);

  logger.info("User email verified", { userId: user.id });

  return { message: "Email verified — you can now log in" };
}

// ─── Resend verification email ────────────────────────────────────────────────

export async function resendVerification(
  email: string,
  sendVerificationEmail: (email: string, token: string) => Promise<void>
): Promise<{ message: string }> {
  const user = await userRepo.findByEmail(email);

  // Always return same message — don't reveal if email exists
  const genericMessage = "If that email is registered and unverified, a new link has been sent";

  if (!user) return { message: genericMessage };
  if (user.isActive) return { message: genericMessage };

  const newToken = randomUUID();
  const expires = new Date(Date.now() + USER_RULES.emailVerification.expiresInMs);

  await userRepo.updateVerificationToken(user.id, newToken, expires);
  await sendVerificationEmail(user.email, newToken);

  logger.info("Verification email resent", { userId: user.id });

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

  const tokens = signTokenPair({ userId: user.id, email: user.email, jti: randomUUID() });

  // Store refresh token ID for rotation tracking
  await userRepo.updateRefreshTokenId(user.id, tokens.refreshTokenId);

  logger.info("User logged in", { userId: user.id });

  return { user: user.toPublic(), tokens };
}

// ─── Logout ───────────────────────────────────────────────────────────────────

export async function logout(userId: string): Promise<void> {
  await userRepo.updateRefreshTokenId(userId, null);
  logger.info("User logged out", { userId });
}

// ─── Refresh tokens ───────────────────────────────────────────────────────────

export async function refreshTokens(incomingRefreshToken: string): Promise<TokenPair> {
  // Verify signature + expiry first (no DB)
  const payload = verifyRefreshToken(incomingRefreshToken);

  // Load user with their stored refresh token ID
  const user = await userRepo.findById(payload.userId, { withRefreshTokenId: true });
  if (!user) throw new UnauthorizedError("User not found");

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
  const tokens = signTokenPair({ userId: user.id, email: user.email, jti: randomUUID() });
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

  const newHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);

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
  // Always return generic message — never reveal if email exists
  const genericMessage = "If that email is registered, a password reset link has been sent";

  const user = await userRepo.findByEmail(email);
  if (!user) return { message: genericMessage };

  // Inactive users cannot reset password — they should verify email first
  if (!user.isActive) return { message: genericMessage };

  const resetToken = randomUUID();
  const expires = new Date(Date.now() + USER_RULES.passwordReset.expiresInMs);

  await userRepo.updatePasswordResetToken(user.id, resetToken, expires);
  await sendResetEmail(user.email, resetToken);

  logger.info("Password reset email sent", { userId: user.id });

  return { message: genericMessage };
}

// ─── Reset password — submit new password via token ──────────────────────────

export async function resetPassword(
  token: string,
  newPassword: string
): Promise<{ message: string }> {
  const user = await userRepo.findByPasswordResetToken(token);

  if (!user) throw new BadRequestError("Invalid or expired reset token");

  // Entity owns the expiry check logic
  if (!user.isPasswordResetTokenValid(token)) {
    throw new BadRequestError("Reset token has expired — please request a new one");
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  // Update password + clear token + invalidate all sessions
  await userRepo.updatePassword(user.id, passwordHash);
  await userRepo.clearPasswordResetToken(user.id);
  await revokeAllUserTokens(user.id);

  logger.info("Password reset completed — all sessions invalidated", { userId: user.id });

  return { message: "Password reset successful — please log in with your new password" };
}