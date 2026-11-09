import React, { useEffect, useRef } from "react";
import { X, Download, FileText } from "lucide-react";
import { Button } from "../../components/ui/button";

interface ReceiptPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptUrl: string | null;
  fileName?: string | null;
}

export function ReceiptPreviewModal({
  isOpen,
  onClose,
  receiptUrl,
  fileName,
}: ReceiptPreviewModalProps): React.JSX.Element | null {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !receiptUrl) return null;

  const isPdf =
    receiptUrl.toLowerCase().endsWith(".pdf") ||
    receiptUrl.toLowerCase().includes("application/pdf");

  const displayName = fileName || receiptUrl.split("/").pop() || "Receipt Document";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-preview-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <h2
              id="receipt-preview-title"
              className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate"
            >
              {displayName}
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={receiptUrl}
              download={displayName}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              aria-label="Download receipt file"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </a>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close receipt preview"
              className="h-8 w-8 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content Viewer */}
        <div className="flex-1 p-6 overflow-auto bg-slate-50 dark:bg-slate-950/60 flex items-center justify-center min-h-[300px]">
          {isPdf ? (
            <div className="w-full h-[65vh] flex flex-col items-center justify-center">
              <iframe
                src={`${receiptUrl}#toolbar=0`}
                title={displayName}
                className="w-full h-full rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center">
              <img
                src={receiptUrl}
                alt={displayName}
                className="max-h-[65vh] w-auto max-w-full rounded-xl object-contain shadow-xs border border-slate-200 dark:border-slate-800"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
