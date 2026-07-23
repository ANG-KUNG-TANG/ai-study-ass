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