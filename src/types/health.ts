// Loosely typed on purpose — health.controller.ts wasn't available to confirm
// the exact shape. Treat every field as possibly absent until verified.
export interface HealthCheck {
  status?: string;
  uptime?: number;
  version?: string;
  database?: { connected?: boolean; [key: string]: unknown };
  ai?: { reachable?: boolean; provider?: string; [key: string]: unknown };
  memory?: { used?: number; total?: number; [key: string]: unknown };
  [key: string]: unknown;
}