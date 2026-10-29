import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UploadCloud, X, FileText, AlertCircle } from "lucide-react";
import { Button } from "../../components/ui/button";
import type { WorkRequest } from "../../types/requests";

const requestFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters")
    .max(200, "Title cannot exceed 200 characters"),
  description: z
    .string()
    .trim()
    .min(5, "Description must be at least 5 characters")
    .max(5000, "Description cannot exceed 5000 characters"),
  category: z.enum(["IT", "HR", "FINANCE", "FACILITIES", "OTHER"], {
    message: "Please select a category",
  }),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  amount: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
});

export type RequestFormInput = z.infer<typeof requestFormSchema>;

export interface RequestFormSubmitData {
  title: string;
  description: string;
  category: "IT" | "HR" | "FINANCE" | "FACILITIES" | "OTHER";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  amount?: number | null;
  dueDate?: string | null;
}

interface RequestFormProps {
  initialData?: WorkRequest;
  onSubmit: (data: RequestFormSubmitData, files: File[]) => void;
  isLoading?: boolean;
  submitLabel?: string;
  onCancel?: () => void;
}

export function RequestForm({
  initialData,
  onSubmit,
  isLoading = false,
  submitLabel = "Save Request",
  onCancel,
}: RequestFormProps): React.JSX.Element {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RequestFormInput>({
    resolver: zodResolver(requestFormSchema),
    defaultValues: {
      title: initialData?.title || "",
      description: initialData?.description || "",
      category: initialData?.category || "IT",
      priority: initialData?.priority || "MEDIUM",
      amount: initialData?.amount !== null && initialData?.amount !== undefined ? String(initialData.amount) : "",
      dueDate: initialData?.dueDate ? initialData.dueDate.split("T")[0] : "",
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    validateAndAddFiles(files);
  };

  const validateAndAddFiles = (newFiles: File[]) => {
    setFileError(null);
    const valid: File[] = [];

    for (const file of newFiles) {
      if (file.size > 20 * 1024 * 1024) {
        setFileError(`File "${file.name}" exceeds the 20MB limit.`);
        return;
      }
      valid.push(file);
    }

    setSelectedFiles((prev) => [...prev, ...valid]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const onFormSubmit = (data: RequestFormInput) => {
    const numAmount = data.amount && data.amount.trim() !== "" ? Number(data.amount) : null;
    onSubmit(
      {
        title: data.title,
        description: data.description,
        category: data.category,
        priority: data.priority,
        amount: numAmount,
        dueDate: data.dueDate ? data.dueDate : null,
      },
      selectedFiles
    );
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-5">
        {/* Title */}
        <div>
          <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1.5">
            Request Title <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            placeholder="e.g., Procurement of development laptops"
            {...register("title")}
            className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {errors.title && (
            <p className="mt-1 text-xs text-rose-500 font-medium">{errors.title.message}</p>
          )}
        </div>

        {/* Category & Priority */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1.5">
              Category <span className="text-rose-500">*</span>
            </label>
            <select
              {...register("category")}
              className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="IT">IT Infrastructure & Software</option>
              <option value="HR">HR & Personnel</option>
              <option value="FINANCE">Finance & Expenses</option>
              <option value="FACILITIES">Facilities & Office</option>
              <option value="OTHER">Other Request</option>
            </select>
            {errors.category && (
              <p className="mt-1 text-xs text-rose-500 font-medium">{errors.category.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1.5">
              Priority
            </label>
            <select
              {...register("priority")}
              className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
            {errors.priority && (
              <p className="mt-1 text-xs text-rose-500 font-medium">{errors.priority.message}</p>
            )}
          </div>
        </div>

        {/* Amount & Due Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1.5">
              Estimated Budget / Amount ($)
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              {...register("amount")}
              className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1.5">
              Due Date
            </label>
            <input
              type="date"
              {...register("dueDate")}
              className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1.5">
            Description <span className="text-rose-500">*</span>
          </label>
          <textarea
            rows={5}
            placeholder="Provide complete business justification, technical specifications, and timeline..."
            {...register("description")}
            className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-3.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
          />
          {errors.description && (
            <p className="mt-1 text-xs text-rose-500 font-medium">{errors.description.message}</p>
          )}
        </div>

        {/* File Attachments Dropzone */}
        <div>
          <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1.5">
            Attachments (PDF, Images, Word, Excel, CSV up to 20MB)
          </label>
          <div className="relative border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 rounded-xl p-6 text-center transition-colors bg-slate-50/50 dark:bg-slate-800/30">
            <input
              type="file"
              multiple
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center pointer-events-none">
              <UploadCloud className="w-8 h-8 text-indigo-500 mb-2" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Drag and drop files here, or{" "}
                <span className="text-indigo-600 dark:text-indigo-400 font-semibold">browse</span>
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Supports documents, spreadsheets, images and PDFs
              </p>
            </div>
          </div>

          {fileError && (
            <div className="flex items-center gap-1.5 text-xs text-rose-500 mt-2 font-medium">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{fileError}</span>
            </div>
          )}

          {/* Selected Files List */}
          {selectedFiles.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-semibold uppercase text-slate-400 tracking-wider">
                Selected Attachments ({selectedFiles.length})
              </p>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50">
                {selectedFiles.map((file, idx) => (
                  <div
                    key={`${file.name}-${idx}`}
                    className="flex items-center justify-between p-2.5 text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                      <span className="font-medium text-slate-700 dark:text-slate-200 truncate">
                        {file.name}
                      </span>
                      <span className="text-slate-400 shrink-0">
                        ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="text-slate-400 hover:text-rose-500 p-1 transition-colors cursor-pointer"
                      aria-label="Remove file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Buttons */}
      <div className="flex justify-end gap-3">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
        )}
        <Button type="submit" isLoading={isLoading} className="px-6">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
