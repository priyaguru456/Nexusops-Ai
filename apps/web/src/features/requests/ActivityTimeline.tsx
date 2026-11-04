import React, { useState } from "react";
import {
  History,
  FilePlus,
  Send,
  RefreshCw,
  XCircle,
  Paperclip,
  CheckCircle2,
  Clock,
  MessageSquare,
  ShieldCheck,
  ShieldX,
  AlertCircle,
  FileEdit,
  User,
} from "lucide-react";
import type {
  ActivityHistoryItem,
  RequestApprovalStep,
} from "../../types/requests";
import { useComments, useCreateComment } from "../comments/hooks";
import { Button } from "../../components/ui/button";
import { LoadingSkeleton } from "../../components/ui/LoadingSkeleton";
import { formatKolkataDateTime } from "../../lib/utils";

export interface UnifiedTimelineItem {
  id: string;
  type: "status_change" | "approval_decision" | "comment" | "audit_entry";
  title: string;
  subtitle?: string | null;
  commentBody?: string | null;
  timestamp: string;
  actor: {
    name: string;
    role?: string;
    email?: string;
  };
  icon: React.ComponentType<{ className?: string }>;
  colorClasses: {
    iconBg: string;
    iconText: string;
    border: string;
  };
  badge?: {
    text: string;
    color: string;
  };
}

interface ActivityTimelineProps {
  requestId: string;
  auditLogs?: ActivityHistoryItem[];
  approvalSteps?: RequestApprovalStep[];
  isLoadingAudit?: boolean;
  className?: string;
}

