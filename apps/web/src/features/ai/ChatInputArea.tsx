import React, { useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Send,
  Square,
  AlertCircle,
  CornerDownLeft,
  Sparkles,
  FileText,
  Upload,
  ArrowRight,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import type { DocumentItem } from "../../types/documents";

interface ChatInputAreaProps {
  input: string;
  setInput: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  errorMessage?: string | null;
  onClearError?: () => void;
  starterDocs?: DocumentItem[];
  isLoadingDocs?: boolean;
  onSelectPrompt?: (prompt: string) => void;
}

export const ChatInputArea: React.FC<ChatInputAreaProps> = ({
  input,
  setInput,
  onSend,
  onStop,
  isStreaming,
  disabled = false,
  errorMessage,
  onClearError,
  starterDocs = [],
  isLoadingDocs = false,
  onSelectPrompt,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea height as content changes
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const nextHeight = Math.min(el.scrollHeight, 180);
    el.style.height = `${nextHeight}px`;
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming && input.trim() && !disabled) {
        onSend();
      }
    }
  };

  return (
    <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs">
      <div className="max-w-4xl mx-auto space-y-2.5">
        {/* Error / Rate limit notification banner */}
        {errorMessage && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <p className="font-medium">{errorMessage}</p>
            </div>
            {onClearError && (
              <button
                type="button"
                onClick={onClearError}
                className="text-xs text-rose-600 dark:text-rose-400 hover:underline cursor-pointer ml-3 font-semibold"
              >
                Dismiss
              </button>
            )}
          </div>
        )}

        {/* Starter Chips above the input */}
        {isLoadingDocs ? (
          <div className="flex items-center gap-2 overflow-x-auto pb-1" aria-label="Loading document chips">
            <div className="h-6 w-24 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse" />
            <div className="h-6 w-32 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse" />
            <div className="h-6 w-28 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse" />
          </div>
        ) : starterDocs.length > 0 ? (
          <div
            className="flex items-center gap-1.5 overflow-x-auto pb-1"
            role="region"
            aria-label="Document starter prompts"
          >
            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 shrink-0 flex items-center gap-1 mr-0.5">
              <Sparkles className="w-3 h-3 text-indigo-500" />
              <span>Suggested:</span>
            </span>
            {starterDocs.slice(0, 4).map((doc) => {
              const prompt = `What does ${doc.title} cover?`;
              return (
                <button
                  key={doc.id}
                  type="button"
                  disabled={isStreaming || disabled}
                  onClick={() => onSelectPrompt?.(prompt)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/60 text-slate-700 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400 border border-slate-200 hover:border-indigo-300 dark:border-slate-700 dark:hover:border-indigo-800 transition-all cursor-pointer shrink-0 disabled:opacity-50 disabled:pointer-events-none shadow-2xs"
                  title={`Send prompt: "${prompt}"`}
                  aria-label={`Ask about ${doc.title}`}
                >
                  <FileText className="w-3 h-3 text-indigo-500 shrink-0" />
                  <span className="truncate max-w-[200px]">
                    {doc.category ? `${doc.category}: ` : ""}{doc.title}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-between px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800/80">
            <div className="flex items-center gap-2">
              <Upload className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>No documents are ready yet.</span>
            </div>
            <Link
              to="/documents"
              className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline inline-flex items-center gap-1"
            >
              <span>Upload a document to chat</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        )}

        {/* Input box */}
        <div className="relative flex items-end gap-2 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-950/60 px-3.5 py-2.5 shadow-xs focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={
              isStreaming
                ? "Waiting for response to complete..."
                : "Ask about company documents, policies, or procedures..."
            }
            className="w-full resize-none bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none min-h-[24px] max-h-[180px] leading-relaxed"
          />

          {/* Action button: Stop while streaming, Send while idle */}
          <div className="shrink-0 flex items-center">
            {isStreaming ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={onStop}
                className="h-9 px-3 gap-1.5 rounded-xl text-xs font-semibold shadow-xs"
                title="Stop streaming response"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop</span>
              </Button>
            ) : (
              <Button
                type="button"
                variant="default"
                size="icon"
                disabled={!input.trim() || disabled}
                onClick={onSend}
                className="h-9 w-9 rounded-xl shadow-xs"
                title="Send message (Enter)"
              >
                <Send className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Bottom hints */}
        <div className="flex items-center justify-between px-1 text-[11px] text-slate-400 dark:text-slate-500">
          <div className="flex items-center gap-1.5">
            <span>Press</span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[10px]">
              Enter <CornerDownLeft className="w-2.5 h-2.5 inline" />
            </kbd>
            <span>to send,</span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[10px]">
              Shift + Enter
            </kbd>
            <span>for new line</span>
          </div>

          <span>Grounded in verified company documentation</span>
        </div>
      </div>
    </div>
  );
};
