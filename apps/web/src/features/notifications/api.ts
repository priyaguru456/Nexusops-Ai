import { api } from "../../api/client";
import type { NotificationsResponse, NotificationItem } from "../../types/notifications";

export const notificationsApi = {
  getNotifications: async (
    page = 1,
    limit = 20,
    unreadOnly = false
  ): Promise<NotificationsResponse> => {
    const res = await api.get<NotificationsResponse>("/notifications", {
      params: { page, limit, unreadOnly },
    });
    return res.data;
  },

  getUnreadCount: async (): Promise<{ unreadCount: number }> => {
    const res = await api.get<{ unreadCount: number }>("/notifications/unread-count");
    return res.data;
  },

  markAsRead: async (id: string): Promise<{ success: boolean; notification: NotificationItem }> => {
    const res = await api.patch<{ success: boolean; notification: NotificationItem }>(
      `/notifications/${id}/read`
    );
    return res.data;
  },

  markAllAsRead: async (): Promise<{ success: boolean; count: number }> => {
    const res = await api.patch<{ success: boolean; count: number }>("/notifications/read-all");
    return res.data;
  },
};
