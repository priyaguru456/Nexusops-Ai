import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, CheckSquare } from "lucide-react";
import { Button } from "../../components/ui/button";
import { useAuth } from "../auth/AuthContext";

const createTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters")
    .max(200, "Title cannot exceed 200 characters"),
  description: z.string().trim().max(5000).optional().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  status: z.enum(["TODO", "IN_PROGRESS", "BLOCKED", "DONE"]),
  dueDate: z.string().optional().nullable(),
  requestId: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
});

export type CreateTaskFormData = z.infer<typeof createTaskSchema>;

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateTaskFormData) => void;
  isLoading?: boolean;
}

export function CreateTaskModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
}: CreateTaskModalProps): React.JSX.Element | null {
  const { user } = useAuth();
  const isPrivileged = user?.role === "MANAGER" || user?.role === "ADMIN";

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateTaskFormData>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "MEDIUM",
      status: "TODO",
      dueDate: "",
      requestId: "",
      assigneeId: "",
    },
  });

  useEffect(() => {
    if (isOpen) {
      reset();
    }
  }, [isOpen, reset]);

  if (!isOpen) return null;

  const onFormSubmit = (data: CreateTaskFormData) => {
    onSubmit({
      ...data,
      dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : null,
      requestId: data.requestId?.trim() ? data.requestId.trim() : null,
      assigneeId: data.assigneeId?.trim() ? data.assigneeId.trim() : null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={() => !isLoading && onClose()}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl transition-all">
        <button
          type="button"
          disabled={isLoading}
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-900">
            <CheckSquare className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Create New Task
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Add a new actionable item to your board
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
              Task Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g., Complete security onboarding review"
              {...register("title")}
              className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {errors.title && (
              <p className="mt-1 text-xs text-rose-500 font-medium">{errors.title.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
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
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
                Initial Status
              </label>
              <select
                {...register("status")}
                className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="BLOCKED">Blocked</option>
                <option value="DONE">Done</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
              Due Date
            </label>
            <input
              type="date"
              {...register("dueDate")}
              className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Linked Request ID */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
              Linked Request ID (optional UUID)
            </label>
            <input
              type="text"
              placeholder="e.g., e0000000-0000-4000-8000-000000000001"
              {...register("requestId")}
              className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Assignee ID (only for manager / admin) */}
          {isPrivileged && (
            <div>
              <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
                Assignee User ID (optional UUID)
              </label>
              <input
                type="text"
                placeholder="Assign to team member ID..."
                {...register("assigneeId")}
                className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
              Description (optional)
            </label>
            <textarea
              rows={3}
              placeholder="Provide context or step-by-step checklist..."
              {...register("description")}
              className="w-full text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              disabled={isLoading}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isLoading}>
              Create Task
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
