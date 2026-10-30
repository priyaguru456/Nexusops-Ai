import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationsApi } from "./api";

export const NOTIFICATION_KEYS = {
  all: ["notifications"] as const,
  list: (unreadOnly?: boolean) => [...NOTIFICATION_KEYS.all, "list", { unreadOnly }] as const,
};

export const useNotifications = (unreadOnly = false, limit = 20) => {
  return useQuery({
    queryKey: NOTIFICATION_KEYS.list(unreadOnly),
    queryFn: () => notificationsApi.getNotifications(unreadOnly, limit),
    // Poll every 30 seconds
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
