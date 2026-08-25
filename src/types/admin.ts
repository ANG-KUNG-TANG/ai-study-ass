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
  actorRole: "user" | "admin" | "system";
  action: string;
  category: "authentication" | "user" | "content" | "ai" | "security" | "settings" | "system";
  status: "success" | "failure";
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  text?: string;
  createdAt: string;
}

export interface AdminActivityQuery {
  page?: number;
  limit?: number;
  search?: string;
  action?: string;
  category?: string;
  status?: "success" | "failure";
  targetType?: string;
  actorId?: string;
  from?: string;
  to?: string;
}

export interface AdminContentQuery {
  page?: number;
  limit?: number;
  search?: string;
  fileType?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  adminStatus?: "active" | "quarantined";
}

export interface AdminContentItem {
  id: string;
  title: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  ownerEmail: string;
  status: "Indexed" | "Processing" | "Unknown";
  adminStatus: "active" | "quarantined";
  createdAt: string;
}

export interface AdminContentDetail {
  note: {
    id: string;
    userId: string;
    title: string;
    fileName: string;
    fileType: "pdf" | "docx";
    fileSize: number;
    content: string;
    summary: string | null;
    sourcePageCount: number | null;
    adminStatus: "active" | "quarantined";
    quarantineReason: string | null;
    quarantinedAt: string | null;
    quarantinedBy: string | null;
    createdAt: string;
    updatedAt: string;
  };
  owner: { id: string; email: string } | null;
  generation: {
    stage: string;
    features: Record<string, { status: string; error: string | null }>;
    updatedAt: string;
  } | null;
  intelligence: { stage: string; failedStage: string | null } | null;
  queue: { state: string; jobId?: string; failedReason?: string | null } | null;
  aiUsage: AdminAIUsageActivity[];
  extractedTextPreview: string;
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
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
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

export interface AdminUserAIPolicy {
  stored: {
    userId: string;
    enabled: boolean;
    dailyRequestLimit: number | null;
    dailyTokenLimit: number | null;
    updatedBy: string;
    createdAt: string;
    updatedAt: string;
  } | null;
  effective: {
    enabled: boolean;
    providerAccessEnabled: boolean;
    source: "system_default" | "user_override";
    requestLimit: number | null;
    tokenLimit: number | null;
    requestsUsed: number;
    tokensUsed: number;
    requestsRemaining: number | null;
    tokensRemaining: number | null;
    allowed: boolean;
    resetsAt: string;
  };
}

export interface OperationalSettings {
  id: "system";
  uploadsEnabled: boolean;
  aiGenerationEnabled: boolean;
  allowedFileTypes: Array<"pdf" | "docx">;
  maxUploadSizeBytes: number;
  auditRetentionDays: number;
  contentRetentionDays: number;
  pricing: Record<"openai" | "gemini", {
    inputPerMillionUsd: number;
    outputPerMillionUsd: number;
  }>;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SecurityReport {
  windowMinutes: number;
  generatedAt: string;
  scannedEvents: number;
  summary: { medium: number; high: number; critical: number };
  signals: Array<{
    type: string;
    severity: "medium" | "high" | "critical";
    title: string;
    description: string;
    count: number;
    actorId?: string;
    actorEmail?: string;
    ip?: string;
    firstSeen: string;
    lastSeen: string;
  }>;
}
