import { api } from "../../api/client";
import type {
  ExpenseClaim,
  ExpenseSummary,
  ListExpensesResponse,
  GetExpensesParams,
  CreateExpenseClaimPayload,
} from "../../types/expenses";

export interface UploadReceiptResult {
  receiptUrl: string;
  storedFilename?: string;
  originalFilename?: string;
  mimeType?: string;
  sizeBytes?: number;
}

export const expensesApi = {
  getSummary: async (year?: number): Promise<ExpenseSummary> => {
    const res = await api.get<ExpenseSummary>("/expenses/summary", {
      params: year ? { year } : undefined,
    });
    return res.data;
  },

  list: async (params: GetExpensesParams = {}): Promise<ListExpensesResponse> => {
    const res = await api.get<ListExpensesResponse>("/expenses", { params });
    return res.data;
  },

  getById: async (id: string): Promise<ExpenseClaim> => {
    const res = await api.get<ExpenseClaim>(`/expenses/${id}`);
    return res.data;
  },

  create: async (payload: CreateExpenseClaimPayload): Promise<ExpenseClaim> => {
    const res = await api.post<ExpenseClaim>("/expenses", payload);
    return res.data;
  },

  submit: async (id: string): Promise<ExpenseClaim> => {
    const res = await api.post<ExpenseClaim>(`/expenses/${id}/submit`);
    return res.data;
  },

  delete: async (id: string): Promise<{ success: boolean }> => {
    const res = await api.delete<{ success: boolean }>(`/expenses/${id}`);
    return res.data;
  },

  markAsPaid: async (
    id: string,
    paymentReference: string
  ): Promise<ExpenseClaim> => {
    const res = await api.post<ExpenseClaim>(`/expenses/${id}/pay`, {
      paymentReference,
    });
    return res.data;
  },

  uploadReceipt: async (
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<UploadReceiptResult> => {
    const formData = new FormData();
    formData.append("receipt", file);

    const res = await api.post<UploadReceiptResult>(
      "/expenses/upload-receipt",
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total && onProgress) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(percent);
          }
        },
      }
    );
    return res.data;
  },
};
