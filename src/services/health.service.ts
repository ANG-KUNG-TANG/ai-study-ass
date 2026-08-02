import {
  apiFetch,
} from "@/lib/api";
import type {
  HealthCheck,
} from "@/types/health";

/**
 * Detailed health information is admin-only.
 *
 * The public /api/health endpoint remains a minimal liveness probe and does not
 * expose database, provider, memory, or uptime details.
 */
export function getHealth():
  Promise<HealthCheck> {
  return apiFetch<HealthCheck>(
    "/admin/health",
  );
}
