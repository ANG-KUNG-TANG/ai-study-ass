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
import type {
  UserQueryOptions,
  PaginatedUsers,
} from "@/server/repositories/user.repo";
import { buildPaginationMeta, PaginationMeta } from "../utils/response";
import * as flashcardService from "@/server/services/flashcard.service";
import * as chatService from "@/server/services/chat/chat.service";
import * as intelligenceService from "@/server/services/intelligence.service";
import * as generationService from "@/server/services/study-material-generation.service";
import * as intelligenceRepo from "@/server/repositories/intelligence.repo";
import * as flashcardRepo from "@/server/repositories/flashcard.repo";
import type { NoteQueryOptions } from "@/server/repositories/note.repo";
import mongoose from "mongoose";
import {
  getInfrastructureHealth,
  type QueueHealthSnapshot,
  type RedisHealthSnapshot,
  type WorkerHealthSnapshot,
} from "@/server/services/system-health.service";
import {
  getTelegramHealth,
  type TelegramHealthSnapshot,
} from "@/server/services/telegram-health.service";
import { AI_CONFIG, type AIProvider } from "@/server/config/ai_config";
import { getUsageSince } from "@/server/services/ai-usage.service";
import { generate } from "@/server/services/ai.service";
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

export async function listUsers(options: UserQueryOptions): Promise<{
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
  userId: string,
): Promise<ReturnType<UserEntity["toPublic"]>> {
  const user = await userRepo.findById(userId);
  if (!user) throw new NotFoundError("User");
  return user.toPublic();
}

