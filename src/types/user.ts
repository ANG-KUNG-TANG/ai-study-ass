export type UserRole = "user" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string; // ISO string over the wire — same reasoning as Note
  updatedAt: string;
}