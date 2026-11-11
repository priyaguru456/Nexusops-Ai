import { api } from "../../api/client";

export interface OrganizationRecord {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    users: number;
    departments: number;
    workRequests: number;
    documents: number;
  };
}

export interface OrganizationQueryFilters {
  search?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface PaginatedOrganizationsResponse {
  items: OrganizationRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateOrganizationPayload {
  name: string;
  slug: string;
  adminName?: string;
  adminEmail?: string;
  adminPassword?: string;
}

export interface CreateOrganizationResponse {
  organization: OrganizationRecord;
  initialAdmin: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
}

export interface UpdateOrganizationPayload {
  name?: string;
  slug?: string;
  isActive?: boolean;
}

export const organizationsApi = {
  list: async (
    filters: OrganizationQueryFilters = {}
  ): Promise<PaginatedOrganizationsResponse> => {
    const res = await api.get<PaginatedOrganizationsResponse>("/organizations", {
      params: filters,
    });
    return res.data;
  },

  getById: async (id: string): Promise<{ organization: OrganizationRecord }> => {
    const res = await api.get<{ organization: OrganizationRecord }>(`/organizations/${id}`);
    return res.data;
  },

  create: async (payload: CreateOrganizationPayload): Promise<CreateOrganizationResponse> => {
    const res = await api.post<CreateOrganizationResponse>("/organizations", payload);
    return res.data;
  },

  update: async (
    id: string,
    payload: UpdateOrganizationPayload
  ): Promise<{ organization: OrganizationRecord }> => {
    const res = await api.patch<{ organization: OrganizationRecord }>(`/organizations/${id}`, payload);
    return res.data;
  },
};
