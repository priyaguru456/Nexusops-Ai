import { api } from "../../api/client";
import type { NotificationsResponse, NotificationItem } from "../../types/notifications";

export const notificationsApi = {
  getNotifications: async (unreadOnly = false, limit = 20): Promise<NotificationsResponse> => {
    const res = await api.get<NotificationsResponse>("/notifications", {
      params: { unreadOnly, limit },
    });
    return res.data;
  },

  markAsRead: async (id: string): Promise<{ notification: NotificationItem }> => {
    const res = await api.patch<{ notification: NotificationItem }>(
      `/notifications/${id}/read`
    );
    return res.data;
  },

  markAllAsRead: async (): Promise<{ count: number }> => {
    const res = await api.patch<{ count: number }>("/notifications/read-all");
    return res.data;
  },
};
