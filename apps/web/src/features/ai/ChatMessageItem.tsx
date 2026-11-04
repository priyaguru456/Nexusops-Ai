import React, { useState } from "react";
import {
  Bot,
  User,
  ThumbsUp,
  ThumbsDown,
  Copy,
  Check,
  AlertTriangle,
  Zap,
  BookOpen,
  RotateCcw,
} from "lucide-react";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { CitationChip } from "./CitationChip";
import type { ChatMessage, Citation } from "../../types/ai";

interface ChatMessageItemProps {
  message: ChatMessage;
  isStreamingActive?: boolean;
  onSelectCitation?: (citation: Citation, index: number) => void;
  onFeedback?: (messageId: string, value: 1 | -1) => void;
  onRegenerate?: (messageId: string) => void;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
  message,
  isStreamingActive = false,
  onSelectCitation,
  onFeedback,
  onRegenerate,
}) => {
  const [copied, setCopied] = useState(false);
  const [submittingVote, setSubmittingVote] = useState(false);

  const isUser = message.role === "USER" || message.role === "user";
  const isNotFound =
    Boolean(message.notFound) ||
    message.content.trim() === "I couldn't find this in the company documents.";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleVote = async (val: 1 | -1) => {
    if (!message.id || isStreamingActive || submittingVote || !onFeedback) return;
    try {
      setSubmittingVote(true);
      await onFeedback(message.id, val);
    } finally {
      setSubmittingVote(false);
    }
  };

  if (isUser) {
    return (
      <div className="flex justify-end gap-3 px-4 py-2 group">
        <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-tr-xs px-4 py-3 bg-indigo-600 text-white shadow-sm">
          <p className="text-sm whitespace-pre-wrap leading-relaxed select-text">
            {message.content}
          </p>
        </div>
        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0 text-xs font-semibold">
          <User className="w-4 h-4" />
        </div>
      </div>
    );
  }

  // Assistant Message
  return (
    <div
      className={`flex items-start gap-3.5 px-4 py-3 group rounded-2xl transition-colors ${
        isNotFound
          ? "bg-amber-50/70 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800/60 my-2"
          : "hover:bg-slate-50/60 dark:hover:bg-slate-900/40"
      }`}
    >
      {/* Bot Avatar */}
      <div
        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-xs mt-0.5 ${
          isNotFound
            ? "bg-amber-500 text-white"
            : "bg-indigo-600 dark:bg-indigo-500 text-white"
        }`}
      >
        {isNotFound ? <AlertTriangle className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      {/* Message Body */}
      <div className="flex-1 min-w-0 space-y-2.5">
        {/* Header row / Not found badge */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              NexusOps Assistant
            </span>
            {isNotFound && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="w-3 h-3" />
                No Document Match
              </span>
            )}
          </div>

          {/* Performance stats if present */}
          {(message.tokensUsed !== undefined && message.tokensUsed !== null) && (
            <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
              {message.latencyMs !== undefined && message.latencyMs !== null && (
                <span className="flex items-center gap-0.5">
                  <Zap className="w-3 h-3 text-amber-500" />
                  {message.latencyMs}ms
                </span>
              )}
              <span>· {message.tokensUsed} tokens</span>
            </div>
          )}
        </div>

        {/* Content or Typing Indicator */}
        {message.isStreaming && !message.content ? (
          <div className="flex items-center gap-1.5 py-2">
            <div className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-bounce [animation-delay:-0.3s]" />
            <div className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-bounce [animation-delay:-0.15s]" />
            <div className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-bounce" />
            <span className="text-xs text-slate-400 ml-1.5">Analyzing document knowledge base...</span>
          </div>
        ) : (
          <div className={isNotFound ? "text-amber-900 dark:text-amber-200" : ""}>
            <MarkdownRenderer
              content={message.content}
              citations={message.citations}
              onSelectCitation={onSelectCitation}
            />

            {/* In-progress streaming cursor */}
            {message.isStreaming && (
              <span className="inline-block w-1.5 h-4 ml-1 bg-indigo-500 animate-pulse align-middle" />
            )}
          </div>
        )}

        {/* Citations Footer summary (if citations array is non-empty) */}
        {!message.isStreaming && message.citations && message.citations.length > 0 && (
          <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800/80 mt-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1.5 font-medium">
              <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
              <span>Referenced Sources ({message.citations.length}):</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {message.citations.map((c, idx) => (
                <CitationChip
                  key={`${c.documentId}-${c.pageNumber ?? 0}-${idx}`}
                  citationNumber={idx + 1}
                  citation={c}
                  variant="badge"
                  onClick={() => onSelectCitation && onSelectCitation(c, idx)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Action Toolbar (Copy, Thumbs Up, Thumbs Down) */}
        {!message.isStreaming && message.content && (
          <div className="flex items-center gap-1 pt-1 text-slate-400">
            {/* Copy button */}
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Copy answer"
              aria-label="Copy answer"
            >
              {copied ? (
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

            {/* Regenerate button */}
            {onRegenerate && (
              <button
                type="button"
                disabled={isStreamingActive}
                onClick={() => onRegenerate(message.id)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                title={isStreamingActive ? "Disabled while streaming" : "Regenerate answer"}
                aria-label="Regenerate answer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Regenerate</span>
              </button>
            )}

            <span className="text-slate-300 dark:text-slate-700">|</span>

            {/* Thumbs up */}
            <button
              type="button"
              disabled={isStreamingActive || submittingVote}
              onClick={() => handleVote(1)}
              className={`p-1.5 rounded transition-colors cursor-pointer disabled:opacity-40 disabled:pointer-events-none ${
                message.feedback === 1
                  ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60"
                  : "hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
              title={isStreamingActive ? "Disabled while streaming" : "Helpful answer"}
            >
              <ThumbsUp className="w-3.5 h-3.5" />
            </button>

            {/* Thumbs down */}
            <button
              type="button"
              disabled={isStreamingActive || submittingVote}
              onClick={() => handleVote(-1)}
              className={`p-1.5 rounded transition-colors cursor-pointer disabled:opacity-40 disabled:pointer-events-none ${
                message.feedback === -1
                  ? "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60"
                  : "hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
              title={isStreamingActive ? "Disabled while streaming" : "Not helpful"}
            >
              <ThumbsDown className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
