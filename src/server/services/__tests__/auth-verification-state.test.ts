jest.mock("bcryptjs", () => ({
  __esModule: true,
  default: {
    compare: jest.fn(),
    hash: jest.fn(),
  },
}));
jest.mock("@/server/config/env", () => ({
  env: { BCRYPT_ROUNDS: 4 },
}));
jest.mock("@/server/repositories/user.repo");
jest.mock("@/server/services/auditLog.service", () => ({
  logActivity: jest.fn(),
}));
jest.mock("@/server/utils/jwt", () => ({
  areAllUserTokensRevoked: jest.fn(),
  clearUserRevocation: jest.fn(),
  revokeAllUserTokens: jest.fn(),
  revokeToken: jest.fn(),
  signTokenPair: jest.fn(),
  verifyRefreshToken: jest.fn(),
}));
jest.mock("@/server/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

import bcrypt from "bcryptjs";

import {
  UserEntity,
  type UserProps,
} from "@/server/entities/user.entity";
import * as userRepo from "@/server/repositories/user.repo";
import {
  login,
  logoutAll,
  register,
  resendVerification,
} from "@/server/services/auth.service";
import { revokeAllUserTokens } from "@/server/utils/jwt";

function user(overrides: Partial<UserProps> = {}): UserEntity {
  const now = new Date("2026-08-24T00:00:00.000Z");

  return UserEntity.fromPersistence({
    id: "user-1",
    name: "Ada Student",
    email: "ada@example.com",
    passwordHash: "stored-hash",
    googleSubject: null,
    passwordConfigured: true,
    role: "user",
    isActive: true,
    emailVerified: true,
    emailVerificationToken: null,
    emailVerificationExpires: null,
    passwordResetToken: null,
    passwordResetExpires: null,
    refreshTokenId: "refresh-current",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

describe("email verification and account state", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(bcrypt.hash).mockResolvedValue("new-password-hash" as never);
    jest.mocked(bcrypt.compare).mockResolvedValue(true as never);
  });

  it("registers an enabled account that still requires email verification", async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    jest.mocked(userRepo.existsByEmail).mockResolvedValue(false);
    jest.mocked(userRepo.create).mockImplementation(async (entity) => entity);

    await register(
      {
        name: "Ada Student",
        email: "ada@example.com",
        password: "StrongPassword1!",
      },
      send,
    );

    const created = jest.mocked(userRepo.create).mock.calls[0]?.[0];
    expect(created?.toPublic()).toMatchObject({
      isActive: true,
      emailVerified: false,
      passwordConfigured: true,
    });
    expect(send).toHaveBeenCalledWith("ada@example.com", expect.any(String));
  });

  it("does not reveal verification state until the password is correct", async () => {
    jest.mocked(userRepo.findByEmail).mockResolvedValue(
      user({ emailVerified: false }),
    );
    jest.mocked(bcrypt.compare).mockResolvedValue(false as never);

    await expect(
      login({ email: "ada@example.com", password: "wrong" }),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "Invalid email or password",
    });
  });

  it("returns a dedicated error after an unverified user proves the password", async () => {
    jest.mocked(userRepo.findByEmail).mockResolvedValue(
      user({ emailVerified: false }),
    );

    await expect(
      login({ email: "ada@example.com", password: "correct" }),
    ).rejects.toMatchObject({
      code: "EMAIL_NOT_VERIFIED",
    });
  });

  it("never sends a verification token that could reactivate a banned account", async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    jest.mocked(userRepo.findByEmail).mockResolvedValue(
      user({
        isActive: false,
        emailVerified: true,
        emailVerificationToken: null,
      }),
    );

    await resendVerification("ada@example.com", send);

    expect(userRepo.updateVerificationToken).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("resends verification for an enabled pending registration", async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    jest.mocked(userRepo.findByEmail).mockResolvedValue(
      user({
        emailVerified: false,
        emailVerificationToken: "old-token-hash",
      }),
    );
    jest.mocked(userRepo.updateVerificationToken).mockResolvedValue(undefined);

    await resendVerification("ada@example.com", send);

    expect(userRepo.updateVerificationToken).toHaveBeenCalledWith(
      "user-1",
      expect.any(String),
      expect.any(Date),
    );
    expect(send).toHaveBeenCalledWith("ada@example.com", expect.any(String));
  });

  it("revokes refresh and access credentials when signing out all devices", async () => {
    jest.mocked(userRepo.findById).mockResolvedValue(user());
    jest.mocked(userRepo.updateRefreshTokenId).mockResolvedValue(undefined);
    jest.mocked(revokeAllUserTokens).mockResolvedValue(undefined);

    await logoutAll("user-1");

    expect(userRepo.updateRefreshTokenId).toHaveBeenCalledWith("user-1", null);
    expect(revokeAllUserTokens).toHaveBeenCalledWith("user-1");
  });
});
