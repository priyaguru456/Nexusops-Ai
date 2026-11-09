import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Plus,
  Trash2,
  UploadCloud,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Receipt,
  FileCheck,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { formatINR } from "../../lib/utils";
import { useCreateExpense } from "./hooks";
import { expensesApi } from "./api";
import type { ExpenseCategory, CreateExpenseItemDraft } from "../../types/expenses";

interface NewExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface ItemUploadState {
  isUploading: boolean;
  progress: number;
  error: string | null;
}

const CATEGORIES: { label: string; value: ExpenseCategory }[] = [
  { label: "Travel & Commute", value: "TRAVEL" },
  { label: "Meals & Food", value: "MEALS" },
  { label: "Software & Cloud", value: "SOFTWARE" },
  { label: "Office Supplies", value: "OFFICE" },
  { label: "Other / General", value: "OTHER" },
];

export function NewExpenseModal({
  isOpen,
  onClose,
  onSuccess,
}: NewExpenseModalProps): React.JSX.Element | null {
  const [title, setTitle] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];

  const [items, setItems] = useState<CreateExpenseItemDraft[]>([
    {
      category: "TRAVEL",
      amountRupees: "",
      description: "",
      date: today,
    },
  ]);

  const [itemUploads, setItemUploads] = useState<Record<number, ItemUploadState>>({});
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const createExpenseMutation = useCreateExpense();
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle("");
      setTitleError(null);
      setItems([
        {
          category: "TRAVEL",
          amountRupees: "",
          description: "",
          date: today,
        },
      ]);
      setItemUploads({});
      setDragOverIndex(null);
      setTimeout(() => titleInputRef.current?.focus(), 50);
    }
  }, [isOpen, today]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !createExpenseMutation.isPending) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, createExpenseMutation.isPending]);

  if (!isOpen) return null;

  // Auto-calculated total in minor units (paise)
  const autoTotalPaise = items.reduce((sum, item) => {
    const num = parseFloat(String(item.amountRupees || "0"));
    if (isNaN(num) || num <= 0) return sum;
    return sum + Math.round(num * 100);
  }, 0);

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        category: "MEALS",
        amountRupees: "",
        description: "",
        date: today,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
    setItemUploads((prev) => {
      const copy = { ...prev };
      delete copy[index];
      return copy;
    });
  };

  const handleItemChange = <K extends keyof CreateExpenseItemDraft>(
    index: number,
    field: K,
    value: CreateExpenseItemDraft[K]
  ) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleFileUpload = async (index: number, file: File) => {
    // Client validation
    const ext = file.name.split(".").pop()?.toLowerCase();
    const validExts = ["pdf", "jpg", "jpeg", "png"];
    if (!ext || !validExts.includes(ext)) {
      setItemUploads((prev) => ({
        ...prev,
        [index]: {
          isUploading: false,
          progress: 0,
          error: "Invalid file format. Allowed: PDF, JPG, PNG.",
        },
      }));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setItemUploads((prev) => ({
        ...prev,
        [index]: {
          isUploading: false,
          progress: 0,
          error: "File size exceeds 5 MB limit.",
        },
      }));
      return;
    }

    setItemUploads((prev) => ({
      ...prev,
      [index]: { isUploading: true, progress: 10, error: null },
    }));

    try {
      const result = await expensesApi.uploadReceipt(file, (progress) => {
        setItemUploads((prev) => ({
          ...prev,
          [index]: { isUploading: true, progress, error: null },
        }));
      });

      handleItemChange(index, "receiptUrl", result.receiptUrl);
      handleItemChange(index, "receiptName", file.name);

      setItemUploads((prev) => ({
        ...prev,
        [index]: { isUploading: false, progress: 100, error: null },
      }));
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || err?.message || "Failed to upload receipt";
      setItemUploads((prev) => ({
        ...prev,
        [index]: { isUploading: false, progress: 0, error: msg },
      }));
    }
  };

  const validateForm = (): boolean => {
    let valid = true;
    if (!title.trim() || title.trim().length < 3) {
      setTitleError("Report title must be at least 3 characters");
      valid = false;
    } else {
      setTitleError(null);
    }

    for (let i = 0; i < items.length; i++) {
      const amt = parseFloat(String(items[i].amountRupees || "0"));
      if (isNaN(amt) || amt <= 0) {
        valid = false;
      }
    }

    return valid;
  };

  const handleSubmit = async (submitImmediately: boolean) => {
    if (!validateForm()) return;

    const payloadItems = items.map((it) => ({
      category: it.category,
      amount: Math.round(parseFloat(String(it.amountRupees || "0")) * 100),
      description: it.description?.trim() || undefined,
      date: it.date || today,
      receiptUrl: it.receiptUrl || undefined,
    }));

    try {
      await createExpenseMutation.mutateAsync({
        title: title.trim(),
        items: payloadItems,
        submitImmediately,
      });
      onSuccess?.();
      onClose();
    } catch {
      // Toast displayed by mutation
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-expense-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !createExpenseMutation.isPending) {
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-3xl my-8 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/30">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="new-expense-modal-title"
                className="text-base font-semibold text-slate-900 dark:text-slate-100"
              >
                New Expense Report
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Log items with receipts for reimbursement
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={createExpenseMutation.isPending}
            aria-label="Close dialog"
            className="h-8 w-8 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          {/* Report Title */}
          <div>
            <label
              htmlFor="report-title-input"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Report Title / Purpose *
            </label>
            <input
              id="report-title-input"
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (titleError) setTitleError(null);
              }}
              placeholder="e.g. Bangalore Client Visit - Oct 2026 or AWS Hosting Bill"
              className={`w-full px-3.5 py-2 text-sm rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-all ${
                titleError
                  ? "border-rose-400 focus:ring-rose-500"
                  : "border-slate-300 dark:border-slate-700"
              }`}
            />
            {titleError && (
              <p className="mt-1 text-xs text-rose-500 font-medium" role="alert">
                {titleError}
              </p>
            )}
          </div>

          {/* Line Items Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Expense Line Items ({items.length})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Include individual expenditures and attach matching receipts
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddItem}
                className="gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Item
              </Button>
            </div>

            {/* Items Cards */}
            <div className="space-y-4">
              {items.map((item, index) => {
                const upload = itemUploads[index] || {
                  isUploading: false,
                  progress: 0,
                  error: null,
                };
                const isDragOver = dragOverIndex === index;

                return (
                  <div
                    key={index}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3.5 relative"
                  >
                    {/* Item header with item number & remove button */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200/70 dark:border-slate-800">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Item #{index + 1}
                      </span>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="text-xs text-slate-400 hover:text-rose-500 transition-colors p-1"
                          aria-label={`Remove item ${index + 1}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Inputs Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Category */}
                      <div>
                        <label
                          htmlFor={`item-category-${index}`}
                          className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
                        >
                          Category *
                        </label>
                        <select
                          id={`item-category-${index}`}
                          value={item.category}
                          onChange={(e) =>
                            handleItemChange(
                              index,
                              "category",
                              e.target.value as ExpenseCategory
                            )
                          }
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                        >
                          {CATEGORIES.map((cat) => (
                            <option key={cat.value} value={cat.value}>
                              {cat.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Amount in INR */}
                      <div>
                        <label
                          htmlFor={`item-amount-${index}`}
                          className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
                        >
                          Amount (INR ₹) *
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                            ₹
                          </span>
                          <input
                            id={`item-amount-${index}`}
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={item.amountRupees}
                            onChange={(e) =>
                              handleItemChange(index, "amountRupees", e.target.value)
                            }
                            placeholder="0.00"
                            className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-semibold"
                          />
                        </div>
                      </div>

                      {/* Date */}
                      <div>
                        <label
                          htmlFor={`item-date-${index}`}
                          className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
                        >
                          Incurred Date *
                        </label>
                        <input
                          id={`item-date-${index}`}
                          type="date"
                          value={item.date}
                          onChange={(e) =>
                            handleItemChange(index, "date", e.target.value)
                          }
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <label
                        htmlFor={`item-desc-${index}`}
                        className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
                      >
                        Description / Vendor
                      </label>
                      <input
                        id={`item-desc-${index}`}
                        type="text"
                        value={item.description || ""}
                        onChange={(e) =>
                          handleItemChange(index, "description", e.target.value)
                        }
                        placeholder="e.g. Flight to BOM or Hotel invoice"
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    {/* Drag-and-drop & Click-to-upload Receipt Zone */}
                    <div>
                      <span className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Receipt Attachment (PDF, JPG, PNG &lt; 5MB)
                      </span>

                      {item.receiptUrl ? (
                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span className="font-medium text-emerald-900 dark:text-emerald-200 truncate">
                              {item.receiptName || "Receipt Attached"}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              handleItemChange(index, "receiptUrl", undefined);
                              handleItemChange(index, "receiptName", undefined);
                            }}
                            className="text-slate-400 hover:text-rose-500 transition-colors ml-2 p-1"
                            aria-label={`Remove receipt for item ${index + 1}`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDragOverIndex(index);
                          }}
                          onDragLeave={() => setDragOverIndex(null)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setDragOverIndex(null);
                            const file = e.dataTransfer.files?.[0];
                            if (file) handleFileUpload(index, file);
                          }}
                          className={`relative border-2 border-dashed rounded-xl p-3 text-center transition-all ${
                            isDragOver
                              ? "border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/30"
                              : "border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 bg-white dark:bg-slate-950/50"
                          }`}
                        >
                          <input
                            id={`receipt-file-input-${index}`}
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                            disabled={upload.isUploading}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(index, file);
                            }}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            aria-label={`Upload receipt for item ${index + 1}`}
                          />
                          <div className="flex flex-col items-center justify-center gap-1 pointer-events-none">
                            {upload.isUploading ? (
                              <div className="flex flex-col items-center gap-1.5 w-full max-w-[200px]">
                                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                                <span className="text-[11px] text-slate-500">
                                  Uploading receipt ({upload.progress}%)...
                                </span>
                                <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                  <div
                                    className="bg-indigo-600 h-full transition-all duration-200"
                                    style={{ width: `${upload.progress}%` }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <>
                                <UploadCloud className="w-5 h-5 text-slate-400" />
                                <p className="text-xs text-slate-600 dark:text-slate-300">
                                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                                    Click to upload
                                  </span>{" "}
                                  or drag and drop receipt
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      {upload.error && (
                        <p className="mt-1 text-xs text-rose-500 font-medium flex items-center gap-1" role="alert">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          {upload.error}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer with Real-Time Auto-Total & Actions */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
          {/* Auto Total Display */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Calculated Total:
            </span>
            <span
              className="text-lg font-bold text-emerald-600 dark:text-emerald-400"
              data-testid="auto-total-display"
            >
              {formatINR(autoTotalPaise)}
            </span>
            <span className="text-[11px] text-slate-400">
              ({items.length} {items.length === 1 ? "item" : "items"})
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={createExpenseMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleSubmit(false)}
              disabled={createExpenseMutation.isPending || autoTotalPaise <= 0}
            >
              Save as Draft
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => handleSubmit(true)}
              disabled={createExpenseMutation.isPending || autoTotalPaise <= 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
            >
              {createExpenseMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Submit for Approval
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
