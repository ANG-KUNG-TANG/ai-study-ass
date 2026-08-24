import { apiFetch } from "@/lib/api";
import type { AccountProfile, User } from "@/types/user";

export function getProfile(): Promise<AccountProfile> {
  return apiFetch<AccountProfile>("/user/me");
}

export function updateProfile(input: { name: string }): Promise<User> {
  return apiFetch<User>("/user/me", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteAccount(password: string): Promise<void> {
  return apiFetch<void>("/user/me", {
    method: "DELETE",
    body: JSON.stringify({ password }),
  });
}
