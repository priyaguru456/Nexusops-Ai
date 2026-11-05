import type { Role } from "./auth";

export type AnnouncementPriority = "NORMAL" | "URGENT";

export interface AnnouncementAuthor {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface AnnouncementDepartment {
  id: string;
  name: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: AnnouncementPriority;
  targetDepartmentId: string | null;
  targetDepartment?: AnnouncementDepartment | null;
  authorId: string;
  author: AnnouncementAuthor;
  isPinned: boolean;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  isRead: boolean;
  readAt: string | null;
  readCount: number;
  totalTargetUsers?: number;
}

export interface AnnouncementReader {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: Role;
  departmentName: string;
  readAt: string;
}

export interface AnnouncementReadStats {
  readCount: number;
  totalTargetUsers: number;
  percentage: number;
  readers: AnnouncementReader[];
}

export interface AnnouncementsResponse {
  items: Announcement[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  unreadCount: number;
}

export interface CreateAnnouncementInput {
  title: string;
  content: string;
  priority: AnnouncementPriority;
  targetDepartmentId?: string | null;
  isPinned?: boolean;
  expiresAt?: string | null;
}

export interface UpdateAnnouncementInput {
  title?: string;
  content?: string;
  priority?: AnnouncementPriority;
  targetDepartmentId?: string | null;
  isPinned?: boolean;
  expiresAt?: string | null;
}

export interface AnnouncementFilters {
  page?: number;
  limit?: number;
  search?: string;
  unreadOnly?: boolean;
  priority?: AnnouncementPriority;
  pinnedOnly?: boolean;
}
