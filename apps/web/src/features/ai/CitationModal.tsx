import React, { useEffect, useState } from "react";
import {
  X,
  FileText,
  ExternalLink,
  BookOpen,
  Loader2,
  AlertCircle,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { aiApi } from "./api";
import type { Citation } from "../../types/ai";

interface CitationModalProps {
  isOpen: boolean;
  citation: Citation | null;
  allCitations?: Citation[];
  onSelectCitation?: (citation: Citation, index: number) => void;
  onClose: () => void;
}

export const CitationModal: React.FC<CitationModalProps> = ({
  isOpen,
  citation,
  allCitations = [],
  onSelectCitation,
  onClose,
}) => {
  const [isOpeningDoc, setIsOpeningDoc] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // Close on Escape key press
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

  if (!isOpen || !citation) {
    return null;
  }

  const selectedIndex = allCitations.findIndex(
    (c) =>
      c.documentId === citation.documentId &&
      c.pageNumber === citation.pageNumber &&
      c.chunkIndex === citation.chunkIndex
  );
  const citationNumber = selectedIndex !== -1 ? selectedIndex + 1 : 1;

  const locationText =
    citation.pageNumber !== null && citation.pageNumber !== undefined
      ? `Page ${citation.pageNumber}`
      : `Chunk ${citation.chunkIndex !== null && citation.chunkIndex !== undefined ? citation.chunkIndex + 1 : 1}`;

  const handleOpenDocument = async () => {
    try {
      setIsOpeningDoc(true);
      setDocError(null);
      await aiApi.openDocumentAtPage(citation.documentId, citation.pageNumber);
    } catch (err: unknown) {
      setDocError((err as Error)?.message || "Failed to open document file");
    } finally {
      setIsOpeningDoc(false);
    }
  };

  const handleCopySnippet = async () => {
    try {
      await navigator.clipboard.writeText(citation.snippet);
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="citation-modal-title"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/40 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2
                id="citation-modal-title"
                className="text-base font-bold text-slate-900 dark:text-slate-100 truncate"
              >
                Cited Excerpt [{citationNumber}]
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Grounded source verification
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close modal (Esc)"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Multi-citation Switcher (if more than 1 citation exists) */}
        {allCitations.length > 1 && onSelectCitation && (
          <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/60 shrink-0">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <span className="text-[11px] font-medium text-slate-400 shrink-0 mr-1">
                All Sources:
              </span>
              {allCitations.map((c, idx) => {
                const num = idx + 1;
                const isSelected =
                  c.documentId === citation.documentId &&
                  c.pageNumber === citation.pageNumber &&
                  c.chunkIndex === citation.chunkIndex;
                return (
                  <button
                    key={`${c.documentId}-${c.pageNumber ?? 0}-${c.chunkIndex ?? 0}-${idx}`}
                    type="button"
                    onClick={() => onSelectCitation(c, idx)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                      isSelected
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    [{num}] {c.documentTitle.slice(0, 16)}...
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Document Metadata Card */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-start gap-3">
            <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
              <FileText className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 break-words leading-tight">
                {citation.documentTitle}
              </h3>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  {locationText}
                </span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                  Doc ID: {citation.documentId.slice(0, 8)}...
                </span>
              </div>
            </div>
          </div>

          {/* Excerpt Snippet */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Cited Content
              </span>
              <button
                type="button"
                onClick={handleCopySnippet}
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                title="Copy excerpt"
              >
                {copiedSnippet ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-600 font-medium">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Excerpt</span>
                  </>
                )}
              </button>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 text-slate-800 dark:text-slate-200 text-xs sm:text-sm leading-relaxed font-mono whitespace-pre-wrap select-text max-h-72 overflow-y-auto border-l-4 border-l-indigo-500 dark:border-l-indigo-400">
              {citation.snippet || "No snippet content available."}
            </div>
          </div>

          {/* Error notice if opening document fails */}
          {docError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <p className="flex-1">{docError}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center sm:text-left">
            Only authorized documents accessible to your role are cited
          </p>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs"
            >
              Close
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleOpenDocument}
              disabled={isOpeningDoc}
              className="gap-1.5 text-xs font-semibold"
            >
              {isOpeningDoc ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Opening file...</span>
                </>
              ) : (
                <>
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Document ({locationText})</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
