import { z } from "zod";
import { AUDIT_ACTIONS, AUDIT_CATEGORIES } from "@/server/entities/auditLog.entity";
import { ADMIN_FILE_TYPES } from "@/server/entities/operational-settings.entity";
import { MAX_FILE_SIZE_BYTES } from "@/server/utils/constants";

// ─── Purpose ──────────────────────────────────────────────────────────────────
// Query + body validation for the admin controller only.

// ─── List users query ─────────────────────────────────────────────────────────

export const userQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  role: z.enum(["user", "admin"]).optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().trim().max(100).optional(),
});

export type UserQueryInput = z.infer<typeof userQuerySchema>;

export const noteQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  fileType: z.enum(["pdf", "docx"]).optional(),
  search: z.string().trim().max(100).optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "title"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

export type NoteQueryInput = z.infer<typeof noteQuerySchema>;

export const adminContentQuerySchema = noteQuerySchema.extend({
  adminStatus: z.enum(["active", "quarantined"]).optional(),
});

export type AdminContentQueryInput = z.infer<typeof adminContentQuerySchema>;

const optionalDate = z.string().datetime({ offset: true }).transform((value) => new Date(value)).optional();

export const activityQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().trim().max(200).optional(),
  action: z.enum(AUDIT_ACTIONS).optional(),
  category: z.enum(AUDIT_CATEGORIES).optional(),
  status: z.enum(["success", "failure"]).optional(),
  targetType: z.string().trim().max(50).optional(),
  actorId: z.string().trim().max(100).optional(),
  from: optionalDate,
  to: optionalDate,
});

export type ActivityQueryInput = z.infer<typeof activityQuerySchema>;

export const adminReasonSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export type AdminReasonInput = z.infer<typeof adminReasonSchema>;

export const userAIPolicySchema = z.object({
  enabled: z.boolean(),
  dailyRequestLimit: z.number().int().min(0).max(1_000_000_000).nullable(),
  dailyTokenLimit: z.number().int().min(0).max(1_000_000_000).nullable(),
  reason: z.string().trim().min(3).max(500),
});

export type UserAIPolicyInput = z.infer<typeof userAIPolicySchema>;

const providerPricingSchema = z.object({
  inputPerMillionUsd: z.number().min(0).max(10_000),
  outputPerMillionUsd: z.number().min(0).max(10_000),
});

export const operationalSettingsSchema = z.object({
  uploadsEnabled: z.boolean(),
  aiGenerationEnabled: z.boolean(),
  allowedFileTypes: z.array(z.enum(ADMIN_FILE_TYPES)).min(1),
  maxUploadSizeBytes: z.number().int().min(1_024).max(MAX_FILE_SIZE_BYTES),
  auditRetentionDays: z.number().int().min(30).max(3_650),
  contentRetentionDays: z.number().int().min(0).max(3_650),
  pricing: z.object({
    openai: providerPricingSchema,
    gemini: providerPricingSchema,
  }),
  reason: z.string().trim().min(3).max(500),
});

export type OperationalSettingsInput = z.infer<typeof operationalSettingsSchema>;
// ─── Update role ──────────────────────────────────────────────────────────────

export const updateRoleSchema = z.object({
  role: z.enum(["user", "admin"], {
    error: "Role must be either 'user' or 'admin'",
  }),
  reason: z.string().trim().min(3).max(500),
});

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
