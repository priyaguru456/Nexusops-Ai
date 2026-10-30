import api from "../../api/client";
import type {
  DocumentItem,
  DocumentListResponse,
  UploadDocumentPayload,
  DocStatus,
  DocVisibility,
} from "../../types/documents";

export interface DocumentQueryParams {
  search?: string;
  category?: string;
  status?: DocStatus | "";
  visibility?: DocVisibility | "";
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export const documentsApi = {
  async getDocuments(params?: DocumentQueryParams): Promise<DocumentListResponse> {
    const res = await api.get<DocumentListResponse>("/documents", { params });
    return res.data;
  },

  async getDocumentById(id: string): Promise<DocumentItem> {
    const res = await api.get<{ document: DocumentItem }>(`/documents/${id}`);
    return res.data.document;
  },

  async uploadDocument(payload: UploadDocumentPayload): Promise<DocumentItem> {
    const formData = new FormData();
    formData.append("file", payload.file);
    if (payload.title) formData.append("title", payload.title);
    if (payload.category) formData.append("category", payload.category);
    if (payload.visibility) formData.append("visibility", payload.visibility);
    if (payload.version) formData.append("version", String(payload.version));

    const res = await api.post<{ status: string; document: DocumentItem }>("/documents", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return res.data.document;
  },

  async downloadDocument(id: string, fileName: string): Promise<void> {
    const response = await api.get(`/documents/${id}/file`, {
      responseType: "blob",
    });

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  async reprocessDocument(id: string): Promise<DocumentItem> {
    const res = await api.post<{ status: string; document: DocumentItem }>(`/documents/${id}/reprocess`);
    return res.data.document;
  },

  async deleteDocument(id: string): Promise<void> {
    await api.delete(`/documents/${id}`);
  },
};
