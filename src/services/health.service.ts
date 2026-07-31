import { apiFetch } from "@/lib/api";
import type { HealthCheck } from "@/types/health";

export function getHealth(): Promise<HealthCheck> {
  return apiFetch<HealthCheck>("/health");
}