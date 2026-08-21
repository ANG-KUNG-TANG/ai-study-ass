import mongoose from "mongoose";
import { connectDb } from "@/server/config/database";
import {
  UserEntity,
  type UserProps,
} from "@/server/entities/user.entity";
import * as userRepo from "@/server/repositories/user.repo";
import {
  areAllUserTokensRevoked,
  verifyRefreshToken,
} from "@/server/utils/jwt";
import { verifyBrowserSession } from "@/server/services/browser-session.service";

jest.mock("@/server/config/database", () => ({
  connectDb: jest.fn(),
}));

jest.mock("@/server/repositories/user.repo", () => ({
  findById: jest.fn(),
}));

jest.mock("@/server/utils/jwt", () => ({
  areAllUserTokensRevoked: jest.fn(),
  verifyRefreshToken: jest.fn(),
}));

const mockConnectDb = connectDb as jest.MockedFunction<typeof connectDb>;
const mockFindById = userRepo.findById as jest.MockedFunction<
  typeof userRepo.findById
>;
const mockAreAllRevoked =
  areAllUserTokensRevoked as jest.MockedFunction<
    typeof areAllUserTokensRevoked
  >;
const mockVerifyRefresh =
  verifyRefreshToken as jest.MockedFunction<
    typeof verifyRefreshToken
  >;

function activeUser(
  overrides: Partial<UserProps> = {},
): UserEntity {
  const now = new Date();

  return UserEntity.fromPersistence({
    id: "user-1",
    name: "Test User",
    email: "user@example.com",
    passwordHash: "test-password-hash",
    role: "user",
    isActive: true,
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

describe("verifyBrowserSession", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnectDb.mockResolvedValue(mongoose);
    mockVerifyRefresh.mockReturnValue({
      userId: "user-1",
      email: "old@example.com",
      role: "admin",
      jti: "refresh-current",
    });
    mockFindById.mockResolvedValue(activeUser());
    mockAreAllRevoked.mockResolvedValue(false);
  });

  it("returns null without a refresh token and avoids database work", async () => {
    await expect(verifyBrowserSession(undefined)).resolves.toBeNull();
    expect(mockVerifyRefresh).not.toHaveBeenCalled();
    expect(mockConnectDb).not.toHaveBeenCalled();
  });

  it("returns current database identity and role, not stale JWT claims", async () => {
    await expect(
      verifyBrowserSession("signed-refresh-token"),
    ).resolves.toEqual({
      userId: "user-1",
      email: "user@example.com",
      role: "user",
    });

    expect(mockFindById).toHaveBeenCalledWith("user-1", {
      withRefreshTokenId: true,
    });
  });

  it("rejects a rotated or logged-out refresh token", async () => {
    mockFindById.mockResolvedValue(
      activeUser({ refreshTokenId: "new-refresh-id" }),
    );

    await expect(
      verifyBrowserSession("stale-refresh-token"),
    ).resolves.toBeNull();
  });

  it("rejects all-user revocation", async () => {
    mockAreAllRevoked.mockResolvedValue(true);

    await expect(
      verifyBrowserSession("revoked-refresh-token"),
    ).resolves.toBeNull();
  });

  it("rejects inactive or deleted users", async () => {
    mockFindById.mockResolvedValue(activeUser({ isActive: false }));

    await expect(
      verifyBrowserSession("banned-refresh-token"),
    ).resolves.toBeNull();

    mockFindById.mockResolvedValue(null);

    await expect(
      verifyBrowserSession("deleted-user-token"),
    ).resolves.toBeNull();
  });

  it("rejects invalid or expired refresh JWTs", async () => {
    mockVerifyRefresh.mockImplementation(() => {
      throw new Error("invalid token");
    });

    await expect(
      verifyBrowserSession("invalid-refresh-token"),
    ).resolves.toBeNull();

    expect(mockConnectDb).not.toHaveBeenCalled();
  });
});
