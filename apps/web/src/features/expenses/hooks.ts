import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { expensesApi } from "./api";
import { useToast } from "../../components/ui/toast";
import type {
  GetExpensesParams,
  CreateExpenseClaimPayload,
} from "../../types/expenses";

export const EXPENSE_KEYS = {
  all: ["expenses"] as const,
  summaries: () => [...EXPENSE_KEYS.all, "summary"] as const,
  summary: (year?: number) => [...EXPENSE_KEYS.summaries(), year] as const,
  lists: () => [...EXPENSE_KEYS.all, "list"] as const,
  list: (params: GetExpensesParams) => [...EXPENSE_KEYS.lists(), params] as const,
  details: () => [...EXPENSE_KEYS.all, "detail"] as const,
  detail: (id: string) => [...EXPENSE_KEYS.details(), id] as const,
};

export function useExpenseSummary(year?: number) {
  return useQuery({
    queryKey: EXPENSE_KEYS.summary(year),
    queryFn: () => expensesApi.getSummary(year),
  });
}

export function useExpensesList(params: GetExpensesParams) {
  return useQuery({
    queryKey: EXPENSE_KEYS.list(params),
    queryFn: () => expensesApi.list(params),
  });
}

export function useExpenseDetail(id: string | undefined) {
  return useQuery({
    queryKey: EXPENSE_KEYS.detail(id || ""),
    queryFn: () => expensesApi.getById(id!),
    enabled: Boolean(id),
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  const { show } = useToast();
  const toast = ({ title, description, variant }: { title?: string; description?: string; variant?: string }) => {
    show(variant === "destructive" ? "error" : "success", description || "", title);
  };

  return useMutation({
    mutationFn: (payload: CreateExpenseClaimPayload) => expensesApi.create(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: EXPENSE_KEYS.all });
      toast({
        title: data.status === "SUBMITTED" ? "Expense Report Submitted" : "Draft Saved",
        description: `Expense claim "${data.title}" was saved successfully.`,
        variant: "default",
      });
    },
    onError: (err: any) => {
      const message = err?.response?.data?.message || err?.message || "Failed to save expense claim";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
  });
}

export function useSubmitExpense() {
  const queryClient = useQueryClient();
  const { show } = useToast();
  const toast = ({ title, description, variant }: { title?: string; description?: string; variant?: string }) => {
    show(variant === "destructive" ? "error" : "success", description || "", title);
  };

  return useMutation({
    mutationFn: (id: string) => expensesApi.submit(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: EXPENSE_KEYS.all });
      toast({
        title: "Claim Submitted for Approval",
        description: `Expense claim "${data.title}" has been submitted into the approval workflow.`,
        variant: "default",
      });
    },
    onError: (err: any) => {
      const message = err?.response?.data?.message || err?.message || "Failed to submit expense claim";
      toast({
        title: "Submission Failed",
        description: message,
        variant: "destructive",
      });
    },
  });
}

export function useMarkAsPaid() {
  const queryClient = useQueryClient();
  const { show } = useToast();
  const toast = ({ title, description, variant }: { title?: string; description?: string; variant?: string }) => {
    show(variant === "destructive" ? "error" : "success", description || "", title);
  };

  return useMutation({
    mutationFn: ({ id, paymentReference }: { id: string; paymentReference: string }) =>
      expensesApi.markAsPaid(id, paymentReference),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: EXPENSE_KEYS.all });
      toast({
        title: "Reimbursement Recorded",
        description: `Claim "${data.title}" marked as paid. Reference: ${data.paymentReference}`,
        variant: "default",
      });
    },
    onError: (err: any) => {
      const message = err?.response?.data?.message || err?.message || "Failed to mark claim as paid";
      toast({
        title: "Payment Recording Failed",
        description: message,
        variant: "destructive",
      });
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  const { show } = useToast();
  const toast = ({ title, description, variant }: { title?: string; description?: string; variant?: string }) => {
    show(variant === "destructive" ? "error" : "success", description || "", title);
  };

  return useMutation({
    mutationFn: (id: string) => expensesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EXPENSE_KEYS.all });
      toast({
        title: "Draft Deleted",
        description: "The draft expense report has been deleted.",
        variant: "default",
      });
    },
    onError: (err: any) => {
      const message = err?.response?.data?.message || err?.message || "Failed to delete claim";
      toast({
        title: "Delete Failed",
        description: message,
        variant: "destructive",
      });
    },
  });
}
