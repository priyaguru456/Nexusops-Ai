import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchComments, createComment } from "./api";
import { useToast } from "../../components/ui/toast";

export function useComments(entityType: string, entityId: string) {
  return useQuery({
    queryKey: ["comments", entityType, entityId],
    queryFn: () => fetchComments(entityType, entityId),
    enabled: Boolean(entityType && entityId),
  });
}

export function useCreateComment(entityType: string, entityId: string) {
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  return useMutation({
    mutationFn: (body: string) => createComment({ entityType, entityId, body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", entityType, entityId] });
      success("Comment posted successfully");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed to post comment";
      error(msg);
    },
  });
}
