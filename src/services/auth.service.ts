import { apiFetch } from "@/lib/api";
import type { User } from "@/types/user";

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string,
  password: string
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export function register(input: RegisterInput): Promise<{ message: string }> {
  return apiFetch("/auth/register", { method: "POST", skipAuth: true, body: JSON.stringify(input) });
}

export function login(input: LoginInput): Promise<{ accessToken: string; user: User }> {
  return apiFetch('/auth/login', { method: "POST", skipAuth: true, body: JSON.stringify(input)})
}

export function logout(): Promise<void> {
  return apiFetch('/auth/logout', { method: "POST"})
}
export function verifyEmail(token: string): Promise<{ message: string }> {
  return apiFetch("/auth/verify-email", { method: "POST", skipAuth: true, body: JSON.stringify({ token }) });
}

export function resendVerification(email: string): Promise<{ message: string }> {
  return apiFetch("/auth/resend-verification", { method: "POST", skipAuth: true, body: JSON.stringify({ email }) });
}

export function forgotPassword(email: string): Promise<{ message: string }> {
  return apiFetch("/auth/forgot-password", { method: "POST", skipAuth: true, body: JSON.stringify({ email }) });
}

export function resetPassword(
  token: string,
  newPassword: string,
  confirmPassword: string,
): Promise<{ message: string }> {
  return apiFetch("/auth/reset-password", {
    method: "POST",
    skipAuth: true,
    body: JSON.stringify({ token, newPassword, confirmPassword }),
  });
}


export function changePassword(input: ChangePasswordInput): Promise<{ message: string }> {
  return apiFetch("/auth/password", { method: "PATCH", body: JSON.stringify(input) });
}

export function logoutAllSessions(): Promise<{ message: string }> {
  return apiFetch("/auth/sessions", { method: "DELETE" });
}
