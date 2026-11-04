import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { approvalsApi } from "./api";
import { useToast } from "../../components/ui/toast";
import type {
  ApproveStepPayload,
  RejectStepPayload,
  ReassignStepPayload,
  BulkApprovePayload,
} from "../../types/approvals";

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
      queryClient.invalidateQueries({ queryKey: APPROVAL_KEYS.all });
      if (err.response?.status === 409) {
        error(
          err.response?.data?.error || "This item was already decided by another approver.",
          "Already Decided"
        );
      } else {
        error(err.response?.data?.error || "Could not approve this step.", "Approval Failed");
      }
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
      queryClient.invalidateQueries({ queryKey: APPROVAL_KEYS.all });
      if (err.response?.status === 409) {
        error(
          err.response?.data?.error || "This item was already decided by another approver.",
          "Already Decided"
        );
      } else {
        error(err.response?.data?.error || "Could not reject this step.", "Rejection Failed");
      }
    },
  });
};

export const useBulkApprove = () => {
  const queryClient = useQueryClient();
  const { success, error } = useToast();

  return useMutation({
    mutationFn: (payload: BulkApprovePayload) => approvalsApi.bulkApprove(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: APPROVAL_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });

      if (data.summary.failed === 0) {
        success(
          `Successfully approved all ${data.summary.succeeded} selected requests.`,
          "Bulk Approval Successful"
        );
      } else if (data.summary.succeeded === 0) {
        error(
          `Failed to approve ${data.summary.failed} selected items.`,
          "Bulk Approval Failed"
        );
      } else {
        success(
          `Approved ${data.summary.succeeded} items. ${data.summary.failed} could not be approved.`,
          "Bulk Approval Partial"
        );
      }
    },
    onError: (err: any) => {
      queryClient.invalidateQueries({ queryKey: APPROVAL_KEYS.all });
      error(
        err.response?.data?.error || "Could not complete bulk approval operation.",
        "Bulk Approval Error"
      );
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
