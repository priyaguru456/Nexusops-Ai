export type NotificationType =
  | "APPROVAL_REQUESTED"
  | "APPROVAL_DECISION"
  | "TASK_ASSIGNED"
  | "REQUEST_STATUS_CHANGED"
  | "SYSTEM";

export interface NotificationItem {
  id: string;
  userId: string;
  type: NotificationType;
  message: string;
  link?: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: NotificationItem[];
  unreadCount: number;
}
