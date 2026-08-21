import {
  UserEntity,
  type UserProps,
} from "@/server/entities/user.entity";
import * as userRepo from "@/server/repositories/user.repo";
import {
  areAllUserTokensRevoked,
  signTokenPair,
  verifyRefreshToken,
} from "@/server/utils/jwt";
import { refreshTokens } from "@/server/services/auth.service";

jest.mock("@/server/repositories/user.repo", () => ({
  findById: jest.fn(),
  updateRefreshTokenId: jest.fn(),
}));

jest.mock("@/server/utils/jwt", () => ({
  areAllUserTokensRevoked: jest.fn(),
  clearUserRevocation: jest.fn(),
  revokeAllUserTokens: jest.fn(),
  revokeToken: jest.fn(),
  signTokenPair: jest.fn(),
  verifyRefreshToken: jest.fn(),
}));

jest.mock("@/server/services/auditLog.service", () => ({
  logActivity: jest.fn(),
}));

const mockFindById = userRepo.findById as jest.MockedFunction<
  typeof userRepo.findById
>;
const mockUpdateRefreshTokenId =
  userRepo.updateRefreshTokenId as jest.MockedFunction<
    typeof userRepo.updateRefreshTokenId
  >;
const mockAreAllRevoked =
  areAllUserTokensRevoked as jest.MockedFunction<
    typeof areAllUserTokensRevoked
  >;
const mockVerifyRefresh =
  verifyRefreshToken as jest.MockedFunction<
    typeof verifyRefreshToken
  >;
const mockSignTokenPair =
  signTokenPair as jest.MockedFunction<
    typeof signTokenPair
  >;

function user(
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

describe("refreshTokens security checks", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockVerifyRefresh.mockReturnValue({
      userId: "user-1",
      email: "old@example.com",
      role: "admin",
      jti: "refresh-current",
    });

    mockFindById.mockResolvedValue(user());
    mockAreAllRevoked.mockResolvedValue(false);

    mockSignTokenPair.mockReturnValue({
      accessToken: "new-access",
      refreshToken: "new-refresh",
      refreshTokenId: "refresh-new",
    });

    mockUpdateRefreshTokenId.mockResolvedValue(undefined);
  });

  it("rejects an explicit all-session revocation before issuing tokens", async () => {
    mockAreAllRevoked.mockResolvedValue(true);

    await expect(
      refreshTokens("signed-refresh"),
    ).rejects.toThrow("Session invalidated");

    expect(mockSignTokenPair).not.toHaveBeenCalled();
    expect(mockUpdateRefreshTokenId).toHaveBeenCalledWith(
      "user-1",
      null,
    );
  });

  it("rejects an inactive account before issuing tokens", async () => {
    mockFindById.mockResolvedValue(
      user({ isActive: false }),
    );

    await expect(
      refreshTokens("signed-refresh"),
    ).rejects.toThrow("Session invalidated");

    expect(mockSignTokenPair).not.toHaveBeenCalled();
    expect(mockUpdateRefreshTokenId).toHaveBeenCalledWith(
      "user-1",
      null,
    );
  });

  it("rotates a valid current refresh token", async () => {
    await expect(
      refreshTokens("signed-refresh"),
    ).resolves.toEqual({
      accessToken: "new-access",
      refreshToken: "new-refresh",
      refreshTokenId: "refresh-new",
    });

    expect(mockSignTokenPair).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        email: "user@example.com",
        role: "user",
      }),
    );
    expect(mockUpdateRefreshTokenId).toHaveBeenCalledWith(
      "user-1",
      "refresh-new",
    );
  });
});
