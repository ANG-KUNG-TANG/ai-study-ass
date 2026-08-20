export interface StudentAIUsageSummary {
  requestsToday: number;
  successesToday: number;
  failuresToday: number;
  tokensToday: number;
  averageLatencyMs: number;
  successRate: number;
  quotaExceededToday: number;
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
  latencyMs: number;
  statusCode: number | null;
  quotaExceeded: boolean;
  createdAt: string;
}

export interface StudentAIUsage {
  summary: StudentAIUsageSummary;
  providers: StudentAIUsageProvider[];
  features: StudentAIUsageFeature[];
  lastSevenDays: StudentAIUsageDay[];
  recentActivity: StudentAIUsageActivity[];
}
