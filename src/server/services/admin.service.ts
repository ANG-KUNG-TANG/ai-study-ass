import * as userRepo from "@/server/repositories/user.repo";
import { UserEntity, type UserRole } from "@/server/entities/user.entity";
import { revokeAllUserTokens } from "@/server/utils/jwt";
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} from "@/server/utils/errors";
import { logger } from "@/server/utils/logger";
import type { UserQueryOptions, PaginatedUsers } from "@/server/repositories/user.repo";

// ─── Purpose ──────────────────────────────────────────────────────────────────
// Admin-only operations. Every function here must be called from routes
// protected by withAuth + withRole("admin") middleware.
// This layer never exposes passwordHash, refreshTokenId, or verification tokens.

// ─── List users ───────────────────────────────────────────────────────────────

export async function listUsers(
  options: UserQueryOptions
): Promise<{ data: ReturnType<UserEntity["toPublic"]>[]; total: number; page: number; limit: number }> {
  const result: PaginatedUsers = await userRepo.findMany(options);

  return {
    data: result.data.map((u) => u.toPublic()),
    total: result.total,
    page: result.page,
    limit: result.limit,
  };
}

// ─── Get single user ──────────────────────────────────────────────────────────

export async function getUserById(
  userId: string
): Promise<ReturnType<UserEntity["toPublic"]>> {
  const user = await userRepo.findById(userId);
  if (!user) throw new NotFoundError("User");
  return user.toPublic();
}

// ─── Update role ──────────────────────────────────────────────────────────────

export async function updateUserRole(
  adminId: string,
  targetUserId: string,
  role: UserRole
): Promise<void> {
  // Admin cannot demote themselves — would lock them out
  if (adminId === targetUserId) {
    throw new ForbiddenError("You cannot change your own role");
  }

  const user = await userRepo.findById(targetUserId);
  if (!user) throw new NotFoundError("User");

  await userRepo.updateRole(targetUserId, role);

  logger.info("Admin updated user role", { adminId, targetUserId, role });
}

// ─── Ban / unban user ─────────────────────────────────────────────────────────

export async function banUser(
  adminId: string,
  targetUserId: string
): Promise<void> {
  if (adminId === targetUserId) {
    throw new ForbiddenError("You cannot ban yourself");
  }

  const user = await userRepo.findById(targetUserId);
  if (!user) throw new NotFoundError("User");
  if (!user.isActive) throw new BadRequestError("User is already banned");

  // Deactivate account + immediately revoke all tokens
  await userRepo.setActive(targetUserId, false);
  await revokeAllUserTokens(targetUserId);

  logger.info("Admin banned user", { adminId, targetUserId });
}

export async function unbanUser(
  adminId: string,
  targetUserId: string
): Promise<void> {
  const user = await userRepo.findById(targetUserId);
  if (!user) throw new NotFoundError("User");
  if (user.isActive) throw new BadRequestError("User is not banned");

  await userRepo.setActive(targetUserId, true);

  logger.info("Admin unbanned user", { adminId, targetUserId });
}

// ─── Delete user ──────────────────────────────────────────────────────────────

export async function deleteUser(
  adminId: string,
  targetUserId: string
): Promise<void> {
  if (adminId === targetUserId) {
    throw new ForbiddenError("You cannot delete your own account via admin panel");
  }

  const user = await userRepo.findById(targetUserId);
  if (!user) throw new NotFoundError("User");

  // Revoke all tokens before deleting
  await revokeAllUserTokens(targetUserId);
  await userRepo.deleteById(targetUserId);

  logger.info("Admin deleted user", { adminId, targetUserId });
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function getUserStats(): Promise<{
  total: number;
  active: number;
  inactive: number;
  admins: number;
}> {
  const [total, active, admins] = await Promise.all([
    userRepo.count(),
    userRepo.count({ isActive: true }),
    userRepo.count({ role: "admin" }),
  ]);

  return {
    total,
    active,
    inactive: total - active,
    admins,
  };
}