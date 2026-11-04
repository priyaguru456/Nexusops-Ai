export type NotificationType =
  | "APPROVAL_REQUESTED"
  | "APPROVAL_DECISION"
  | "APPROVAL_ESCALATED"
  | "APPROVAL_REMINDER"
  | "TASK_ASSIGNED"
  | "REQUEST_STATUS_CHANGED"
  | "SYSTEM";

export interface NotificationItem {
  id: string;
  userId: string;
  type: NotificationType | string;
  title: string;
  message: string;
  link?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: NotificationItem[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  unreadCount: number;
}
