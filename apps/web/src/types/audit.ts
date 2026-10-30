import type { Role } from "./auth";

export interface AuditLogItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorId: string | null;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
  actor?: {
    id: string;
    name: string;
    email: string;
    role: Role;
  } | null;
}

export interface AuditLogQueryFilters {
  action?: string;
  entityType?: string;
  actorId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedAuditLogsResponse {
  logs: AuditLogItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
