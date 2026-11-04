import React from "react";
import { Link } from "react-router-dom";
import {
  Bot,
  Sparkles,
  FileText,
  Upload,
  ArrowRight,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import type { DocumentItem } from "../../types/documents";

interface EmptyChatStateProps {
  readyDocs?: DocumentItem[];
  isLoadingDocs?: boolean;
  onSelectSuggestion: (question: string) => void;
}

export const EmptyChatState: React.FC<EmptyChatStateProps> = ({
  readyDocs = [],
  isLoadingDocs = false,
  onSelectSuggestion,
}) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-2xl mx-auto my-auto animate-in fade-in duration-300">
      {/* Icon Badge */}
      <div className="relative mb-5">
        <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25">
          <Bot className="w-8 h-8" />
        </div>
        <div className="absolute -bottom-1 -right-1 p-1.5 rounded-lg bg-emerald-500 text-white shadow-sm">
          <Sparkles className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Title & Subtitle */}
      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
        NexusOps Document Assistant
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 max-w-md leading-relaxed">
        Ask questions across company manuals, policies, and guidelines.
        Every answer is grounded in factual document sources with verified page citations.
      </p>

      {/* Suggestions Section */}
      <div className="w-full text-left space-y-2.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
          {readyDocs.length > 0 ? "Starter Questions from Ready Documents" : "Getting Started"}
        </p>

        {isLoadingDocs ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse space-y-3"
              >
                <div className="h-5 w-24 bg-slate-200 dark:bg-slate-800 rounded-md" />
                <div className="h-4 w-4/5 bg-slate-200 dark:bg-slate-800 rounded-md" />
              </div>
            ))}
          </div>
        ) : readyDocs.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {readyDocs.slice(0, 4).map((doc) => {
              const prompt = `What does ${doc.title} cover?`;
              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => onSelectSuggestion(prompt)}
                  className="group p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-md transition-all text-left flex flex-col justify-between cursor-pointer"
                  title={`Ask: "${prompt}"`}
                  aria-label={`Ask: "${prompt}"`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <FileText className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-medium text-slate-400 dark:text-slate-500 truncate max-w-[150px]">
                      {doc.category || "General"}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
                    {prompt}
                  </p>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-2xs">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                No documents are ready to chat
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
                Upload company documents such as policies, guides, or specifications to index them and start asking grounded questions.
              </p>
            </div>
            <div>
              <Link to="/documents">
                <Button size="sm" className="gap-1.5 mt-1 text-xs">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload a Document</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
