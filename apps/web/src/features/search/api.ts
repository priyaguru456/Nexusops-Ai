import { api } from "../../api/client";

export interface SearchResultRequest {
  id: string;
  title: string;
  category: string;
  status: string;
  priority: string;
  createdAt: string;
  requesterName: string;
}

export interface SearchResultTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  createdAt: string;
  assigneeName: string | null;
  requestId: string;
}

export interface GlobalSearchResponse {
  requests: SearchResultRequest[];
  tasks: SearchResultTask[];
}

export const searchApi = {
  search: async (q: string, signal?: AbortSignal): Promise<GlobalSearchResponse> => {
    const res = await api.get<GlobalSearchResponse>("/search", {
      params: { q },
      signal,
    });
    return res.data;
  },
};
