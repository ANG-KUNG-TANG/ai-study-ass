export type UserRole = "user" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  emailVerified: boolean;
  passwordConfigured: boolean;
  createdAt: string; // ISO string over the wire — same reasoning as Note
  updatedAt: string;
}

export interface AccountProfile extends User {
  googleConnected: boolean;
}
