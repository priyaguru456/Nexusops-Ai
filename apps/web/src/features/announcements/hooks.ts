import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { announcementsApi } from "./api";
import type {
  AnnouncementFilters,
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
} from "../../types/announcements";

export const ANNOUNCEMENT_KEYS = {
  all: ["announcements"] as const,
  lists: () => [...ANNOUNCEMENT_KEYS.all, "list"] as const,
  list: (filters: AnnouncementFilters) => [...ANNOUNCEMENT_KEYS.lists(), filters] as const,
  unread: () => [...ANNOUNCEMENT_KEYS.all, "unread"] as const,
  details: () => [...ANNOUNCEMENT_KEYS.all, "detail"] as const,
  detail: (id: string) => [...ANNOUNCEMENT_KEYS.details(), id] as const,
  stats: (id: string) => [...ANNOUNCEMENT_KEYS.all, "stats", id] as const,
};

export function useAnnouncements(filters: AnnouncementFilters = {}) {
  return useQuery({
    queryKey: ANNOUNCEMENT_KEYS.list(filters),
    queryFn: () => announcementsApi.getAnnouncements(filters),
  });
}

export function useUnreadAnnouncements(limit = 3) {
  return useQuery({
    queryKey: [...ANNOUNCEMENT_KEYS.unread(), limit],
    queryFn: () => announcementsApi.getUnreadAnnouncements(limit),
  });
}

export function useAnnouncement(id: string | null | undefined) {
  return useQuery({
    queryKey: ANNOUNCEMENT_KEYS.detail(id || ""),
    queryFn: () => announcementsApi.getAnnouncementById(id!),
    enabled: Boolean(id),
  });
}

export function useAnnouncementReadStats(id: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ANNOUNCEMENT_KEYS.stats(id || ""),
    queryFn: () => announcementsApi.getReadStats(id!),
    enabled: Boolean(id) && enabled,
  });
}

export function useDepartments() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: () => announcementsApi.getDepartments(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAnnouncementInput) => announcementsApi.createAnnouncement(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ANNOUNCEMENT_KEYS.all });
    },
  });
}

export function useUpdateAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateAnnouncementInput }) =>
      announcementsApi.updateAnnouncement(id, input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ANNOUNCEMENT_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ANNOUNCEMENT_KEYS.detail(variables.id) });
    },
  });
}

export function useDeleteAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => announcementsApi.deleteAnnouncement(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ANNOUNCEMENT_KEYS.all });
    },
  });
}

export function useMarkAnnouncementAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => announcementsApi.markAsRead(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ANNOUNCEMENT_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ANNOUNCEMENT_KEYS.detail(id) });
    },
  });
}
