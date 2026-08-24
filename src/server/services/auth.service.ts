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
  EmailNotVerifiedError,
  NotFoundError,
  BadRequestError,
  ConflictError,
} from "@/server/utils/errors";
import { logger } from "@/server/utils/logger";
import type {
  RegisterInput,
  LoginInput,
  ChangePasswordInput,
} from "@/server/validators/auth.validators";
import type { GoogleIdentity } from "@/server/services/google-oauth.service";
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

async function issueSession(user: UserEntity): Promise<AuthResult> {
  await clearUserRevocation(user.id);

  const tokens = signTokenPair({
    userId: user.id,
    email: user.email,
    role: user.role,
    jti: randomUUID(),
  });

  await userRepo.updateRefreshTokenId(user.id, tokens.refreshTokenId);

  return { user: user.toPublic(), tokens };
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

  await logActivity({
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

  await logActivity({
    actorId: user.id,
    actorEmail: user.email,
    action: "auth.email_verified",
    targetType: "user",
    targetId: user.id,
  });

  return { message: "Email verified — you can now log in" };
}

// ─── Resend verification email ────────────────────────────────────────────────

export async function resendVerification(
  email: string,
  sendVerificationEmail: (email: string, token: string) => Promise<void>
): Promise<{ message: string }> {
  const user = await userRepo.findByEmail(email, {
    withVerificationToken: true,
  });
  const genericMessage = "If that email is registered and unverified, a new link has been sent";

  if (!user) return { message: genericMessage };
  if (user.emailVerified) return { message: genericMessage };

  // A disabled account with no pending legacy verification token is an
  // administrator-disabled account, not an unverified registration. Never
  // issue a token that could be used to undo the administrator's decision.
  if (!user.isActive && !user.emailVerificationToken) {
    return { message: genericMessage };
  }

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
  const user = await userRepo.findByEmail(input.email, {
    withPassword: true,
    withVerificationToken: true,
  });

  // Same public error for wrong email OR wrong password — prevents user enumeration.
  if (!user) {
    await logActivity({
      actorEmail: input.email,
      action: "auth.login_failed",
      targetType: "user",
      metadata: { reason: "invalid_credentials" },
    });
    throw new UnauthorizedError("Invalid email or password");
  }

  const passwordMatch = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordMatch) {
    await logActivity({
      actorId: user.id,
      actorEmail: user.email,
      action: "auth.login_failed",
      targetType: "user",
      targetId: user.id,
      metadata: { reason: "invalid_credentials" },
    });
    throw new UnauthorizedError("Invalid email or password");
  }

  // Only reveal verification state after the password has been proved. This
  // avoids turning the login endpoint into an account-status oracle.
  const { allowed, reason } = user.canLogin();
  if (!allowed) {
    await logActivity({
      actorId: user.id,
      actorEmail: user.email,
      action: "auth.login_failed",
      targetType: "user",
      targetId: user.id,
      metadata: {
        reason:
          user.isActive && !user.emailVerified
            ? "email_not_verified"
            : "account_disabled",
      },
    });

    if (user.isActive && !user.emailVerified) {
      throw new EmailNotVerifiedError();
    }

    throw new UnauthorizedError(reason);
  }

  const result = await issueSession(user);

  logger.info("User logged in", { userId: user.id });

  return result;
}

// ─── Google OAuth login and registration ──────────────────────────────────────

function googleControlsEmail(identity: GoogleIdentity): boolean {
  return identity.email.endsWith("@gmail.com") || Boolean(identity.hostedDomain);
}

export async function loginWithGoogle(
  identity: GoogleIdentity,
): Promise<AuthResult> {
  let user = await userRepo.findByGoogleSubject(identity.subject);
  let isNewUser = false;

  if (!user) {
    const existingUser = await userRepo.findByEmail(identity.email, {
      withGoogleSubject: true,
      withVerificationToken: true,
    });

    if (existingUser) {
      // Never let a provider-linking path override an administrative ban.
      // Legacy unverified accounts must consume their verification token
      // first, which migrates them into the separated account-state model.
      if (!existingUser.isActive) {
        throw new UnauthorizedError("Account disabled");
      }

      if (
        existingUser.googleSubject &&
        existingUser.googleSubject !== identity.subject
      ) {
        throw new ConflictError(
          "This email is already linked to another Google account",
        );
      }

      // Google is authoritative for @gmail.com addresses and for verified
      // Google Workspace domains reported through the hosted-domain claim.
      // Automatic linking is blocked for other domains so a provider account
      // cannot silently take over an existing password account.
      if (!googleControlsEmail(identity)) {
        throw new ConflictError(
          "This email already uses password sign-in",
        );
      }

      if (!existingUser.googleSubject) {
        await userRepo.setGoogleSubject(existingUser.id, identity.subject);
      }
      if (!existingUser.emailVerified) {
        await userRepo.activate(existingUser.id);
      }

      user = await userRepo.findById(existingUser.id, {
        withGoogleSubject: true,
      });
      if (!user) {
        throw new UnauthorizedError("Google sign-in could not be completed");
      }
    } else {
      // Password login remains impossible until the user intentionally sets a
      // password through the existing password-reset flow.
      const unusablePassword = `${randomUUID()}${randomUUID()}Aa1!`;
      const passwordHash = await bcrypt.hash(
        unusablePassword,
        env.BCRYPT_ROUNDS,
      );

      const entity = UserEntity.createGoogle({
        id: randomUUID(),
        name: identity.name,
        email: identity.email,
        passwordHash,
        googleSubject: identity.subject,
      });

      user = await userRepo.create(entity);
      isNewUser = true;

      void logActivity({
        actorId: user.id,
        actorEmail: user.email,
        action: "auth.register",
        targetType: "user",
        targetId: user.id,
        metadata: { provider: "google" },
      });
    }
  }

  const { allowed, reason } = user.canLogin();
  if (!allowed) throw new UnauthorizedError(reason);

  const result = await issueSession(user);

  logger.info(
    isNewUser ? "User registered with Google" : "User logged in with Google",
    { userId: user.id },
  );

  return result;
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
  if (!user.isActive || !user.emailVerified || allRevoked) {
    if (user.refreshTokenId !== null) {
      await userRepo.updateRefreshTokenId(payload.userId, null);
    }
    throw new UnauthorizedError("Session invalidated — please log in again");
  }

  // Fast replay detection: reject a token that is already stale.
  if (user.refreshTokenId !== payload.jti) {
    await userRepo.updateRefreshTokenId(payload.userId, null);
    await revokeAllUserTokens(payload.userId);

    logger.warn("Refresh token reuse detected — all tokens revoked", {
      userId: payload.userId,
    });

    await logActivity({
      actorId: user.id,
      actorEmail: user.email,
      action: "auth.refresh_reuse_detected",
      targetType: "user",
      targetId: user.id,
      metadata: { concurrent: false },
    });

    throw new UnauthorizedError("Session invalidated — please log in again");
  }

  const tokens = signTokenPair({
    userId: user.id,
    email: user.email,
    role: user.role,
    jti: randomUUID(),
  });

  // Compare-and-swap the refresh id. If another request consumed the same
  // refresh token after our read, only one update can succeed.
  const rotated = await userRepo.rotateRefreshTokenId(
    user.id,
    payload.jti,
    tokens.refreshTokenId,
  );

  if (!rotated) {
    await revokeAllUserTokens(payload.userId);

    logger.warn("Concurrent refresh token reuse detected — all tokens revoked", {
      userId: payload.userId,
    });

    await logActivity({
      actorId: user.id,
      actorEmail: user.email,
      action: "auth.refresh_reuse_detected",
      targetType: "user",
      targetId: user.id,
      metadata: { concurrent: true },
    });

    throw new UnauthorizedError("Session invalidated — please log in again");
  }

  logger.info("Tokens rotated", { userId: user.id });

  return tokens;
}

// ─── Get current user ─────────────────────────────────────────────────────────

export async function getMe(userId: string): Promise<ReturnType<UserEntity["toPublic"]>> {
  const user = await userRepo.findById(userId, { withGoogleSubject: true });
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

  await logActivity({
    actorId: user.id,
    actorEmail: user.email,
    action: "auth.password_changed",
    targetType: "user",
    targetId: user.id,
  });
}

// ─── Sign out all sessions ────────────────────────────────────────────────────

export async function logoutAll(userId: string): Promise<void> {
  const user = await userRepo.findById(userId);
  if (!user) throw new NotFoundError("User");

  await Promise.all([
    userRepo.updateRefreshTokenId(userId, null),
    revokeAllUserTokens(userId),
  ]);

  logger.info("All user sessions revoked", { userId });

  await logActivity({
    actorId: user.id,
    actorEmail: user.email,
    action: "auth.sessions_revoked",
    targetType: "user",
    targetId: user.id,
  });
}

// ─── Forgot password — request reset link ────────────────────────────────────

export async function forgotPassword(
  email: string,
  sendResetEmail: (email: string, token: string) => Promise<void>
): Promise<{ message: string }> {
  const genericMessage = "If that email is registered, a password reset link has been sent";

  const user = await userRepo.findByEmail(email);
  if (!user) return { message: genericMessage };
  if (!user.isActive || !user.emailVerified) {
    return { message: genericMessage };
  }

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

  await logActivity({
    actorId: user.id,
    actorEmail: user.email,
    action: "auth.password_reset",
    targetType: "user",
    targetId: user.id,
  });

  return {
    message: "Password reset successful — please log in with your new password",
  };
}
