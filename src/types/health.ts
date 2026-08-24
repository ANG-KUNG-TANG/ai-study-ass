export interface QueueHealth {
  available: boolean;
  waiting: number | null;
  active: number | null;
  completed: number | null;
  failed: number | null;
  delayed: number | null;
}

export interface WorkerHealth {
  online: boolean;
  lastHeartbeatAt: string | null;
  ageMs: number | null;
}

export interface TelegramHealth {
  configured: boolean;
  reachable: boolean;

  bot: {
    id: number | null;
    username: string | null;
    displayName: string | null;
  };

  webhook: {
    configured: boolean;
    secretConfigured: boolean;
    matchesExpectedUrl: boolean | null;
    url: string | null;
    expectedUrl: string | null;
    pendingUpdates: number | null;
    lastErrorAt: string | null;
    lastErrorMessage: string | null;
  };

  checkedAt: string;
}

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

  redis: {
    connected: boolean;
    latencyMs: number | null;
  };

  queues: {
    studyGeneration: QueueHealth;
    pdfIngestion: QueueHealth;
  };

  workers: {
    studyGeneration: WorkerHealth;
    pdfIngestion: WorkerHealth;
  };

  ai: {
    status:
      | "not_configured"
      | "configured"
      | "operational"
      | "degraded"
      | "quota_exhausted";

    reachable: boolean;
    configured: boolean;

    provider: string;
    model: string;

    checkMode:
      "configuration_and_telemetry";

    requestsToday: number;
    successesToday: number;
    failuresToday: number;
    quotaExceededToday: number;

    lastRequestAt: string | null;
    lastSuccessAt: string | null;
    lastFailureAt: string | null;
  };

  telegram: TelegramHealth;

  memory: {
    used: number;
    total: number;
    rss: number;
  };
}
