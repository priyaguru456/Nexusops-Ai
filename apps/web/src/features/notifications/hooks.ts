import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationsApi } from "./api";

export const NOTIFICATION_KEYS = {
  all: ["notifications"] as const,
  list: (unreadOnly = false, limit = 20, page = 1) =>
    [...NOTIFICATION_KEYS.all, "list", { unreadOnly, limit, page }] as const,
  unreadCount: () => [...NOTIFICATION_KEYS.all, "unreadCount"] as const,
};

export const useNotifications = (unreadOnly = false, limit = 20, page = 1) => {
  return useQuery({
    queryKey: NOTIFICATION_KEYS.list(unreadOnly, limit, page),
    queryFn: () => notificationsApi.getNotifications(page, limit, unreadOnly),
    // Poll every 30 seconds for real-time responsiveness
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });
};

export const useUnreadNotificationCount = () => {
  return useQuery({
    queryKey: NOTIFICATION_KEYS.unreadCount(),
    queryFn: () => notificationsApi.getUnreadCount(),
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });
};

export const useMarkNotificationAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => notificationsApi.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.all });
    },
  });
};

export const useMarkAllNotificationsAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => notificationsApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.all });
    },
  });
};
