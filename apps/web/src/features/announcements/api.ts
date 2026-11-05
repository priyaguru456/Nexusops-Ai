import { api } from "../../api/client";
import type {
  Announcement,
  AnnouncementsResponse,
  AnnouncementFilters,
  AnnouncementReadStats,
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
} from "../../types/announcements";

export const announcementsApi = {
  getAnnouncements: async (filters: AnnouncementFilters = {}): Promise<AnnouncementsResponse> => {
    const res = await api.get<AnnouncementsResponse>("/announcements", {
      params: filters,
    });
    return res.data;
  },

  getUnreadAnnouncements: async (limit = 3): Promise<{ items: Announcement[] }> => {
    const res = await api.get<{ items: Announcement[] }>("/announcements/unread", {
      params: { limit },
    });
    return res.data;
  },

  getAnnouncementById: async (id: string): Promise<Announcement> => {
    const res = await api.get<Announcement>(`/announcements/${id}`);
    return res.data;
  },

  createAnnouncement: async (input: CreateAnnouncementInput): Promise<Announcement> => {
    const res = await api.post<Announcement>("/announcements", input);
    return res.data;
  },

  updateAnnouncement: async (
    id: string,
    input: UpdateAnnouncementInput
  ): Promise<Announcement> => {
    const res = await api.patch<Announcement>(`/announcements/${id}`, input);
    return res.data;
  },

  deleteAnnouncement: async (id: string): Promise<{ success: boolean }> => {
    const res = await api.delete<{ success: boolean }>(`/announcements/${id}`);
    return res.data;
  },

  markAsRead: async (id: string): Promise<{ success: boolean; readAt: string }> => {
    const res = await api.post<{ success: boolean; readAt: string }>(`/announcements/${id}/read`);
    return res.data;
  },

  getReadStats: async (id: string): Promise<AnnouncementReadStats> => {
    const res = await api.get<AnnouncementReadStats>(`/announcements/${id}/read-stats`);
    return res.data;
  },

  getDepartments: async (): Promise<{ departments: { id: string; name: string }[] }> => {
    const res = await api.get<{ departments: { id: string; name: string }[] }>(
      "/announcements/departments"
    );
    return res.data;
  },
};