export function ActivityTimeline({
  requestId,
  auditLogs = [],
  approvalSteps = [],
  isLoadingAudit = false,
  className = "",
}: ActivityTimelineProps): React.JSX.Element {
  const [newComment, setNewComment] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);

  // Real comment thread data & mutation
  const {
    data: comments = [],
    isLoading: isLoadingComments,
    refetch: refetchComments,
  } = useComments("request", requestId);

  const createCommentMutation = useCreateComment("request", requestId);

  // Handle posting a new comment
  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCommentError(null);

    const trimmed = newComment.trim();
    if (!trimmed) {
      setCommentError("Comment cannot be empty");
      return;
    }

    if (trimmed.length > 5000) {
      setCommentError("Comment cannot exceed 5000 characters");
      return;
    }

    createCommentMutation.mutate(trimmed, {
      onSuccess: () => {
        setNewComment("");
        refetchComments();
      },
      onError: (err: unknown) => {
        const errorMsg =
          (err as { response?: { data?: { error?: string } } })?.response?.data
            ?.error ||
          (err as Error)?.message ||
          "Failed to post comment. Ensure you have permission to interact with this request.";
        setCommentError(errorMsg);
      },
    });
  };

  // Build unified chronological timeline items
  const timelineItems: UnifiedTimelineItem[] = [];

  // 1. Ingest Comments into Timeline
  comments.forEach((c) => {
    timelineItems.push({
      id: `comment-${c.id}`,
      type: "comment",
      title: `${c.user.name} commented`,
      commentBody: c.body,
      timestamp: c.createdAt,
      actor: {
        name: c.user.name,
        role: c.user.role,
        email: c.user.email,
      },
      icon: MessageSquare,
      colorClasses: {
        iconBg: "bg-blue-100 dark:bg-blue-950",
        iconText: "text-blue-600 dark:text-blue-400",
        border: "border-blue-300 dark:border-blue-800",
      },
      badge: {
        text: "Comment",
        color:
          "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
      },
    });
  });

  // 2. Ingest Approval Decisions (from real approval steps)
  approvalSteps.forEach((step) => {
    if (step.decidedAt && (step.status === "APPROVED" || step.status === "REJECTED")) {
      const isApproved = step.status === "APPROVED";
      const approverName =
        step.approver?.name || `${step.approverRole} Approver`;

      timelineItems.push({
        id: `approval-step-${step.id}`,
        type: "approval_decision",
        title: isApproved
          ? `Step ${step.stepOrder} Approved`
          : `Step ${step.stepOrder} Rejected`,
        subtitle: isApproved
          ? `Approved by ${approverName} (${step.approverRole})`
          : `Rejected by ${approverName} (${step.approverRole})`,
        commentBody: step.comment || null,
        timestamp: step.decidedAt,
        actor: {
          name: approverName,
          role: step.approver?.role || step.approverRole,
        },
        icon: isApproved ? ShieldCheck : ShieldX,
        colorClasses: isApproved
          ? {
              iconBg: "bg-emerald-100 dark:bg-emerald-950",
              iconText: "text-emerald-600 dark:text-emerald-400",
              border: "border-emerald-300 dark:border-emerald-800",
            }
          : {
              iconBg: "bg-rose-100 dark:bg-rose-950",
              iconText: "text-rose-600 dark:text-rose-400",
              border: "border-rose-300 dark:border-rose-800",
            },
        badge: {
          text: isApproved ? "Step Approved" : "Step Rejected",
          color: isApproved
            ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
            : "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800",
        },
      });
    }
  });

  // 3. Ingest Audit Log Entries (Status Changes, Submissions, Attachments)
  auditLogs.forEach((log) => {
    // Avoid duplicate approval step decisions if already captured from approvalSteps
    if (
      log.action === "APPROVAL_STEP_APPROVED" ||
      log.action === "APPROVAL_STEP_REJECTED"
    ) {
      return;
    }

    const actorName = log.actor?.name || "System";
    const actorRole = log.actor?.role;

    switch (log.action) {
      case "REQUEST_CREATED":
        timelineItems.push({
          id: `audit-${log.id}`,
          type: "status_change",
          title: "Request Created",
          subtitle: `Created as Draft by ${actorName}`,
          timestamp: log.createdAt,
          actor: { name: actorName, role: actorRole },
          icon: FilePlus,
          colorClasses: {
            iconBg: "bg-indigo-100 dark:bg-indigo-950",
            iconText: "text-indigo-600 dark:text-indigo-400",
            border: "border-indigo-300 dark:border-indigo-800",
          },
          badge: {
            text: "Draft Created",
            color: "bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
          },
        });
        break;

      case "REQUEST_SUBMITTED":
        timelineItems.push({
          id: `audit-${log.id}`,
          type: "status_change",
          title: "Submitted for Approval",
          subtitle: `Submitted by ${actorName} and dispatched to approvers`,
          timestamp: log.createdAt,
          actor: { name: actorName, role: actorRole },
          icon: Send,
          colorClasses: {
            iconBg: "bg-blue-100 dark:bg-blue-950",
            iconText: "text-blue-600 dark:text-blue-400",
            border: "border-blue-300 dark:border-blue-800",
          },
          badge: {
            text: "Submitted",
            color: "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
          },
        });
        break;

      case "REQUEST_STATUS_UPDATED": {
        const prev = log.metadata?.previousStatus
          ? String(log.metadata.previousStatus).replace(/_/g, " ")
          : "";
        const next = log.metadata?.newStatus
          ? String(log.metadata.newStatus).replace(/_/g, " ")
          : "";
        const comment = log.metadata?.comment
          ? String(log.metadata.comment)
          : null;

        timelineItems.push({
          id: `audit-${log.id}`,
          type: "status_change",
          title: "Status Transition",
          subtitle: prev ? `${prev} → ${next}` : `Changed to ${next}`,
          commentBody: comment,
          timestamp: log.createdAt,
          actor: { name: actorName, role: actorRole },
          icon: RefreshCw,
          colorClasses: {
            iconBg: "bg-teal-100 dark:bg-teal-950",
            iconText: "text-teal-600 dark:text-teal-400",
            border: "border-teal-300 dark:border-teal-800",
          },
          badge: {
            text: next || "Status Update",
            color: "bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800",
          },
        });
        break;
      }

      case "REQUEST_CANCELLED":
        timelineItems.push({
          id: `audit-${log.id}`,
          type: "status_change",
          title: "Request Cancelled",
          subtitle: `Cancelled by ${actorName}`,
          timestamp: log.createdAt,
          actor: { name: actorName, role: actorRole },
          icon: XCircle,
          colorClasses: {
            iconBg: "bg-rose-100 dark:bg-rose-950",
            iconText: "text-rose-600 dark:text-rose-400",
            border: "border-rose-300 dark:border-rose-800",
          },
          badge: {
            text: "Cancelled",
            color: "bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800",
          },
        });
        break;

      case "REQUEST_UPDATED":
        timelineItems.push({
          id: `audit-${log.id}`,
          type: "audit_entry",
          title: "Specifications Modified",
          subtitle: `Updated by ${actorName}`,
          timestamp: log.createdAt,
          actor: { name: actorName, role: actorRole },
          icon: FileEdit,
          colorClasses: {
            iconBg: "bg-amber-100 dark:bg-amber-950",
            iconText: "text-amber-600 dark:text-amber-400",
            border: "border-amber-300 dark:border-amber-800",
          },
        });
        break;

      case "REQUEST_ATTACHMENT_ADDED":
        timelineItems.push({
          id: `audit-${log.id}`,
          type: "audit_entry",
          title: "File Attachment Added",
          subtitle: log.metadata?.fileName
            ? `Uploaded "${String(log.metadata.fileName)}" by ${actorName}`
            : `Uploaded by ${actorName}`,
          timestamp: log.createdAt,
          actor: { name: actorName, role: actorRole },
          icon: Paperclip,
          colorClasses: {
            iconBg: "bg-slate-100 dark:bg-slate-800",
            iconText: "text-slate-600 dark:text-slate-300",
            border: "border-slate-300 dark:border-slate-700",
          },
        });
        break;

      default:
        timelineItems.push({
          id: `audit-${log.id}`,
          type: "audit_entry",
          title: log.action.replace(/_/g, " "),
          subtitle: `Recorded by ${actorName}`,
          timestamp: log.createdAt,
          actor: { name: actorName, role: actorRole },
          icon: CheckCircle2,
          colorClasses: {
            iconBg: "bg-slate-100 dark:bg-slate-800",
            iconText: "text-slate-600 dark:text-slate-300",
            border: "border-slate-300 dark:border-slate-700",
          },
        });
        break;
    }
  });

  // Sort newest first
  timelineItems.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const isLoading = isLoadingAudit || isLoadingComments;

  return (
    <div
      className={`p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-6 ${className}`}
      role="region"
      aria-label="Activity timeline and discussion"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Activity & Discussion Timeline
          </h2>
        </div>
        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
          {timelineItems.length} Events
        </span>
      </div>

      {/* Integrated Comment Box */}
      <form
        onSubmit={handleCommentSubmit}
        className="space-y-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60"
        aria-label="Add a comment to the activity timeline"
      >
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
          <MessageSquare className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          <span>Add to Discussion</span>
        </div>

        <div className="relative">
          <textarea
            value={newComment}
            onChange={(e) => {
              setNewComment(e.target.value);
              if (commentError) setCommentError(null);
            }}
            placeholder="Share an update, feedback, or decision notes..."
            rows={3}
            maxLength={5000}
            className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 resize-none transition-shadow"
            aria-label="Comment text"
          />
        </div>

        {commentError && (
          <div className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 font-medium">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{commentError}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-slate-400">
            {newComment.length} / 5000 characters
          </span>
          <Button
            type="submit"
            size="sm"
            disabled={!newComment.trim() || createCommentMutation.isPending}
            isLoading={createCommentMutation.isPending}
            className="gap-1.5 shadow-xs"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Post Comment</span>
          </Button>
        </div>
      </form>

      {/* Merged Timeline Items (Newest First) */}
      {isLoading ? (
        <div className="space-y-4 py-3" aria-busy="true">
          <LoadingSkeleton className="h-14 w-full rounded-xl" />
          <LoadingSkeleton className="h-14 w-full rounded-xl" />
          <LoadingSkeleton className="h-14 w-full rounded-xl" />
        </div>
      ) : timelineItems.length > 0 ? (
        <ol
          className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800"
          role="list"
        >
          {timelineItems.map((item) => {
            const Icon = item.icon;

            return (
              <li key={item.id} className="relative group text-xs">
                {/* Timeline Icon Node */}
                <div
                  className={`absolute -left-6 top-0.5 w-6 h-6 rounded-full border flex items-center justify-center shrink-0 shadow-2xs ${item.colorClasses.iconBg} ${item.colorClasses.iconText} ${item.colorClasses.border}`}
                  aria-hidden="true"
                >
                  <Icon className="w-3 h-3" />
                </div>

                {/* Content Box */}
                <div className="p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-2xs space-y-1.5 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
                  {/* Top Bar: Title, Badge, and Timestamp in Asia/Kolkata */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {item.title}
                      </span>
                      {item.badge && (
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${item.badge.color}`}
                        >
                          {item.badge.text}
                        </span>
                      )}
                    </div>
                    <time
                      dateTime={item.timestamp}
                      className="text-[11px] text-slate-400 shrink-0 flex items-center gap-1"
                    >
                      <Clock className="w-3 h-3" />
                      <span>{formatKolkataDateTime(item.timestamp)}</span>
                    </time>
                  </div>

                  {/* Subtitle / Actor Details */}
                  {item.subtitle && (
                    <div className="text-slate-600 dark:text-slate-400 text-xs">
                      {item.subtitle}
                    </div>
                  )}

                  {/* Comment Body or Decision Note */}
                  {item.commentBody && (
                    <div className="mt-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 text-xs whitespace-pre-wrap leading-relaxed">
                      "{item.commentBody}"
                    </div>
                  )}

                  {/* Author metadata footer */}
                  <div className="text-[11px] text-slate-400 pt-0.5 flex items-center gap-1.5">
                    <User className="w-3 h-3 text-slate-400" />
                    <span>by</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {item.actor.name}
                    </span>
                    {item.actor.role && (
                      <span className="text-[10px] uppercase font-semibold text-slate-400 px-1 py-0.2 bg-slate-100 dark:bg-slate-800 rounded">
                        {item.actor.role}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="text-center py-8 text-xs text-slate-400">
          No activity recorded yet for this request.
        </div>
      )}
    </div>
  );
}
