import React, { useState } from "react";
import {
  Pin,
  AlertTriangle,
  Building2,
  Eye,
  PenTool,
} from "lucide-react";
import { Dialog } from "../../components/ui/Dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { SafeMarkdown } from "./SafeMarkdown";
import { useCreateAnnouncement, useDepartments } from "./hooks";
import { useAuth } from "../auth/AuthContext";
import type { AnnouncementPriority } from "../../types/announcements";

interface NewAnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const NewAnnouncementModal: React.FC<NewAnnouncementModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user, role } = useAuth();
  const createMutation = useCreateAnnouncement();
  const { data: deptData } = useDepartments();

  const [activeTab, setActiveTab] = useState<"write" | "preview">("write");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState<AnnouncementPriority>("NORMAL");
  const [isPinned, setIsPinned] = useState(false);
  const [targetDepartmentId, setTargetDepartmentId] = useState<string>(() => {
    if (role === "MANAGER" && user?.departmentId) {
      return user.departmentId;
    }
    return "";
  });
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isManager = role === "MANAGER";
  const departments = deptData?.departments || [];

  const resetForm = () => {
    setTitle("");
    setContent("");
    setPriority("NORMAL");
    setIsPinned(false);
    setTargetDepartmentId(role === "MANAGER" && user?.departmentId ? user.departmentId : "");
    setExpiresAt("");
    setError(null);
    setActiveTab("write");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Please provide an announcement title.");
      return;
    }
    if (!content.trim()) {
      setError("Please provide announcement content in markdown.");
      return;
    }

    try {
      await createMutation.mutateAsync({
        title: title.trim(),
        content: content.trim(),
        priority,
        targetDepartmentId: isManager
          ? user?.departmentId || null
          : targetDepartmentId
          ? targetDepartmentId
          : null,
        isPinned,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      });

      handleClose();
      onSuccess?.();
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || "Failed to create announcement";
      setError(msg);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Create New Announcement"
      description="Publish an operational notice, update or urgent alert to the workforce."
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div
            className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs font-semibold"
            role="alert"
          >
            {error}
          </div>
        )}

        {/* Title Input */}
        <div className="space-y-1.5">
          <label
            htmlFor="announcement-title"
            className="block text-xs font-bold text-slate-800 dark:text-slate-200"
          >
            Announcement Title <span className="text-rose-500">*</span>
          </label>
          <Input
            id="announcement-title"
            placeholder="e.g. Q4 Operations Town Hall & Infrastructure Maintenance"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            required
            className="w-full text-sm rounded-xl"
          />
        </div>

        {/* Priority & Targeting Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Priority Select */}
          <div className="space-y-1.5">
            <label
              htmlFor="announcement-priority"
              className="block text-xs font-bold text-slate-800 dark:text-slate-200"
            >
              Priority Level
            </label>
            <select
              id="announcement-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as AnnouncementPriority)}
              className="w-full h-10 px-3 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="NORMAL">Normal Priority</option>
              <option value="URGENT">URGENT (Notifies eligible workforce)</option>
            </select>
          </div>

          {/* Department Targeting */}
          <div className="space-y-1.5">
            <label
              htmlFor="announcement-target-dept"
              className="block text-xs font-bold text-slate-800 dark:text-slate-200"
            >
              Target Audience
            </label>
            {isManager ? (
              <div
                id="announcement-target-dept"
                className="h-10 px-3 flex items-center gap-2 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs font-semibold"
              >
                <Building2 className="w-3.5 h-3.5 shrink-0" />
                <span>Your Department: {user?.department?.name || "Manager Dept"}</span>
              </div>
            ) : (
              <select
                id="announcement-target-dept"
                value={targetDepartmentId}
                onChange={(e) => setTargetDepartmentId(e.target.value)}
                className="w-full h-10 px-3 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Departments (Company-Wide)</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name} Department
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {priority === "URGENT" && (
          <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/80 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <span>
              <strong>Urgent Notice:</strong> This post will dispatch an operational system
              notification to all active employees in the target audience upon publishing.
            </span>
          </div>
        )}

        {/* Pin and Expiry options */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 dark:bg-slate-900"
            />
            <span className="flex items-center gap-1.5">
              <Pin className="w-3.5 h-3.5 text-amber-500" />
              Pin to top of announcements feed
            </span>
          </label>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 dark:text-slate-400">Expires:</span>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="text-xs px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Markdown Content with Write / Preview Tabs */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="announcement-content"
              className="block text-xs font-bold text-slate-800 dark:text-slate-200"
            >
              Content (Markdown) <span className="text-rose-500">*</span>
            </label>

            {/* Write / Preview Tab Switcher */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setActiveTab("write")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md flex items-center gap-1 transition-colors ${
                  activeTab === "write"
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <PenTool className="w-3 h-3" />
                Write
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("preview")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md flex items-center gap-1 transition-colors ${
                  activeTab === "preview"
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <Eye className="w-3 h-3" />
                Preview
              </button>
            </div>
          </div>

          {activeTab === "write" ? (
            <textarea
              id="announcement-content"
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your announcement in markdown (supports # headers, lists, **bold**, `code`, > quotes)..."
              required
              className="w-full p-3 text-xs font-mono rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          ) : (
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 min-h-48 max-h-72 overflow-y-auto">
              {content.trim() ? (
                <SafeMarkdown content={content} />
              ) : (
                <p className="text-xs italic text-slate-400 py-6 text-center">
                  Nothing to preview yet. Switch to the Write tab to add markdown text.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Actions Footer */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="text-xs font-semibold rounded-xl"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createMutation.isPending}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl px-4 shadow-sm shadow-indigo-500/20"
          >
            {createMutation.isPending ? "Publishing..." : "Publish Announcement"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
