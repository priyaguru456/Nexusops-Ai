import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchTasks, fetchTaskById, createTask, updateTask, assignTask } from "./api";
import type { TaskQueryFilters } from "../../types/tasks";
import { useToast } from "../../components/ui/toast";

export function useTasks(filters: TaskQueryFilters) {
  return useQuery({
    queryKey: ["tasks", filters],
    queryFn: () => fetchTasks(filters),
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: ["task", id],
    queryFn: () => fetchTaskById(id),
    enabled: Boolean(id),
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  return useMutation({
    mutationFn: (data: Parameters<typeof createTask>[0]) => createTask(data),
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      success(`Task "${task.title}" created successfully`);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Failed to create task";
      error(msg);
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateTask>[1] }) =>
      updateTask(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task"] });
      success("Task updated");
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Failed to update task";
      error(msg);
    },
  });
}

export function useAssignTask() {
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  return useMutation({
    mutationFn: ({ id, assigneeId }: { id: string; assigneeId: string | null }) =>
      assignTask(id, assigneeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task"] });
      success("Task assignment updated");
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Failed to assign task";
      error(msg);
    },
  });
}
