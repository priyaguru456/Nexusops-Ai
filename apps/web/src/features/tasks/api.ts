import { api } from "../../api/client";
import type { TaskItem, TaskQueryFilters, PaginatedTasksResponse } from "../../types/tasks";

export async function fetchTasks(filters: TaskQueryFilters): Promise<PaginatedTasksResponse> {
  const cleanParams: Record<string, unknown> = {};
  Object.entries(filters).forEach(([key, val]) => {
    if (val !== undefined && val !== "") {
      cleanParams[key] = val;
    }
  });

  const res = await api.get<PaginatedTasksResponse>("/tasks", {
    params: cleanParams,
  });
  return res.data;
}

export async function fetchTaskById(id: string): Promise<TaskItem> {
  const res = await api.get<{ task: TaskItem }>(`/tasks/${id}`);
  return res.data.task;
}

export async function createTask(data: {
  title: string;
  description?: string | null;
  priority?: string;
  status?: string;
  dueDate?: string | null;
  requestId?: string | null;
  assigneeId?: string | null;
}): Promise<TaskItem> {
  const res = await api.post<{ task: TaskItem }>("/tasks", data);
  return res.data.task;
}

export async function updateTask(
  id: string,
  data: {
    title?: string;
    description?: string | null;
    priority?: string;
    status?: string;
    dueDate?: string | null;
  }
): Promise<TaskItem> {
  const res = await api.patch<{ task: TaskItem }>(`/tasks/${id}`, data);
  return res.data.task;
}

export async function assignTask(id: string, assigneeId: string | null): Promise<TaskItem> {
  const res = await api.patch<{ task: TaskItem }>(`/tasks/${id}/assign`, { assigneeId });
  return res.data.task;
}
