export interface HealthCheck {
  status:
    | "healthy"
    | "degraded"
    | "unhealthy";

  timestamp: string;
  uptime: number;
  version: string;

  database: {
    connected: boolean;
    state: string;
    latencyMs: number | null;
  };

  ai: {
    reachable: boolean;
    configured: boolean;
    provider: string;
    model: string;
    checkMode: "configuration";
  };

  memory: {
    used: number;
    total: number;
    rss: number;
  };
}
