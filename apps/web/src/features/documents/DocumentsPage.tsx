import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Upload,
  RefreshCw,
  Search,
  Download,
  RotateCcw,
  Trash2,
  AlertCircle,
  Layers,
  FolderOpen,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../../components/ui/toast";
import { Button } from "../../components/ui/button";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { Badge } from "../../components/ui/badge";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { UploadDocumentModal } from "./UploadDocumentModal";
import { documentsApi, type DocumentQueryParams } from "./api";
import type { DocumentItem, DocStatus, DocVisibility } from "../../types/documents";

export function DocumentsPage(): React.JSX.Element {
  const { role } = useAuth();
  const { success: showSuccess, error: showError, info: showInfo } = useToast();
  const isAdmin = role === "ADMIN";

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters state
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<DocStatus | "">("");
  const [visibility, setVisibility] = useState<DocVisibility | "">("");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Modals state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<DocumentItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);
  const [selectedErrorDoc, setSelectedErrorDoc] = useState<DocumentItem | null>(null);

  const pollingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchDocuments = useCallback(
    async (showLoadingSpinner = true) => {
      if (showLoadingSpinner) setIsLoading(true);
      try {
        const query: DocumentQueryParams = {
          page,
          limit,
          sortBy,
          sortOrder,
          search: search.trim() || undefined,
          category: category.trim() || undefined,
          status: status || undefined,
          visibility: visibility || undefined,
        };

        const res = await documentsApi.getDocuments(query);
        setDocuments(res.documents);
        setTotal(res.pagination.total);
        setTotalPages(res.pagination.totalPages || 1);
      } catch (err: any) {
        showError(
          err?.response?.data?.message || err?.message || "Error loading documents.",
          "Failed to load documents"
        );
      } finally {
        if (showLoadingSpinner) setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [page, limit, sortBy, sortOrder, search, category, status, visibility, showError]
  );

  // Initial load and whenever filters change
  useEffect(() => {
    fetchDocuments(true);
  }, [fetchDocuments]);

  // Polling logic: automatically polls every 3 seconds if any document is in UPLOADED or PROCESSING state
  useEffect(() => {
    const hasActiveJobs = documents.some(
      (d) => d.status === "UPLOADED" || d.status === "PROCESSING"
    );

    if (hasActiveJobs) {
      pollingTimerRef.current = setTimeout(() => {
        fetchDocuments(false);
      }, 3000);
    }

    return () => {
      if (pollingTimerRef.current) {
        clearTimeout(pollingTimerRef.current);
      }
    };
  }, [documents, fetchDocuments]);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    fetchDocuments(false);
  };

  const handleResetFilters = () => {
    setSearch("");
    setCategory("");
    setStatus("");
    setVisibility("");
    setPage(1);
    setSortBy("createdAt");
    setSortOrder("desc");
  };

  const handleSort = (columnKey: string) => {
    if (sortBy === columnKey) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(columnKey);
      setSortOrder("desc");
    }
    setPage(1);
  };

  const handleDownload = async (doc: DocumentItem) => {
    try {
      await documentsApi.downloadDocument(doc.id, doc.fileName);
      showInfo(`Downloading "${doc.fileName}".`, "Download Started");
    } catch (err: any) {
      showError(
        err?.response?.data?.message || "Failed to download document.",
        "Download Failed"
      );
    }
  };

  const handleReprocess = async (doc: DocumentItem) => {
    setReprocessingId(doc.id);
    try {
      const updated = await documentsApi.reprocessDocument(doc.id);
      setDocuments((prev) => prev.map((d) => (d.id === doc.id ? updated : d)));
      showSuccess(
        `Existing chunks cleared. Processing queued for "${doc.title}".`,
        "Reprocess Scheduled"
      );
      // Trigger background poll to catch pipeline state changes
      fetchDocuments(false);
    } catch (err: any) {
      showError(
        err?.response?.data?.message || "Failed to reprocess document.",
        "Reprocess Failed"
      );
    } finally {
      setReprocessingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!docToDelete) return;
    setIsDeleting(true);
    try {
      await documentsApi.deleteDocument(docToDelete.id);
      showSuccess(
        `"${docToDelete.title}" and its chunks were deleted.`,
        "Document Deleted"
      );
      setDocToDelete(null);
      fetchDocuments(false);
    } catch (err: any) {
      showError(
        err?.response?.data?.message || "Failed to delete document.",
        "Delete Failed"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const columns: Column<DocumentItem>[] = [
    {
      key: "title",
      header: "Document",
      sortable: true,
      render: (doc) => (
        <div className="max-w-xs sm:max-w-md">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900 dark:text-slate-100 line-clamp-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              {doc.title}
            </span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
              v{doc.version}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
            <span className="truncate">{doc.fileName}</span>
            <span>•</span>
            <span className="shrink-0">{formatFileSize(doc.sizeBytes)}</span>
          </div>
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      sortable: false,
      render: (doc) => (
        <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
          {doc.category || "General"}
        </span>
      ),
    },
    {
      key: "visibility",
      header: "Visibility",
      sortable: false,
      render: (doc) => {
        let variant: "default" | "warning" | "destructive" | "outline" = "outline";
        if (doc.visibility === "ADMIN_ONLY") variant = "destructive";
        if (doc.visibility === "MANAGERS") variant = "warning";
        if (doc.visibility === "DEPARTMENT") variant = "default";
        return (
          <Badge variant={variant} className="text-[11px] font-semibold py-0.5">
            {doc.visibility}
          </Badge>
        );
      },
    },
    {
      key: "status",
      header: "Ingestion Status",
      sortable: true,
      render: (doc) => (
        <div>
          <StatusBadge status={doc.status} size="sm" />
          {doc.status === "FAILED" && doc.errorMessage && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedErrorDoc(doc);
              }}
              className="mt-1 flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
            >
              <AlertCircle className="w-3 h-3" />
              <span>View error</span>
            </button>
          )}
        </div>
      ),
    },
    {
      key: "chunks",
      header: "Chunks",
      sortable: false,
      render: (doc) => (
        <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-medium">{doc._count?.chunks ?? 0}</span>
        </div>
      ),
    },
    {
      key: "createdAt",
      header: "Uploaded",
      sortable: true,
      render: (doc) => (
        <div className="text-xs text-slate-500">
          <div>{new Date(doc.createdAt).toLocaleDateString()}</div>
          <div className="text-[11px] text-slate-400 truncate max-w-[120px]">
            {doc.uploadedBy?.name || "Admin"}
          </div>
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (doc) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          {/* Download File */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDownload(doc)}
            title="Download original file"
            className="h-8 w-8 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <Download className="w-4 h-4" />
          </Button>

          {/* Reprocess Ingestion Pipeline */}
          <Button
            variant="ghost"
            size="icon"
            disabled={reprocessingId === doc.id || doc.status === "PROCESSING"}
            onClick={() => handleReprocess(doc)}
            title="Re-extract and chunk document"
            className="h-8 w-8 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
          >
            <RotateCcw
              className={`w-4 h-4 ${reprocessingId === doc.id ? "animate-spin" : ""}`}
            />
          </Button>

          {/* Delete Document (Admin Only) */}
          {isAdmin && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDocToDelete(doc)}
              title="Delete document and chunks"
              className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Knowledge Base & Documents
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Manage organizational documents, RAG chunking status, and ingestion pipeline
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="gap-2 text-slate-600 dark:text-slate-300"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>

          {isAdmin && (
            <Button
              size="sm"
              onClick={() => setUploadModalOpen(true)}
              className="gap-2 shadow-sm"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Document</span>
            </Button>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by title or filename..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as DocStatus | "");
                setPage(1);
              }}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Ingestion Statuses</option>
              <option value="UPLOADED">UPLOADED</option>
              <option value="PROCESSING">PROCESSING</option>
              <option value="READY">READY</option>
              <option value="FAILED">FAILED</option>
            </select>
          </div>

          {/* Visibility Filter */}
          <div>
            <select
              value={visibility}
              onChange={(e) => {
                setVisibility(e.target.value as DocVisibility | "");
                setPage(1);
              }}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Visibility Levels</option>
              <option value="ALL">ALL (Company Wide)</option>
              <option value="DEPARTMENT">DEPARTMENT</option>
              <option value="MANAGERS">MANAGERS</option>
              <option value="ADMIN_ONLY">ADMIN_ONLY</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <input
              type="text"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              placeholder="Filter by category (e.g. HR)..."
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {(search || category || status || visibility) && (
          <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-xs">
            <span className="text-slate-500">Filtered results active</span>
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            >
              Reset all filters
            </button>
          </div>
        )}
      </div>

      {/* Document DataTable */}
      <DataTable
        columns={columns}
        data={documents}
        keyExtractor={(doc) => doc.id}
        isLoading={isLoading}
        emptyTitle="No documents in knowledge base"
        emptyDescription={
          isAdmin
            ? "Upload PDF, DOCX, TXT, or Markdown documents to begin AI RAG vector ingestion."
            : "No documents currently match your access visibility or search filters."
        }
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
      />

      {/* Upload Modal (Admin only) */}
      <UploadDocumentModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onSuccess={() => fetchDocuments(false)}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!docToDelete}
        title="Delete Document"
        description={`Are you sure you want to delete "${docToDelete?.title}"? This action will permanently remove the stored file, parsed text chunks, and vector embeddings.`}
        confirmLabel="Delete"
        variant="destructive"
        isLoading={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => setDocToDelete(null)}
      />

      {/* Failure Error Message Modal */}
      {selectedErrorDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setSelectedErrorDoc(null)}
          />
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl z-10">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Ingestion Failure Details
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Document: {selectedErrorDoc.title}
                </p>
                <div className="mt-3 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs font-mono text-rose-800 dark:text-rose-200 break-words whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {selectedErrorDoc.errorMessage || "Unknown extraction failure"}
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedErrorDoc(null)}
              >
                Close
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const doc = selectedErrorDoc;
                  setSelectedErrorDoc(null);
                  handleReprocess(doc);
                }}
                className="gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry Reprocess</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
