import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, baseURL, getAccessToken, refreshAccessToken } from "../../api/client";
import type {
  AnalyticsOverviewData,
  RequestsAnalyticsData,
  TasksAnalyticsData,
  AIUsageAnalyticsData,
  DigestScheduleData,
  DigestDeliveriesResponse,
  SaveDigestSchedulePayload,
} from "./types";

export const analyticsApi = {
  async getOverview(from?: string, to?: string): Promise<AnalyticsOverviewData> {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const res = await api.get<{ status: string; data: AnalyticsOverviewData }>(
      `/analytics/overview?${params.toString()}`
    );
    return res.data.data;
  },

  async getRequests(from?: string, to?: string): Promise<RequestsAnalyticsData> {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const res = await api.get<{ status: string; data: RequestsAnalyticsData }>(
      `/analytics/requests?${params.toString()}`
    );
    return res.data.data;
  },

  async getTasks(from?: string, to?: string): Promise<TasksAnalyticsData> {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const res = await api.get<{ status: string; data: TasksAnalyticsData }>(
      `/analytics/tasks?${params.toString()}`
    );
    return res.data.data;
  },

  async getAIUsage(from?: string, to?: string): Promise<AIUsageAnalyticsData> {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const res = await api.get<{ status: string; data: AIUsageAnalyticsData }>(
      `/analytics/ai-usage?${params.toString()}`
    );
    return res.data.data;
  },

  /**
   * Downloads authenticated CSV export as a blob.
   * Prevents plain <a> links that fail with 401.
   */
  async downloadCSV(
    type: "requests" | "tasks" | "approvals" | "ai-usage",
    from?: string,
    to?: string
  ): Promise<void> {
    const params = new URLSearchParams({ type });
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    const endpoint = `${baseURL}/analytics/export?${params.toString()}`;

    const executeFetch = async (authToken: string | null) => {
      return fetch(endpoint, {
        method: "GET",
        headers: {
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        credentials: "include",
      });
    };

    let token = getAccessToken();
    let res = await executeFetch(token);

    if (res.status === 401) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        res = await executeFetch(newToken);
      }
    }

    if (!res.ok) {
      throw new Error(`Failed to export CSV (Status ${res.status})`);
    }

    const blob = await res.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    const dateStr = new Date().toISOString().slice(0, 10);
    a.download = `nexusops-${type}-${dateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    window.setTimeout(() => {
      window.URL.revokeObjectURL(objectUrl);
    }, 60000);
  },

  async getDigestSchedule(): Promise<DigestScheduleData | null> {
    const res = await api.get<{ status: string; data: DigestScheduleData | null }>(
      "/analytics/digest/schedule"
    );
    return res.data.data;
  },

  async saveDigestSchedule(payload: SaveDigestSchedulePayload): Promise<DigestScheduleData> {
    const res = await api.put<{ status: string; data: DigestScheduleData }>(
      "/analytics/digest/schedule",
      payload
    );
    return res.data.data;
  },

  async sendTestDigest(recipients?: string[]): Promise<{ success: boolean; deliveryId: string }> {
    const res = await api.post<{ status: string; message: string; data: { success: boolean; deliveryId: string } }>(
      "/analytics/digest/send-test",
      { recipients }
    );
    return res.data.data;
  },

  async getDigestDeliveries(page = 1, limit = 10): Promise<DigestDeliveriesResponse> {
    const res = await api.get<{ status: string; data: DigestDeliveriesResponse }>(
      `/analytics/digest/deliveries?page=${page}&limit=${limit}`
    );
    return res.data.data;
  },
};

export function useAnalyticsOverview(from?: string, to?: string) {
  return useQuery({
    queryKey: ["analytics", "overview", from || "default", to || "default"],
    queryFn: () => analyticsApi.getOverview(from, to),
    staleTime: 60 * 1000,
  });
}

export function useRequestsAnalytics(from?: string, to?: string) {
  return useQuery({
    queryKey: ["analytics", "requests", from || "default", to || "default"],
    queryFn: () => analyticsApi.getRequests(from, to),
    staleTime: 60 * 1000,
  });
}

export function useTasksAnalytics(from?: string, to?: string) {
  return useQuery({
    queryKey: ["analytics", "tasks", from || "default", to || "default"],
    queryFn: () => analyticsApi.getTasks(from, to),
    staleTime: 60 * 1000,
  });
}

export function useAIUsageAnalytics(from?: string, to?: string, enabled = true) {
  return useQuery({
    queryKey: ["analytics", "ai-usage", from || "default", to || "default"],
    queryFn: () => analyticsApi.getAIUsage(from, to),
    enabled,
    staleTime: 60 * 1000,
  });
}

export function useDigestSchedule(enabled = true) {
  return useQuery({
    queryKey: ["analytics", "digest-schedule"],
    queryFn: () => analyticsApi.getDigestSchedule(),
    enabled,
    staleTime: 30 * 1000,
  });
}

export function useDigestDeliveries(page = 1, limit = 10, enabled = true) {
  return useQuery({
    queryKey: ["analytics", "digest-deliveries", page, limit],
    queryFn: () => analyticsApi.getDigestDeliveries(page, limit),
    enabled,
    staleTime: 15 * 1000,
  });
}

export function useSaveDigestSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SaveDigestSchedulePayload) => analyticsApi.saveDigestSchedule(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analytics", "digest-schedule"] });
    },
  });
}

export function useSendTestDigest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (recipients?: string[]) => analyticsApi.sendTestDigest(recipients),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analytics", "digest-deliveries"] });
    },
  });
}
