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

import { UserEntity } from "@/server/entities/user.entity";
import * as userRepo from "@/server/repositories/user.repo";
import { loginWithGoogle } from "@/server/services/auth.service";
import {
  clearUserRevocation,
  signTokenPair,
} from "@/server/utils/jwt";

const googleIdentity = {
  subject: "google-subject-1",
  email: "ada@gmail.com",
  name: "Ada Student",
  emailVerified: true as const,
  hostedDomain: null,
};

function persistedUser(input: {
  active: boolean;
  googleSubject?: string | null;
}): UserEntity {
  const now = new Date("2026-08-23T00:00:00.000Z");
  return UserEntity.fromPersistence({
    id: "user-1",
    name: "Ada Student",
    email: "ada@gmail.com",
    passwordHash: "password-hash",
    googleSubject: input.googleSubject ?? null,
    role: "user",
    isActive: input.active,
    emailVerificationToken: input.active ? null : "verification-token",
    emailVerificationExpires: input.active ? null : now,
    passwordResetToken: null,
    passwordResetExpires: null,
    refreshTokenId: null,
    createdAt: now,
    updatedAt: now,
  });
}

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(signTokenPair).mockReturnValue({
    accessToken: "access-token",
    refreshToken: "refresh-token",
    refreshTokenId: "refresh-id",
  });
  jest.mocked(clearUserRevocation).mockResolvedValue(undefined);
  jest.mocked(userRepo.updateRefreshTokenId).mockResolvedValue(undefined);
  (bcrypt.hash as jest.Mock).mockResolvedValue("google-password-hash");
});

describe("loginWithGoogle", () => {
  it("creates an active student for a new Google account", async () => {
    jest.mocked(userRepo.findByGoogleSubject).mockResolvedValue(null);
    jest.mocked(userRepo.findByEmail).mockResolvedValue(null);
    jest.mocked(userRepo.create).mockImplementation(async (user) => user);

    const result = await loginWithGoogle(googleIdentity);

    expect(result.user).toMatchObject({
      email: "ada@gmail.com",
      role: "user",
      isActive: true,
    });
    expect(userRepo.create).toHaveBeenCalledTimes(1);
    expect(userRepo.updateRefreshTokenId).toHaveBeenCalledWith(
      result.user.id,
      "refresh-id",
    );
  });

  it("links and activates a matching verified Gmail account", async () => {
    const inactiveUser = persistedUser({ active: false });
    const activeUser = persistedUser({
      active: true,
      googleSubject: googleIdentity.subject,
    });

    jest.mocked(userRepo.findByGoogleSubject).mockResolvedValue(null);
    jest.mocked(userRepo.findByEmail).mockResolvedValue(inactiveUser);
    jest.mocked(userRepo.findById).mockResolvedValue(activeUser);
    jest.mocked(userRepo.setGoogleSubject).mockResolvedValue(undefined);
    jest.mocked(userRepo.activate).mockResolvedValue(undefined);

    await loginWithGoogle(googleIdentity);

    expect(userRepo.setGoogleSubject).toHaveBeenCalledWith(
      inactiveUser.id,
      googleIdentity.subject,
    );
    expect(userRepo.activate).toHaveBeenCalledWith(inactiveUser.id);
    expect(userRepo.create).not.toHaveBeenCalled();
  });

  it("does not automatically link a password account on another domain", async () => {
    jest.mocked(userRepo.findByGoogleSubject).mockResolvedValue(null);
    jest.mocked(userRepo.findByEmail).mockResolvedValue(
      persistedUser({ active: true }),
    );

    await expect(
      loginWithGoogle({
        ...googleIdentity,
        email: "ada@example.com",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    expect(userRepo.setGoogleSubject).not.toHaveBeenCalled();
    expect(userRepo.create).not.toHaveBeenCalled();
  });
});
