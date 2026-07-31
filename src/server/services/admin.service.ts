import * as userRepo from "@/server/repositories/user.repo";
import * as noteRepo from "@/server/repositories/note.repo";
import * as quizRepo from "@/server/repositories/quiz.repo";
import { UserEntity, type UserRole } from "@/server/entities/user.entity";
import { revokeAllUserTokens } from "@/server/utils/jwt";
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} from "@/server/utils/errors";
import { logger } from "@/server/utils/logger";
import type { UserQueryOptions, PaginatedUsers } from "@/server/repositories/user.repo";
import { buildPaginationMeta, PaginationMeta } from "../utils/response";
import * as knowledgeRepo from '@/server/repositories/knowldege.repo'
import type { NoteQueryOptions} from "@/server/repositories/note.repo";

// ─── Purpose ──────────────────────────────────────────────────────────────────
// Admin-only operations. Every function here must be called from routes
// protected by withAuth + withRole("admin") middleware.
// This layer never exposes passwordHash, refreshTokenId, or verification tokens.

//INterface
export interface AdminNoteView {
  id: string;
  title: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  ownerEmail: string;
  status: "Indexed" | "Processing" | "Unknown";
  createdAt: Date;
}

// ─── List users ───────────────────────────────────────────────────────────────

export async function listUsers(
  options: UserQueryOptions
): Promise<{
  data: ReturnType<UserEntity["toPublic"]>[];
  meta: PaginationMeta;
}> {
  const result: PaginatedUsers = await userRepo.findMany(options);

  return {
    data: result.data.map((u) => u.toPublic()),
    meta: buildPaginationMeta(result.total, result.page, result.limit),
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

export async function listContent(
  options: NoteQueryOptions
): Promise<{ data: AdminNoteView[]; meta: PaginationMeta }> {
  const result = await noteRepo.findManyAdmin(options);

  const userIds = [...new Set(result.data.map((n) => n.userId))];
  const noteIds = result.data.map((n) => n.id);

  const [owners, stages] = await Promise.all([
    userRepo.findManyByIds(userIds),
    knowledgeRepo.findStagesByNoteIds(noteIds),
  ]);
  const ownerMap = new Map(owners.map((u) => [u.id, u.toPublic().email]));

  const data: AdminNoteView[] = result.data.map((note) => {
    const stage = stages.get(note.id);
    const status: AdminNoteView["status"] =
      stage === "complete" ? "Indexed" : stage ? "Processing" : "Unknown";
    return {
      id: note.id,
      title: note.title,
      fileName: note.fileName,
      fileType: note.fileType,
      fileSize: note.fileSize,
      ownerEmail: ownerMap.get(note.userId) ?? "Unknown",
      status,
      createdAt: note.createdAt,
    };
  });

  return { data, meta: buildPaginationMeta(result.total, result.page, result.limit) };
}

// ─── Update role ──────────────────────────────────────────────────────────────

export async function updateUserRole(
  adminId: string,
  targetUserId: string,
  role: UserRole
): Promise<void> {
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
// Hard delete — permanently removes the user record. Intentionally does NOT
// cascade to notes/quizzes/flashcards/chats (per product decision: user's
// content is retained after the account is removed).
//
// No self-delete or admin-target restriction — any admin may delete any
// user, including themselves or another admin. If you need to reintroduce
// a safety rail later (e.g. "must have at least one admin left"), add the
// check here.

export async function deleteUser(
  adminId: string,
  targetUserId: string
): Promise<void> {
  const user = await userRepo.findById(targetUserId);
  if (!user) throw new NotFoundError("User");

  await revokeAllUserTokens(targetUserId);
  await userRepo.deleteById(targetUserId);

  logger.info("Admin deleted user", { adminId, targetUserId });
}

// ─── User stats ───────────────────────────────────────────────────────────────

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

// ─── Overview stats ────────────────────────────────────────────────────────────
// Platform-wide counts for the admin dashboard landing page. Deliberately
// unfiltered (not scoped to any user) — mirrors getUserStats()'s use of
// userRepo.count() with no filter for the "total" figure.
//
// NOT included here: AI spend, requests-by-day chart, activity feed. Those
// need either a request/event log or cost-per-token tracking that doesn't
// exist in the schema yet — they stay as frontend mock data until that
// instrumentation is built.

export async function getOverviewStats(): Promise<{
  totalUsers: number;
  totalNotes: number;
  totalQuizzes: number;
}> {
  const [totalUsers, totalNotes, totalQuizzes] = await Promise.all([
    userRepo.count(),
    noteRepo.count(),
    quizRepo.count(),
  ]);

  return { totalUsers, totalNotes, totalQuizzes };
}