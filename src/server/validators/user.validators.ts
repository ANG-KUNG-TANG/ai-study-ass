import { z } from "zod";

// ─── Update profile ───────────────────────────────────────────────────────────
// Only `name` is user-editable for now. Extend here as profile grows
// (e.g. avatar, studyPreferences) — keep it explicit, don't allow arbitrary keys.

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(100).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// ─── Delete account ───────────────────────────────────────────────────────────
// Requires password confirmation per user.service.ts::deleteAccount

export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Password confirmation is required"),
});

export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
