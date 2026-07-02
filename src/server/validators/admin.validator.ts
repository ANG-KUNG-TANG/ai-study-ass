import { z } from "zod";

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

// ─── Update role ──────────────────────────────────────────────────────────────

export const updateRoleSchema = z.object({
  role: z.enum(["user", "admin"], {
    error: "Role must be either 'user' or 'admin'",
  }),
});

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;