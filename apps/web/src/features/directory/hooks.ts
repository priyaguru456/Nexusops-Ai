import { useQuery } from "@tanstack/react-query";
import {
  fetchDirectory,
  fetchDepartments,
  fetchOrgRoots,
  fetchDirectReports,
  fetchUserTeam,
} from "./api";
import type { DirectoryQueryFilters } from "../../types/directory";

export function useDirectory(filters: DirectoryQueryFilters) {
  return useQuery({
    queryKey: ["directory", filters],
    queryFn: () => fetchDirectory(filters),
    staleTime: 30000,
  });
}

export function useDirectoryDepartments() {
  return useQuery({
    queryKey: ["directory-departments"],
    queryFn: () => fetchDepartments(),
    staleTime: 60000,
  });
}

export function useOrgRoots(departmentId?: string) {
  return useQuery({
    queryKey: ["directory-org-roots", departmentId],
    queryFn: () => fetchOrgRoots(departmentId),
    staleTime: 60000,
  });
}

export function useDirectReports(managerId: string, enabled = true) {
  return useQuery({
    queryKey: ["directory-reports", managerId],
    queryFn: () => fetchDirectReports(managerId),
    enabled: Boolean(managerId) && enabled,
    staleTime: 60000,
  });
}

export function useUserTeam(userId: string | null) {
  return useQuery({
    queryKey: ["directory-team", userId],
    queryFn: () => (userId ? fetchUserTeam(userId) : Promise.reject("No userId")),
    enabled: Boolean(userId),
    staleTime: 30000,
  });
}
