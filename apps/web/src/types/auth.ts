export type Role = "EMPLOYEE" | "MANAGER" | "ADMIN";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  departmentId: string | null;
  managerId: string | null;
  createdAt: string;
  updatedAt: string;
  department?: {
    id: string;
    name: string;
  } | null;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export interface RefreshResponse {
  accessToken: string;
}

export interface AuthContextType {
  user: User | null;
  role: Role | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}
