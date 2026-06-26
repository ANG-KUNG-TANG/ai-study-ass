import { z } from "zod";
import { USER_RULES } from "@/server/entities/user.entity";

// ─── Purpose ──────────────────────────────────────────────────────────────────
// Parses and shapes raw HTTP input only.
// USER_RULES from the entity is the source of truth for all numeric limits.

// ─── Reusable fields ──────────────────────────────────────────────────────────

const emailField = z
  .string({ required_error: "Email is required" })
  .email("Invalid email format")
  .toLowerCase()
  .trim();

const passwordField = z
  .string({ required_error: "Password is required" })
  .min(USER_RULES.password.minLength, `Password must be at least ${USER_RULES.password.minLength} characters`)
  .max(USER_RULES.password.maxLength, `Password cannot exceed ${USER_RULES.password.maxLength} characters`)
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[!@#$%^&*(){}~]/, "Password must contain at least one special character")

// ─── Schemas ──────────────────────────────────────────────────────────────────

export const registerSchema = z.object({
  name: z
    .string({ required_error: "Name is required" })
    .min(USER_RULES.name.minLength, `Name must be at least ${USER_RULES.name.minLength} characters`)
    .max(USER_RULES.name.maxLength, `Name cannot exceed ${USER_RULES.name.maxLength} characters`)
    .trim(),
  email: emailField,
  password: passwordField,
});

export const loginSchema = z.object({
  email: emailField,
  // No strength check on login — only validate presence
  password: z.string({ required_error: "Password is required" }).min(1),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({ required_error: "Current password is required" })
      .min(1),
    newPassword: passwordField,
    confirmPassword: z
      .string({ required_error: "Please confirm your new password" }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from current password",
    path: ["newPassword"],
  });

// Accepts the token from the verification email link
export const verifyEmailSchema = z.object({
  token: z.string({ required_error: "Verification token is required" }).min(1),
});

// ─── Inferred types ───────────────────────────────────────────────────────────

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;


//Request a password reset lin
export const forgotPasswordSchema = z.object({
  email: emailField,
});

//subit new password using the reset token
export const resetPasswordSchema = z.object({
  token: z.string({ required_error: "Reset token is required"}).min(1),
  newPassword: passwordField,
  confirmPassword: z.string({required_error: "Please confirm your new password"}),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Password do not match",
  path: ["confirmPassword"],
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;