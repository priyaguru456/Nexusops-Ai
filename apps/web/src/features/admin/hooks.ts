import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi, type UserQueryFilters } from "./api";
import {
  organizationsApi,
  type CreateOrganizationPayload,
  type OrganizationQueryFilters,
  type UpdateOrganizationPayload,
} from "./organizations.api";
import type { AuditLogQueryFilters } from "../../types/audit";
import type { Role } from "../../types/auth";

export const AUDIT_KEYS = {
  all: ["audit-logs"] as const,
  list: (filters: AuditLogQueryFilters) => [...AUDIT_KEYS.all, "list", filters] as const,
};

export const USER_KEYS = {
  all: ["users"] as const,
  list: (filters: UserQueryFilters) => [...USER_KEYS.all, "list", filters] as const,
};

export const ORGANIZATION_KEYS = {
  all: ["organizations"] as const,
  list: (filters: OrganizationQueryFilters) => [...ORGANIZATION_KEYS.all, "list", filters] as const,
};

export const useAuditLogs = (filters: AuditLogQueryFilters = {}) => {
  return useQuery({
    queryKey: AUDIT_KEYS.list(filters),
    queryFn: () => adminApi.getAuditLogs(filters),
  });
};

export const useExportAuditLogs = () => {
  return useMutation({
    mutationFn: (filters: AuditLogQueryFilters = {}) => adminApi.exportAuditLogsCsv(filters),
  });
};

export const useUsers = (filters: UserQueryFilters = {}) => {
  return useQuery({
    queryKey: USER_KEYS.list(filters),
    queryFn: () => adminApi.getUsers(filters),
  });
};

export const useUpdateUserRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Role }) =>
      adminApi.updateUserRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USER_KEYS.all });
    },
  });
};

export const useUpdateUserStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      adminApi.updateUserStatus(userId, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USER_KEYS.all });
    },
  });
};

export const useOrganizations = (filters: OrganizationQueryFilters = {}) => {
  return useQuery({
    queryKey: ORGANIZATION_KEYS.list(filters),
    queryFn: () => organizationsApi.list(filters),
  });
};

export const useCreateOrganization = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateOrganizationPayload) => organizationsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORGANIZATION_KEYS.all });
    },
  });
};

export const useUpdateOrganization = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateOrganizationPayload }) =>
      organizationsApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORGANIZATION_KEYS.all });
    },
  });
};
