import { api } from "../../api/client";
import type {
  WorkRequest,
  RequestQueryFilters,
  PaginatedRequestsResponse,
  ActivityHistoryItem,
} from "../../types/requests";

export async function fetchRequests(filters: RequestQueryFilters): Promise<PaginatedRequestsResponse> {
  const cleanParams: Record<string, unknown> = {};
  Object.entries(filters).forEach(([key, val]) => {
    if (val !== undefined && val !== "") {
      cleanParams[key] = val;
    }
  });

  const res = await api.get<PaginatedRequestsResponse>("/requests", {
    params: cleanParams,
  });
  return res.data;
}

export async function fetchRequestById(id: string): Promise<WorkRequest> {
  const res = await api.get<{ request: WorkRequest }>(`/requests/${id}`);
  return res.data.request;
}

export async function fetchRequestActivity(id: string): Promise<ActivityHistoryItem[]> {
  const res = await api.get<{ history: ActivityHistoryItem[] }>(`/requests/${id}/activity`);
  return res.data.history;
}

export async function createRequest(formData: FormData): Promise<WorkRequest> {
  const res = await api.post<{ request: WorkRequest }>("/requests", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return res.data.request;
}

export async function updateRequest(
  id: string,
  data: {
    title?: string;
    description?: string;
    category?: string;
    priority?: string;
    amount?: number | null;
    dueDate?: string | null;
  }
): Promise<WorkRequest> {
  const res = await api.patch<{ request: WorkRequest }>(`/requests/${id}`, data);
  return res.data.request;
}

export async function submitRequest(id: string): Promise<WorkRequest> {
  const res = await api.post<{ request: WorkRequest }>(`/requests/${id}/submit`);
  return res.data.request;
}

export async function cancelRequest(id: string): Promise<WorkRequest> {
  const res = await api.post<{ request: WorkRequest }>(`/requests/${id}/cancel`);
  return res.data.request;
}

export async function transitionRequestStatus(
  id: string,
  status: string,
  comment?: string
): Promise<WorkRequest> {
  const res = await api.patch<{ request: WorkRequest }>(`/requests/${id}/status`, {
    status,
    comment,
  });
  return res.data.request;
}

export async function uploadRequestAttachment(id: string, file: File): Promise<void> {
  const formData = new FormData();
  formData.append("file", file);
  await api.post(`/requests/${id}/attachments`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
}
