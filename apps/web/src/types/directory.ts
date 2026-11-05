import type { Role } from "./auth";

export interface DirectoryUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  departmentId: string | null;
  department: {
    id: string;
    name: string;
  } | null;
  managerId: string | null;
  manager: {
    id: string;
    name: string;
    email: string;
    role: Role;
  } | null;
  directReportsCount: number;
  createdAt: string;
}

export interface DepartmentSummary {
  id: string;
  name: string;
  userCount: number;
}

export interface PaginatedDirectoryResponse {
  users: DirectoryUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DirectoryQueryFilters {
  page?: number;
  limit?: number;
  search?: string;
  departmentId?: string;
  role?: Role | "ALL";
}

export interface OrgNode extends DirectoryUser {
  children?: OrgNode[];
  isExpanded?: boolean;
  isLoadingChildren?: boolean;
  hasLoadedChildren?: boolean;
}

export interface TeamData {
  user: DirectoryUser;
  manager: DirectoryUser | null;
  peers: DirectoryUser[];
  directReports: DirectoryUser[];
}
