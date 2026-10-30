import { api } from "../../api/client";
import type { PaginatedAuditLogsResponse, AuditLogQueryFilters } from "../../types/audit";

export const adminApi = {
  getAuditLogs: async (filters: AuditLogQueryFilters = {}): Promise<PaginatedAuditLogsResponse> => {
    const res = await api.get<PaginatedAuditLogsResponse>("/audit-logs", {
      params: filters,
    });
    return res.data;
  },
};
