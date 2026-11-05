import { api } from "../../api/client";
import type {
  DirectoryQueryFilters,
  PaginatedDirectoryResponse,
  DepartmentSummary,
  DirectoryUser,
  TeamData,
} from "../../types/directory";

export async function fetchDirectory(
  filters: DirectoryQueryFilters
): Promise<PaginatedDirectoryResponse> {
  const cleanParams: Record<string, unknown> = {};

  if (filters.page) cleanParams.page = filters.page;
  if (filters.limit) cleanParams.limit = filters.limit;
  if (filters.search && filters.search.trim()) cleanParams.search = filters.search.trim();
  if (filters.departmentId && filters.departmentId !== "ALL") cleanParams.departmentId = filters.departmentId;
  if (filters.role && filters.role !== "ALL") cleanParams.role = filters.role;

  const res = await api.get<PaginatedDirectoryResponse>("/directory", {
    params: cleanParams,
  });
  return res.data;
}

export async function fetchDepartments(): Promise<DepartmentSummary[]> {
  const res = await api.get<{ departments: DepartmentSummary[] }>("/directory/departments");
  return res.data.departments;
}

export async function fetchOrgRoots(departmentId?: string): Promise<DirectoryUser[]> {
  const params: Record<string, string> = {};
  if (departmentId && departmentId !== "ALL") {
    params.departmentId = departmentId;
  }
  const res = await api.get<{ roots: DirectoryUser[] }>("/directory/org", { params });
  return res.data.roots;
}

export async function fetchDirectReports(managerId: string): Promise<DirectoryUser[]> {
  const res = await api.get<{ reports: DirectoryUser[] }>(`/directory/reports/${managerId}`);
  return res.data.reports;
}

export async function fetchUserTeam(userId: string): Promise<TeamData> {
  const res = await api.get<TeamData>(`/directory/team/${userId}`);
  return res.data;
}
