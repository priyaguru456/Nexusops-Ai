import { useQuery } from "@tanstack/react-query";
import { adminApi } from "./api";
import type { AuditLogQueryFilters } from "../../types/audit";

export const AUDIT_KEYS = {
  all: ["audit-logs"] as const,
  list: (filters: AuditLogQueryFilters) => [...AUDIT_KEYS.all, "list", filters] as const,
};

export const useAuditLogs = (filters: AuditLogQueryFilters = {}) => {
  return useQuery({
    queryKey: AUDIT_KEYS.list(filters),
    queryFn: () => adminApi.getAuditLogs(filters),
  });
};
