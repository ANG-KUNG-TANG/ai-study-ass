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