export async function listContent(
  options: NoteQueryOptions,
): Promise<{ data: AdminNoteView[]; meta: PaginationMeta }> {
  const result = await noteRepo.findManyAdmin(options);

  const userIds = [...new Set(result.data.map((n) => n.userId))];
  const noteIds = result.data.map((n) => n.id);

  const [owners, stages] = await Promise.all([
    userRepo.findManyByIds(userIds),
    intelligenceRepo.findStagesByNoteIds(noteIds),
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

  return {
    data,
    meta: buildPaginationMeta(result.total, result.page, result.limit),
  };
}

// ─── Delete content ───────────────────────────────────────────────────────────

export async function deleteContent(
  adminId: string,
  noteId: string,
): Promise<{ title: string; ownerId: string }> {
  const note = await noteRepo.findByIdOrThrow(noteId);

  await Promise.all([
    noteRepo.deleteById(noteId),
    quizRepo.deleteByNoteId(noteId),
    flashcardService.deleteForNote(noteId),
    chatService.deleteForNote(noteId),
    intelligenceService.deleteForNote(noteId),
    generationService.deleteForNote(noteId),
  ]);

  logger.info("Admin deleted note content", {
    adminId,
    noteId,
    ownerId: note.userId,
  });

  return {
    title: note.title,
    ownerId: note.userId,
  };
}

// ─── Update role ──────────────────────────────────────────────────────────────

export async function updateUserRole(
  adminId: string,
  targetUserId: string,
  role: UserRole,
): Promise<void> {
  if (adminId === targetUserId) {
    throw new ForbiddenError("You cannot change your own role");
  }

  const user = await userRepo.findById(targetUserId);
  if (!user) throw new NotFoundError("User");

  if (user.role === "admin" && role !== "admin") {
    const adminCount = await userRepo.count({ role: "admin" });
    if (adminCount <= 1) {
      throw new ForbiddenError("The last administrator cannot be demoted");
    }
  }

  await userRepo.updateRole(targetUserId, role);

  logger.info("Admin updated user role", { adminId, targetUserId, role });
}

// ─── Ban / unban user ─────────────────────────────────────────────────────────

export async function banUser(
  adminId: string,
  targetUserId: string,
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
  targetUserId: string,
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
// Self-deletion is routed through the user account flow. The last remaining
// administrator cannot be demoted or removed.

export async function deleteUser(
  adminId: string,
  targetUserId: string,
): Promise<void> {
  if (adminId === targetUserId) {
    throw new ForbiddenError("Use account settings to delete your own account");
  }

  const user = await userRepo.findById(targetUserId);
  if (!user) throw new NotFoundError("User");

  if (user.role === "admin") {
    const adminCount = await userRepo.count({ role: "admin" });
    if (adminCount <= 1) {
      throw new ForbiddenError("The last administrator cannot be deleted");
    }
  }

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
  totalFlashcards: number;
  aiSpendThisMonth: number;
}> {
  const [totalUsers, totalNotes, totalQuizzes, totalFlashcards] =
    await Promise.all([
      userRepo.count(),
      noteRepo.count(),
      quizRepo.count(),
      flashcardRepo.count(),
    ]);

  return {
    totalUsers,
    totalNotes,
    totalQuizzes,
    totalFlashcards,
    aiSpendThisMonth: 0,
  };
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
  successesToday: number;
  failuresToday: number;
  quotaExceededToday: number;
  tokensToday: number;
  averageLatencyMs: number;
  spendToday: number;
  lastRequestAt: string | null;
}

export interface AdminAIUsageActivity {
  id: string;
  userId: string | null;
  noteId: string | null;
  provider: AIProvider;
  model: string;
  usageLabel: string;
  success: boolean;
  tokensUsed: number;
  latencyMs: number;
  statusCode: number | null;
  quotaExceeded: boolean;
  createdAt: string;
}

export interface AdminAIUsage {
  summary: {
    requestsToday: number;
    successesToday: number;
    failuresToday: number;
    quotaExceededToday: number;
    tokensToday: number;
    averageLatencyMs: number;
    successRate: number;
    lastSuccessAt: string | null;
    lastFailureAt: string | null;
  };
  providers: AdminAIProviderUsage[];
  monthlySpend: number;
  requestsLastSevenDays: Array<{
    date: string;
    label: string;
    value: number;
  }>;
  requestsByRoute: Array<{
    route: string;
    count: number;
  }>;
  models: Array<{
    provider: AIProvider;
    model: string;
    requests: number;
    successes: number;
    failures: number;
    tokens: number;
    averageLatencyMs: number;
  }>;
  recentActivity: AdminAIUsageActivity[];
  warning: string;
}

function providerConfigured(provider: AIProvider): boolean {
  return provider === "openai"
    ? Boolean(AI_CONFIG.openai.apiKey.trim())
    : Boolean(AI_CONFIG.gemini.apiKey.trim());
}

function providerStatus(provider: AIProvider): AdminAIProviderStatus {
  if (!providerConfigured(provider)) {
    return "not_configured";
  }

  return provider === AI_CONFIG.activeProvider ? "operational" : "configured";
}

function beginningOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function averageNumber(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return Math.round(
    values.reduce((sum, value) => sum + value, 0) / values.length,
  );
}

function latestIso(values: Date[]): string | null {
  if (values.length === 0) {
    return null;
  }

  return values
    .reduce((latest, value) =>
      value.getTime() > latest.getTime() ? value : latest,
    )
    .toISOString();
}

export async function getAIUsage(): Promise<AdminAIUsage> {
  const now = new Date();
  const today = beginningOfUtcDay(now);
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const sevenDaysStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6),
  );

  const since = monthStart < sevenDaysStart ? monthStart : sevenDaysStart;

  const events = await getUsageSince(since);
  const todayEvents = events.filter((event) => event.createdAt >= today);
  const successesToday = todayEvents.filter((event) => event.success);
  const failuresToday = todayEvents.filter((event) => !event.success);

  const summary = {
    requestsToday: todayEvents.length,
    successesToday: successesToday.length,
    failuresToday: failuresToday.length,
    quotaExceededToday: todayEvents.filter((event) => event.quotaExceeded)
      .length,
    tokensToday: todayEvents.reduce((sum, event) => sum + event.tokensUsed, 0),
    averageLatencyMs: averageNumber(
      todayEvents.map((event) => event.latencyMs),
    ),
    successRate:
      todayEvents.length === 0
        ? 0
        : (successesToday.length / todayEvents.length) * 100,
    lastSuccessAt: latestIso(
      events.filter((event) => event.success).map((event) => event.createdAt),
    ),
    lastFailureAt: latestIso(
      events.filter((event) => !event.success).map((event) => event.createdAt),
    ),
  };

  const providers: AIProvider[] = ["openai", "gemini"];

  const providerUsage = providers.map((provider): AdminAIProviderUsage => {
    const providerEvents = events.filter(
      (event) => event.provider === provider,
    );
    const providerToday = providerEvents.filter(
      (event) => event.createdAt >= today,
    );

    return {
      provider,
      status: providerStatus(provider),
      requestsToday: providerToday.length,
      successesToday: providerToday.filter((event) => event.success).length,
      failuresToday: providerToday.filter((event) => !event.success).length,
      quotaExceededToday: providerToday.filter((event) => event.quotaExceeded)
        .length,
      tokensToday: providerToday.reduce(
        (sum, event) => sum + event.tokensUsed,
        0,
      ),
      averageLatencyMs: averageNumber(
        providerToday.map((event) => event.latencyMs),
      ),
      spendToday: 0,
      lastRequestAt: latestIso(providerEvents.map((event) => event.createdAt)),
    };
  });

  const weekday = new Intl.DateTimeFormat("en", {
    weekday: "short",
    timeZone: "UTC",
  });

  const requestsLastSevenDays = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - (6 - index),
      ),
    );
    const nextDay = new Date(day.getTime() + 86_400_000);

    return {
      date: day.toISOString().slice(0, 10),
      label: weekday.format(day),
      value: events.filter(
        (event) => event.createdAt >= day && event.createdAt < nextDay,
      ).length,
    };
  });

  const routeCounts = new Map<string, number>();

  for (const event of events) {
    routeCounts.set(
      event.usageLabel,
      (routeCounts.get(event.usageLabel) ?? 0) + 1,
    );
  }

  const modelMap = new Map<
    string,
    {
      provider: AIProvider;
      model: string;
      requests: number;
      successes: number;
      failures: number;
      tokens: number;
      latencies: number[];
    }
  >();

  for (const event of events) {
    const key = `${event.provider}:${event.model}`;
    const current = modelMap.get(key) ?? {
      provider: event.provider,
      model: event.model,
      requests: 0,
      successes: 0,
      failures: 0,
      tokens: 0,
      latencies: [],
    };

    current.requests += 1;
    current.tokens += event.tokensUsed;
    current.latencies.push(event.latencyMs);

    if (event.success) {
      current.successes += 1;
    } else {
      current.failures += 1;
    }

    modelMap.set(key, current);
  }

  const models = Array.from(modelMap.values())
    .map((item) => ({
      provider: item.provider,
      model: item.model,
      requests: item.requests,
      successes: item.successes,
      failures: item.failures,
      tokens: item.tokens,
      averageLatencyMs: averageNumber(item.latencies),
    }))
    .sort((left, right) => right.requests - left.requests);

  const recentActivity: AdminAIUsageActivity[] = [...events]
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, 20)
    .map((event) => ({
      id: event.id,
      userId: event.userId,
      noteId: event.noteId,
      provider: event.provider,
      model: event.model,
      usageLabel: event.usageLabel,
      success: event.success,
      tokensUsed: event.tokensUsed,
      latencyMs: event.latencyMs,
      statusCode: event.statusCode,
      quotaExceeded: event.quotaExceeded,
      createdAt: event.createdAt.toISOString(),
    }));

  return {
    summary,
    providers: providerUsage,
    monthlySpend: 0,
    requestsLastSevenDays,
    requestsByRoute: Array.from(routeCounts.entries())
      .map(([route, count]) => ({
        route,
        count,
      }))
      .sort((left, right) => right.count - left.count),
    models,
    recentActivity,
    warning:
      "Usage telemetry is stored durably in MongoDB. " +
      "Spend remains $0 until provider pricing is explicitly configured.",
  };
}

