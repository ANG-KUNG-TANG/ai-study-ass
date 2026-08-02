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
import mongoose from "mongoose";
import {
  AI_CONFIG,
  type AIProvider,
} from "@/server/config/ai_config";
import {
  getAIUsageEvents,
} from "@/server/services/ai.service";

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

// ─── AI usage ─────────────────────────────────────────────────────────────────

export type AdminAIProviderStatus =
  | "operational"
  | "configured"
  | "not_configured";

export interface AdminAIProviderUsage {
  provider: AIProvider;
  status: AdminAIProviderStatus;
  requestsToday: number;
  tokensToday: number;
  averageLatencyMs: number;
  spendToday: number;
  failuresToday: number;
}

export interface AdminAIUsage {
  providers: AdminAIProviderUsage[];
  monthlySpend: number;
  requestsLastSevenDays: Array<{
    label: string;
    value: number;
  }>;
  requestsByRoute: Array<{
    route: string;
    count: number;
  }>;
  warning: string;
}

function providerConfigured(
  provider: AIProvider,
): boolean {
  return provider === "openai"
    ? Boolean(
        AI_CONFIG.openai.apiKey.trim(),
      )
    : Boolean(
        AI_CONFIG.gemini.apiKey.trim(),
      );
}

function providerStatus(
  provider: AIProvider,
): AdminAIProviderStatus {
  if (
    !providerConfigured(
      provider,
    )
  ) {
    return "not_configured";
  }

  return provider ===
    AI_CONFIG.activeProvider
    ? "operational"
    : "configured";
}

function beginningOfDay(
  date: Date,
): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
}

function averageNumber(
  values: number[],
): number {
  if (
    values.length === 0
  ) {
    return 0;
  }

  return Math.round(
    values.reduce(
      (sum, value) =>
        sum + value,
      0,
    ) /
      values.length,
  );
}

export async function getAIUsage():
  Promise<AdminAIUsage> {
  const now = new Date();
  const today =
    beginningOfDay(now);

  const events =
    getAIUsageEvents();

  const providers:
    AIProvider[] = [
      "openai",
      "gemini",
    ];

  const providerUsage =
    providers.map(
      (
        provider,
      ): AdminAIProviderUsage => {
        const todayEvents =
          events.filter(
            (event) =>
              event.provider ===
                provider &&
              event.createdAt >=
                today,
          );

        return {
          provider,

          status:
            providerStatus(
              provider,
            ),

          requestsToday:
            todayEvents.length,

          tokensToday:
            todayEvents.reduce(
              (sum, event) =>
                sum +
                event.tokensUsed,
              0,
            ),

          averageLatencyMs:
            averageNumber(
              todayEvents.map(
                (event) =>
                  event.latencyMs,
              ),
            ),

          spendToday:
            0,

          failuresToday:
            todayEvents.filter(
              (event) =>
                !event.success,
            ).length,
        };
      },
    );

  const weekday =
    new Intl.DateTimeFormat(
      "en",
      {
        weekday: "short",
      },
    );

  const requestsLastSevenDays =
    Array.from(
      {
        length: 7,
      },
      (_, index) => {
        const day =
          new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() -
              (6 - index),
          );

        const nextDay =
          new Date(
            day.getFullYear(),
            day.getMonth(),
            day.getDate() + 1,
          );

        return {
          label:
            weekday.format(day),

          value:
            events.filter(
              (event) =>
                event.createdAt >=
                  day &&
                event.createdAt <
                  nextDay,
            ).length,
        };
      },
    );

  const routeCounts =
    new Map<string, number>();

  for (
    const event of events
  ) {
    routeCounts.set(
      event.usageLabel,
      (
        routeCounts.get(
          event.usageLabel,
        ) ??
        0
      ) + 1,
    );
  }

  return {
    providers:
      providerUsage,

    monthlySpend:
      0,

    requestsLastSevenDays,

    requestsByRoute:
      Array.from(
        routeCounts.entries(),
      )
        .map(
          ([
            route,
            count,
          ]) => ({
            route,
            count,
          }),
        )
        .sort(
          (left, right) =>
            right.count -
            left.count,
        ),

    warning:
      "Usage telemetry is stored in memory and resets when the server restarts. " +
      "Spend remains $0 until durable input/output token accounting and pricing are added.",
  };
}

// ─── Detailed admin health ────────────────────────────────────────────────────

export interface AdminHealthCheck {
  status:
    | "healthy"
    | "degraded"
    | "unhealthy";

  timestamp: string;
  uptime: number;
  version: string;

  database: {
    connected: boolean;
    state: string;
    latencyMs: number | null;
  };

  ai: {
    reachable: boolean;
    configured: boolean;
    provider: AIProvider;
    model: string;
    checkMode: "configuration";
  };

  memory: {
    used: number;
    total: number;
    rss: number;
  };
}

const MONGOOSE_STATES:
  Record<number, string> = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

async function databaseHealth():
  Promise<
    AdminHealthCheck[
      "database"
    ]
  > {
  const state =
    mongoose.connection.readyState;

  if (
    state !== 1 ||
    !mongoose.connection.db
  ) {
    return {
      connected:
        false,
      state:
        MONGOOSE_STATES[state] ??
        "unknown",
      latencyMs:
        null,
    };
  }

  const startedAt =
    Date.now();

  try {
    await mongoose.connection.db
      .admin()
      .ping();

    return {
      connected:
        true,
      state:
        "connected",
      latencyMs:
        Date.now() -
        startedAt,
    };
  } catch (error) {
    logger.warn(
      "Admin health database ping failed",
      {
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
    );

    return {
      connected:
        false,
      state:
        "error",
      latencyMs:
        Date.now() -
        startedAt,
    };
  }
}

export async function getSystemHealth():
  Promise<AdminHealthCheck> {
  const database =
    await databaseHealth();

  const provider =
    AI_CONFIG.activeProvider;

  const configured =
    providerConfigured(
      provider,
    );

  const memory =
    process.memoryUsage();

  return {
    status:
      database.connected &&
      configured
        ? "healthy"
        : database.connected
          ? "degraded"
          : "unhealthy",

    timestamp:
      new Date().toISOString(),

    uptime:
      process.uptime(),

    version:
      process.env
        .npm_package_version ??
      "unknown",

    database,

    ai: {
      reachable:
        configured,
      configured,
      provider,

      model:
        provider === "openai"
          ? AI_CONFIG.openai.model
          : AI_CONFIG.gemini.model,

      // This does not consume provider quota. It verifies configuration only.
      checkMode:
        "configuration",
    },

    memory: {
      used:
        memory.heapUsed,
      total:
        memory.heapTotal,
      rss:
        memory.rss,
    },
  };
}

