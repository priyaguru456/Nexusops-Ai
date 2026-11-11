export type Role = "EMPLOYEE" | "MANAGER" | "ADMIN" | "SUPER_ADMIN";

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  organizationId?: string | null;
  organization?: OrganizationSummary | null;
  departmentId: string | null;
  managerId: string | null;
  createdAt: string;
  updatedAt: string;
  department?: {
    id: string;
    name: string;
  } | null;
}

export function isSuperAdminRole(role?: Role | null): boolean {
  return role === "SUPER_ADMIN";
}

export function isAdminRole(role?: Role | null): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export function hasRoleAccess(
  userRole: Role | null | undefined,
  allowedRoles?: Role[],
  exact = false
): boolean {
  if (!userRole) return false;
  if (!allowedRoles || allowedRoles.length === 0) return true;
  if (!exact && userRole === "SUPER_ADMIN") return true;
  return allowedRoles.includes(userRole);
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
  register: (name: string, email: string, password: string, organizationSlug?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
  refreshUser: () => Promise<void>;
}
