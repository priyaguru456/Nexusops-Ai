import React, { useState } from "react";
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

interface CitationsPanelProps {
  isOpen: boolean;
  citation: Citation | null;
  allCitations?: Citation[];
  onSelectCitation: (citation: Citation, index: number) => void;
  onClose: () => void;
}

export const CitationsPanel: React.FC<CitationsPanelProps> = ({
  isOpen,
  citation,
  allCitations = [],
  onSelectCitation,
  onClose,
}) => {
  const [isOpeningDoc, setIsOpeningDoc] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  if (!isOpen || !citation) {
    return null;
  }

  const selectedIndex = allCitations.findIndex(
    (c) =>
      c.documentId === citation.documentId && c.pageNumber === citation.pageNumber
  );
  const citationNumber = selectedIndex !== -1 ? selectedIndex + 1 : 1;

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
    <aside
      className="w-80 md:w-96 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col h-full shadow-lg z-30 transition-all shrink-0 animate-in slide-in-from-right duration-200"
      aria-label="Citations Panel"
    >
      {/* Panel Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
            Source Citation [{citationNumber}]
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Close panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Multi-citation Switcher (if more than 1 citation exists) */}
      {allCitations.length > 1 && (
        <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/50">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 font-medium">
            All Citations ({allCitations.length})
          </p>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
            {allCitations.map((c, idx) => {
              const num = idx + 1;
              const isSelected =
                c.documentId === citation.documentId &&
                c.pageNumber === citation.pageNumber;
              return (
                <button
                  key={`${c.documentId}-${c.pageNumber ?? 0}-${idx}`}
                  type="button"
                  onClick={() => onSelectCitation(c, idx)}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  [{num}] {c.documentTitle.slice(0, 14)}...
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Citation Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Document Metadata Card */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 bg-slate-50 dark:bg-slate-800/40 space-y-2">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
              <FileText className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <h4
                className="text-sm font-semibold text-slate-900 dark:text-slate-100 break-words leading-tight"
                title={citation.documentTitle}
              >
                {citation.documentTitle}
              </h4>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  {citation.pageNumber ? `Page ${citation.pageNumber}` : "General / Cover"}
                </span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-[140px]">
                  ID: {citation.documentId.slice(0, 8)}...
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Snippet Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Exact Excerpt Snippet
            </span>
            <button
              type="button"
              onClick={handleCopySnippet}
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
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
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 text-xs leading-relaxed font-mono whitespace-pre-wrap select-text max-h-64 overflow-y-auto border-l-4 border-l-indigo-500 dark:border-l-indigo-400">
            {citation.snippet || "No snippet content available."}
          </div>
        </div>

        {/* Error message if opening document fails */}
        {docError && (
          <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <p className="flex-1">{docError}</p>
          </div>
        )}
      </div>

      {/* Footer Action */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900">
        <Button
          type="button"
          onClick={handleOpenDocument}
          disabled={isOpeningDoc}
          className="w-full flex items-center justify-center gap-2"
        >
          {isOpeningDoc ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Fetching secure file...</span>
            </>
          ) : (
            <>
              <ExternalLink className="w-4 h-4" />
              <span>
                Open document at page {citation.pageNumber ?? 1}
              </span>
            </>
          )}
        </Button>
        <p className="text-[11px] text-center text-slate-400 dark:text-slate-500 mt-2">
          Streams authorized PDF blob and opens at target page
        </p>
      </div>
    </aside>
  );
};
