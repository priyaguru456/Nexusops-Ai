import React from "react";
import { FileText } from "lucide-react";
import type { Citation } from "../../types/ai";

interface CitationChipProps {
  citationNumber: number;
  citation: Citation;
  onClick: () => void;
  variant?: "inline" | "badge";
}

export const CitationChip: React.FC<CitationChipProps> = ({
  citationNumber,
  citation,
  onClick,
  variant = "inline",
}) => {
  const pageText = citation.pageNumber ? `, p.${citation.pageNumber}` : "";

  if (variant === "badge") {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClick();
        }}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-all cursor-pointer shadow-xs hover:shadow-sm"
        title={`[${citationNumber}] ${citation.documentTitle}${pageText} - Click to view excerpt`}
      >
        <FileText className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
        <span className="font-semibold">[{citationNumber}]</span>
        <span className="max-w-[200px] truncate">{citation.documentTitle}</span>
        {citation.pageNumber && (
          <span className="text-indigo-500/80 dark:text-indigo-400/80 text-[11px]">
            p.{citation.pageNumber}
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded-md text-xs font-medium bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors cursor-pointer align-baseline select-none"
      title={`[${citationNumber}] ${citation.documentTitle}${pageText} - View document citation`}
    >
      <FileText className="w-3 h-3 text-indigo-500 dark:text-indigo-400 shrink-0" />
      <span className="font-semibold">[{citationNumber}]</span>
      <span className="max-w-[140px] truncate">{citation.documentTitle}</span>
      {citation.pageNumber && (
        <span className="text-indigo-500/80 dark:text-indigo-400/80 text-[10px]">
          p.{citation.pageNumber}
        </span>
      )}
    </button>
  );
};
