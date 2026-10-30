import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { approvalsApi } from "./api";
import { useToast } from "../../components/ui/toast";
import type { ApproveStepPayload, RejectStepPayload, ReassignStepPayload } from "../../types/approvals";

export const APPROVAL_KEYS = {
  all: ["approvals"] as const,
  pending: () => [...APPROVAL_KEYS.all, "pending"] as const,
};

export const usePendingApprovals = () => {
  return useQuery({
    queryKey: APPROVAL_KEYS.pending(),
    queryFn: () => approvalsApi.getPending(),
  });
};

export const useApproveStep = () => {
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  return useMutation({
    mutationFn: ({ stepId, payload }: { stepId: string; payload: ApproveStepPayload }) =>
      approvalsApi.approve(stepId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: APPROVAL_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      success("Approval recorded successfully.", "Step Approved");
    },
    onError: (err: any) => {
      error(err.response?.data?.error || "Could not approve this step.", "Approval Failed");
    },
  });
};

export const useRejectStep = () => {
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  return useMutation({
    mutationFn: ({ stepId, payload }: { stepId: string; payload: RejectStepPayload }) =>
      approvalsApi.reject(stepId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: APPROVAL_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      success("The rejection decision has been recorded.", "Request Rejected");
    },
    onError: (err: any) => {
      error(err.response?.data?.error || "Could not reject this step.", "Rejection Failed");
    },
  });
};

export const useReassignStep = () => {
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  return useMutation({
    mutationFn: ({ stepId, payload }: { stepId: string; payload: ReassignStepPayload }) =>
      approvalsApi.reassign(stepId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: APPROVAL_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      success("Approver updated successfully.", "Step Delegated");
    },
    onError: (err: any) => {
      error(err.response?.data?.error || "Could not reassign this step.", "Reassignment Failed");
    },
  });
};
