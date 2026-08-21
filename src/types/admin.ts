export interface UserStats {
  total: number;
  active: number;
  inactive: number;
  admins: number;
}

export interface AdminUserQuery {
  page?: number;
  limit?: number;
  search?: string;
  role?: "user" | "admin";
  isActive?: boolean;
}

export interface AdminOverviewStats {
  totalUsers: number;
  totalNotes: number;
  totalQuizzes: number;
  totalFlashcards?: number;
  aiSpendThisMonth?: number;
}

export interface AdminActivityItem {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  text?: string;
  createdAt: string;
}

export interface AdminActivityQuery {
  page?: number;
  limit?: number;
}

export interface AdminContentQuery {
  page?: number;
  limit?: number;
  search?: string;
  fileType?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface AdminContentItem {
  id: string;
  title: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  ownerEmail: string;
  status: "Indexed" | "Processing" | "Unknown";
  createdAt: string;
}

export interface AdminAIProviderUsage {
  provider: "openai" | "gemini";
  status:
    | "operational"
    | "configured"
    | "not_configured"
    | "degraded"
    | "quota_exhausted";
  requestsToday: number;
  successesToday: number;
  failuresToday: number;
  quotaExceededToday: number;
  tokensToday: number;
  averageLatencyMs: number;
  spendToday: number;
  lastRequestAt: string | null;
}

export interface AdminAIUsageSummary {
  requestsToday: number;
  successesToday: number;
  failuresToday: number;
  quotaExceededToday: number;
  tokensToday: number;
  averageLatencyMs: number;
  successRate: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
}

export interface AdminAIUsageActivity {
  id: string;
  userId: string | null;
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

export interface AdminAIModelUsage {
  provider: "openai" | "gemini";
  model: string;
  requests: number;
  successes: number;
  failures: number;
  tokens: number;
  averageLatencyMs: number;
}

export interface AdminAIUsage {
  summary: AdminAIUsageSummary;
  providers: AdminAIProviderUsage[];
  monthlySpend: number;
  requestsLastSevenDays: Array<{
    date: string;
    label: string;
    value: number;
  }>;
  requestsByRoute: Array<{
    route: string;
    count: number;
  }>;
  models: AdminAIModelUsage[];
  recentActivity: AdminAIUsageActivity[];
  warning?: string;
}
