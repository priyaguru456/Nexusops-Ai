import React, { useState, useEffect, useRef } from "react";
import { CheckCircle2, X } from "lucide-react";
import { Button } from "../../components/ui/button";

interface ApprovePopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (comment?: string) => Promise<void> | void;
  isLoading: boolean;
  requestTitle: string;
}

export const ApprovePopover: React.FC<ApprovePopoverProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  requestTitle,
}) => {
  const [comment, setComment] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setComment("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        if (!isLoading) {
          onClose();
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(comment.trim() || undefined);
  };

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Approve request: ${requestTitle}`}
      className="absolute right-0 top-full mt-2 z-30 w-80 sm:w-96 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl text-left animate-in fade-in zoom-in-95 duration-100"
    >
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Confirm Approval</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          aria-label="Close approval popover"
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2.5 truncate" title={requestTitle}>
        Approving: <span className="font-medium text-slate-700 dark:text-slate-300">{requestTitle}</span>
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label
            htmlFor="approval-comment-input"
            className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
          >
            Comment <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <textarea
            id="approval-comment-input"
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            disabled={isLoading}
            placeholder="Add optional notes or authorization remarks..."
            className="w-full p-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            autoFocus
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isLoading}
            className="h-8 text-xs"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            isLoading={isLoading}
            disabled={isLoading}
            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Confirm</span>
          </Button>
        </div>
      </form>
    </div>
  );
};
