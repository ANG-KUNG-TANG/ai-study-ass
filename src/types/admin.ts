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
    | "not_configured";
  requestsToday: number;
  tokensToday: number;
  averageLatencyMs: number;
  spendToday: number;
  failuresToday: number;
}

export interface AdminAIUsage {
  providers: AdminAIProviderUsage[];
  monthlySpend: number;
  requestsLastSevenDays: Array<{
    label: string;
    value: number;
  }>;
  requestsByRoute: Array<{
    route: string;
    count: number;
  }>;
  warning?: string;
}
