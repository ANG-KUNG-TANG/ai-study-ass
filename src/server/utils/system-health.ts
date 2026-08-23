export type SystemHealthStatus =
  | "healthy"
  | "degraded"
  | "unhealthy";

export function deriveSystemHealthStatus(input: {
  databaseConnected: boolean;
  redisReachable: boolean;
  aiConfigured: boolean;
}): SystemHealthStatus {
  if (!input.databaseConnected || !input.redisReachable) {
    return "unhealthy";
  }

  return input.aiConfigured ? "healthy" : "degraded";
}
