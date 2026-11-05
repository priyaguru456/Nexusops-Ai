import { api } from "../../api/client";
import type { PaginatedAuditLogsResponse, AuditLogQueryFilters } from "../../types/audit";
import type { Role, User } from "../../types/auth";

export interface UserQueryFilters {
  search?: string;
  role?: Role;
  isActive?: boolean | string;
  page?: number;
  limit?: number;
}

export interface PaginatedUsersResponse {
  users: User[];
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

export const adminApi = {
  getAuditLogs: async (filters: AuditLogQueryFilters = {}): Promise<PaginatedAuditLogsResponse> => {
    const res = await api.get<PaginatedAuditLogsResponse>("/audit-logs", {
      params: filters,
    });
    return res.data;
  },

  exportAuditLogsCsv: async (filters: AuditLogQueryFilters = {}): Promise<Blob> => {
    const res = await api.get("/audit-logs/export", {
      params: filters,
      responseType: "blob",
    });
    return res.data;
  },

  getUsers: async (filters: UserQueryFilters = {}): Promise<PaginatedUsersResponse> => {
    const res = await api.get<PaginatedUsersResponse>("/users", {
      params: filters,
    });
    return res.data;
  },

  updateUserRole: async (userId: string, role: Role): Promise<{ user: User }> => {
    const res = await api.patch<{ user: User }>(`/users/${userId}/role`, { role });
    return res.data;
  },

  updateUserStatus: async (userId: string, isActive: boolean): Promise<{ user: User }> => {
    const res = await api.patch<{ user: User }>(`/users/${userId}/status`, { isActive });
    return res.data;
  },
};
