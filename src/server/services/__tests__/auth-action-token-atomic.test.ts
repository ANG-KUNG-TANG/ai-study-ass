import bcrypt from "bcryptjs";
import {
  UserEntity,
  type UserProps,
} from "@/server/entities/user.entity";
import * as userRepo from "@/server/repositories/user.repo";
import { revokeAllUserTokens } from "@/server/utils/jwt";
import {
  resetPassword,
  verifyEmail,
} from "@/server/services/auth.service";
import { hashActionToken } from "@/server/utils/action-token";

jest.mock("@/server/repositories/user.repo", () => ({
  consumeVerificationToken: jest.fn(),
  consumePasswordResetToken: jest.fn(),
}));

jest.mock("@/server/services/auditLog.service", () => ({
  logActivity: jest.fn(),
}));

jest.mock("@/server/utils/jwt", () => {
  const actual = jest.requireActual("@/server/utils/jwt");
  return {
    ...actual,
    revokeAllUserTokens: jest.fn(),
  };
});

const mockConsumeVerification =
  userRepo.consumeVerificationToken as jest.MockedFunction<
    typeof userRepo.consumeVerificationToken
  >;
const mockConsumePasswordReset =
  userRepo.consumePasswordResetToken as jest.MockedFunction<
    typeof userRepo.consumePasswordResetToken
  >;
const mockRevokeAll =
  revokeAllUserTokens as jest.MockedFunction<
    typeof revokeAllUserTokens
  >;

function user(
  overrides: Partial<UserProps> = {},
): UserEntity {
  const now = new Date();

  return UserEntity.fromPersistence({
    id: "user-1",
    name: "Test User",
    email: "user@example.com",
    passwordHash: "stored-password-hash",
    role: "user",
    isActive: true,
    emailVerificationToken: null,
    emailVerificationExpires: null,
    passwordResetToken: null,
    passwordResetExpires: null,
    refreshTokenId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

describe("atomic account action tokens", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRevokeAll.mockResolvedValue(undefined);
  });

  it("verifies email through one atomic consume call", async () => {
    mockConsumeVerification.mockResolvedValue(user());

    await expect(
      verifyEmail("raw-verification-token"),
    ).resolves.toEqual({
      message: "Email verified — you can now log in",
    });

    expect(mockConsumeVerification).toHaveBeenCalledWith(
      hashActionToken("raw-verification-token"),
      expect.any(Date),
    );
  });

  it("rejects a verification token when atomic consume fails", async () => {
    mockConsumeVerification.mockResolvedValue(null);

    await expect(
      verifyEmail("already-consumed-token"),
    ).rejects.toThrow("Invalid or expired verification token");
  });

  it("resets password only when atomic consume succeeds", async () => {
    mockConsumePasswordReset.mockResolvedValue(user());

    await expect(
      resetPassword("raw-reset-token", "StrongPassword1!"),
    ).resolves.toEqual({
      message: "Password reset successful — please log in with your new password",
    });

    expect(mockConsumePasswordReset).toHaveBeenCalledWith(
      hashActionToken("raw-reset-token"),
      expect.any(String),
      expect.any(Date),
    );
    expect(mockRevokeAll).toHaveBeenCalledWith("user-1");
  });

  it("does not revoke sessions when reset-token consume fails", async () => {
    mockConsumePasswordReset.mockResolvedValue(null);

    await expect(
      resetPassword("already-consumed-token", "StrongPassword1!"),
    ).rejects.toThrow("Invalid or expired reset token");

    expect(mockRevokeAll).not.toHaveBeenCalled();
  });

  it("passes a bcrypt hash to the atomic reset update", async () => {
    mockConsumePasswordReset.mockResolvedValue(user());

    await resetPassword("raw-reset-token", "StrongPassword1!");

    const passwordHash = mockConsumePasswordReset.mock.calls[0]?.[1];
    expect(passwordHash).toBeDefined();

    await expect(
      bcrypt.compare("StrongPassword1!", passwordHash as string),
    ).resolves.toBe(true);
  });
});
