import React from "react";
import {
  History,
  FilePlus,
  Send,
  RefreshCw,
  XCircle,
  Paperclip,
  CheckCircle2,
  Clock,
} from "lucide-react";
import type { ActivityHistoryItem } from "../../types/requests";
import { LoadingSkeleton } from "../../components/ui/LoadingSkeleton";

interface ActivityTimelineProps {
  activity?: ActivityHistoryItem[];
  isLoading?: boolean;
  className?: string;
}

export function ActivityTimeline({
  activity = [],
  isLoading = false,
  className = "",
}: ActivityTimelineProps): React.JSX.Element {
  const getActionConfig = (action: string) => {
    switch (action) {
      case "REQUEST_CREATED":
        return {
          label: "Request Created",
          icon: FilePlus,
          color: "text-indigo-600 bg-indigo-50 border-indigo-200 dark:bg-indigo-950 dark:border-indigo-800",
        };
      case "REQUEST_SUBMITTED":
        return {
          label: "Submitted for Review",
          icon: Send,
          color: "text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800",
        };
      case "REQUEST_STATUS_UPDATED":
        return {
          label: "Status Updated",
          icon: RefreshCw,
          color: "text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800",
        };
      case "REQUEST_CANCELLED":
        return {
          label: "Request Cancelled",
          icon: XCircle,
          color: "text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-950 dark:border-rose-800",
        };
      case "REQUEST_UPDATED":
        return {
          label: "Request Details Updated",
          icon: Clock,
          color: "text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800",
        };
      case "REQUEST_ATTACHMENT_ADDED":
        return {
          label: "Attachment Uploaded",
          icon: Paperclip,
          color: "text-teal-600 bg-teal-50 border-teal-200 dark:bg-teal-950 dark:border-teal-800",
        };
      default:
        return {
          label: action.replace(/_/g, " "),
          icon: CheckCircle2,
          color: "text-slate-600 bg-slate-50 border-slate-200 dark:bg-slate-900 dark:border-slate-800",
        };
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100 pb-2 border-b border-slate-200 dark:border-slate-800">
        <History className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
        <span>Activity History</span>
      </div>

      {isLoading ? (
        <div className="space-y-4 py-2">
          <LoadingSkeleton className="h-10 w-full" />
          <LoadingSkeleton className="h-10 w-full" />
          <LoadingSkeleton className="h-10 w-full" />
        </div>
      ) : activity.length > 0 ? (
        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
          {activity.map((item) => {
            const config = getActionConfig(item.action);
            const Icon = config.icon;

            return (
              <div key={item.id} className="relative group">
                {/* Dot / Icon */}
                <div
                  className={`absolute -left-6 top-0.5 w-6 h-6 rounded-full border flex items-center justify-center shrink-0 ${config.color}`}
                >
                  <Icon className="w-3 h-3" />
                </div>

                <div className="text-xs">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {config.label}
                    </span>
                    <time className="text-[11px] text-slate-400 shrink-0">
                      {new Date(item.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>

                  <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                    by{" "}
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {item.actor?.name || "System"}
                    </span>
                    {item.metadata && (
                      <span className="ml-1 text-[11px] opacity-80">
                        {item.metadata.newStatus ? (
                          <>
                            ({String(item.metadata.previousStatus ?? "").replace(/_/g, " ")} →{" "}
                            {String(item.metadata.newStatus).replace(/_/g, " ")})
                          </>
                        ) : null}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-6 text-sm text-slate-400">
          No activity recorded yet.
        </div>
      )}
    </div>
  );
}
