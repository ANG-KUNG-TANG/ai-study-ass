export interface StudentAIUsageSummary {
  requestsToday: number;
  successesToday: number;
  failuresToday: number;
  tokensToday: number;
  estimatedCostToday: number;
  averageLatencyMs: number;
  successRate: number;
  quotaExceededToday: number;
}

export interface StudentAIQuota {
  enabled: boolean;
  providerAccessEnabled: boolean;
  source: "system_default" | "user_override";

  requestLimit: number | null;
  tokenLimit: number | null;

  requestsUsed: number;
  tokensUsed: number;
  estimatedCostUsd: number;

  requestsRemaining: number | null;
  tokensRemaining: number | null;

  requestLimitReached: boolean;
  tokenLimitReached: boolean;

  allowed: boolean;

  resetsAt: string;
}

export interface StudentAIUsageProvider {
  provider: "openai" | "gemini";
  requests: number;
  successes: number;
  failures: number;
  tokens: number;
  averageLatencyMs: number;
}

export interface StudentAIUsageFeature {
  label: string;
  requests: number;
  successes: number;
  failures: number;
  tokens: number;
}

export interface StudentAIUsageDay {
  date: string;
  label: string;
  requests: number;
  tokens: number;
}

export interface StudentAIUsageActivity {
  id: string;
  noteId: string | null;
  provider: "openai" | "gemini";
  model: string;
  usageLabel: string;
  success: boolean;
  tokensUsed: number;
  estimatedCostUsd: number;
  latencyMs: number;
  statusCode: number | null;
  quotaExceeded: boolean;
  createdAt: string;
}

export interface StudentAIUsage {
  summary: StudentAIUsageSummary;
  quota: StudentAIQuota;
  providers: StudentAIUsageProvider[];
  features: StudentAIUsageFeature[];
  lastSevenDays: StudentAIUsageDay[];
  recentActivity: StudentAIUsageActivity[];
}
