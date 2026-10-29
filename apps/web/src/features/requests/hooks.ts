import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchRequests,
  fetchRequestById,
  fetchRequestActivity,
  createRequest,
  updateRequest,
  submitRequest,
  cancelRequest,
  transitionRequestStatus,
  uploadRequestAttachment,
} from "./api";
import type { RequestQueryFilters } from "../../types/requests";
import { useToast } from "../../components/ui/toast";

export function useRequests(filters: RequestQueryFilters) {
  return useQuery({
    queryKey: ["requests", filters],
    queryFn: () => fetchRequests(filters),
  });
}

export function useRequest(id: string) {
  return useQuery({
    queryKey: ["request", id],
    queryFn: () => fetchRequestById(id),
    enabled: Boolean(id),
  });
}

export function useRequestActivity(id: string) {
  return useQuery({
    queryKey: ["request-activity", id],
    queryFn: () => fetchRequestActivity(id),
    enabled: Boolean(id),
  });
}

export function useCreateRequest() {
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  return useMutation({
    mutationFn: (formData: FormData) => createRequest(formData),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      success(`Request "${created.title}" created successfully`);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Failed to create request";
      error(msg);
    },
  });
}

export function useUpdateRequest(id: string) {
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  return useMutation({
    mutationFn: (data: Parameters<typeof updateRequest>[1]) => updateRequest(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["request", id] });
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      queryClient.invalidateQueries({ queryKey: ["request-activity", id] });
      success("Request updated successfully");
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Failed to update request";
      error(msg);
    },
  });
}

export function useSubmitRequest(id: string) {
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  return useMutation({
    mutationFn: () => submitRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["request", id] });
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      queryClient.invalidateQueries({ queryKey: ["request-activity", id] });
      success("Request submitted successfully");
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Failed to submit request";
      error(msg);
    },
  });
}

export function useCancelRequest(id: string) {
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  return useMutation({
    mutationFn: () => cancelRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["request", id] });
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      queryClient.invalidateQueries({ queryKey: ["request-activity", id] });
      success("Request cancelled successfully");
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Failed to cancel request";
      error(msg);
    },
  });
}

export function useTransitionRequestStatus(id: string) {
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  return useMutation({
    mutationFn: ({ status, comment }: { status: string; comment?: string }) =>
      transitionRequestStatus(id, status, comment),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["request", id] });
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      queryClient.invalidateQueries({ queryKey: ["request-activity", id] });
      success(`Request status moved to ${variables.status.replace("_", " ")}`);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Failed to transition request status";
      error(msg);
    },
  });
}

export function useUploadAttachment(id: string) {
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  return useMutation({
    mutationFn: (file: File) => uploadRequestAttachment(id, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["request", id] });
      queryClient.invalidateQueries({ queryKey: ["request-activity", id] });
      success("Attachment uploaded successfully");
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Failed to upload attachment";
      error(msg);
    },
  });
}