// ─── Detailed admin health ────────────────────────────────────────────────────

export interface AdminHealthCheck {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  version: string;

  database: {
    connected: boolean;
    state: string;
    latencyMs: number | null;
  };

  redis: RedisHealthSnapshot;

  queues: {
    studyGeneration: QueueHealthSnapshot;
    pdfIngestion: QueueHealthSnapshot;
  };

  workers: {
    studyGeneration: WorkerHealthSnapshot;
    pdfIngestion: WorkerHealthSnapshot;
  };

  ai: {
    reachable: boolean;
    configured: boolean;
    provider: AIProvider;
    model: string;
    checkMode: "configuration";
  };

  telegram: TelegramHealthSnapshot;

  memory: {
    used: number;
    total: number;
    rss: number;
  };
}

const MONGOOSE_STATES: Record<number, string> = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

async function databaseHealth(): Promise<AdminHealthCheck["database"]> {
  const state = mongoose.connection.readyState;

  if (state !== 1 || !mongoose.connection.db) {
    return {
      connected: false,
      state: MONGOOSE_STATES[state] ?? "unknown",
      latencyMs: null,
    };
  }

  const startedAt = Date.now();

  try {
    await mongoose.connection.db.admin().ping();

    return {
      connected: true,
      state: "connected",
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    logger.warn("Admin health database ping failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      connected: false,
      state: "error",
      latencyMs: Date.now() - startedAt,
    };
  }
}

export async function getSystemHealth(): Promise<AdminHealthCheck> {
  const [database, infrastructure, telegram] = await Promise.all([
    databaseHealth(),
    getInfrastructureHealth(),
    getTelegramHealth(),
  ]);

  const provider = AI_CONFIG.activeProvider;
  const configured = providerConfigured(provider);
  const memory = process.memoryUsage();

  const coreAvailable = database.connected && infrastructure.redis.connected;

  const workersAvailable =
    infrastructure.workers.studyGeneration.online &&
    infrastructure.workers.pdfIngestion.online;

  const queuesAvailable =
    infrastructure.queues.studyGeneration.available &&
    infrastructure.queues.pdfIngestion.available;

  const telegramAvailable =
    telegram.configured &&
    telegram.reachable &&
    telegram.webhook.configured &&
    telegram.webhook.matchesExpectedUrl !== false;

  const status: AdminHealthCheck["status"] = !coreAvailable
    ? "unhealthy"
    : !workersAvailable || !queuesAvailable || !telegramAvailable
      ? "degraded"
      : "healthy";

  return {
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version ?? "unknown",
    database,
    redis: infrastructure.redis,
    queues: infrastructure.queues,
    workers: infrastructure.workers,
    ai: {
      reachable: configured,
      configured,
      provider,
      model:
        provider === "openai" ? AI_CONFIG.openai.model : AI_CONFIG.gemini.model,
      checkMode: "configuration",
    },
    telegram,
    memory: {
      used: memory.heapUsed,
      total: memory.heapTotal,
      rss: memory.rss,
    },
  };
}
export async function testAIProvider(adminId: string): Promise<{
  provider: AIProvider;
  model: string;
  tokensUsed: number;
  response: string;
}> {
  const result = await generate({
    systemPrompt:
      "You are performing an internal AI provider connectivity test.",
    prompt: 'Reply with exactly: "AI provider operational"',
    temperature: 0,
    maxTokens: 30,
    usageLabel: "admin_test",
    userId: adminId,
    skipUserQuota: true,
  });

  return {
    provider: result.provider,
    model: result.model,
    tokensUsed: result.tokensUsed,
    response: result.text.trim(),
  };
}
