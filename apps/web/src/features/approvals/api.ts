import { api } from "../../api/client";
import type {
  PendingApprovalsResponse,
  ApproveStepPayload,
  RejectStepPayload,
  ReassignStepPayload,
  ApprovalStepItem,
} from "../../types/approvals";

export const approvalsApi = {
  getPending: async (): Promise<PendingApprovalsResponse> => {
    const res = await api.get<PendingApprovalsResponse>("/approvals/pending");
    return res.data;
  },

  approve: async (
    stepId: string,
    payload: ApproveStepPayload
  ): Promise<{ step: ApprovalStepItem }> => {
    const res = await api.post<{ step: ApprovalStepItem }>(
      `/approvals/${stepId}/approve`,
      payload
    );
    return res.data;
  },

  reject: async (
    stepId: string,
    payload: RejectStepPayload
  ): Promise<{ step: ApprovalStepItem }> => {
    const res = await api.post<{ step: ApprovalStepItem }>(
      `/approvals/${stepId}/reject`,
      payload
    );
    return res.data;
  },

  reassign: async (
    stepId: string,
    payload: ReassignStepPayload
  ): Promise<{ step: ApprovalStepItem }> => {
    const res = await api.post<{ step: ApprovalStepItem }>(
      `/approvals/${stepId}/reassign`,
      payload
    );
    return res.data;
  },
};
