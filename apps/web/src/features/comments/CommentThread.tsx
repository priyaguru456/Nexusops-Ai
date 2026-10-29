import React, { useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import { useComments, useCreateComment } from "./hooks";
import { Button } from "../../components/ui/button";
import { LoadingSkeleton } from "../../components/ui/LoadingSkeleton";

interface CommentThreadProps {
  entityType: string;
  entityId: string;
  className?: string;
}

export function CommentThread({
  entityType,
  entityId,
  className = "",
}: CommentThreadProps): React.JSX.Element {
  const [commentText, setCommentText] = useState("");
  const { data: comments, isLoading } = useComments(entityType, entityId);
  const createMutation = useCreateComment(entityType, entityId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || createMutation.isPending) return;

    createMutation.mutate(commentText.trim(), {
      onSuccess: () => {
        setCommentText("");
      },
    });
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100 pb-2 border-b border-slate-200 dark:border-slate-800">
        <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
        <span>Discussion ({comments?.length ?? 0})</span>
      </div>

      {/* Comment List */}
      <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="space-y-3">
            <LoadingSkeleton className="h-16 w-full" />
            <LoadingSkeleton className="h-16 w-full" />
          </div>
        ) : comments && comments.length > 0 ? (
          comments.map((comment) => (
            <div
              key={comment.id}
              className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs space-y-1.5"
            >
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-medium text-[11px]">
                    {comment.user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {comment.user.name}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase tracking-wider font-medium">
                    {comment.user.role}
                  </span>
                </div>
                <time className="text-slate-400 text-[11px]">
                  {new Date(comment.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap pl-8">
                {comment.body}
              </p>
            </div>
          ))
        ) : (
          <div className="text-center py-6 text-sm text-slate-400">
            No comments yet. Start the conversation below.
          </div>
        )}
      </div>

      {/* Comment Input */}
      <form onSubmit={handleSubmit} className="space-y-2 pt-2">
        <textarea
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Write a comment..."
          rows={3}
          className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
        />
        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            disabled={!commentText.trim() || createMutation.isPending}
            isLoading={createMutation.isPending}
            className="gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Post Comment</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
