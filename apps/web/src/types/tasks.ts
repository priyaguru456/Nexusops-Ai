import type { Priority } from "./requests";
import type { Role } from "./auth";

export type TaskStatus = "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";

export interface TaskItem {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  requestId: string | null;
  assigneeId: string | null;
  assignedById: string | null;
  assignee?: {
    id: string;
    name: string;
    email: string;
    role: Role;
    departmentId: string | null;
  } | null;
  assignedBy?: {
    id: string;
    name: string;
    email: string;
    role: Role;
  } | null;
  request?: {
    id: string;
    title: string;
    status: string;
    category: string;
    requesterId: string;
    requester: {
      departmentId: string | null;
    };
  } | null;
}

export interface TaskQueryFilters {
  status?: TaskStatus | "";
  priority?: Priority | "";
  assigneeId?: string;
  requestId?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: "createdAt" | "title" | "priority" | "status" | "dueDate";
  sortOrder?: "asc" | "desc";
}

export interface PaginatedTasksResponse {
  tasks: TaskItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
