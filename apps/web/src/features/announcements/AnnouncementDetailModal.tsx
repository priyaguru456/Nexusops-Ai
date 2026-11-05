import React, { useEffect, useState } from "react";
import {
  Pin,
  AlertTriangle,
  Calendar,
  Building2,
  Users,
  Edit,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Dialog } from "../../components/ui/Dialog";
import { Button } from "../../components/ui/button";
import { SafeMarkdown } from "./SafeMarkdown";
import { formatKolkataDateTime } from "../../lib/date";
import {
  useMarkAnnouncementAsRead,
  useAnnouncementReadStats,
  useDeleteAnnouncement,
} from "./hooks";
import { useAuth } from "../auth/AuthContext";
import type { Announcement } from "../../types/announcements";

interface AnnouncementDetailModalProps {
  announcement: Announcement | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (announcement: Announcement) => void;
}

export const AnnouncementDetailModal: React.FC<AnnouncementDetailModalProps> = ({
  announcement,
  isOpen,
  onClose,
  onEdit,
}) => {
  const { user, role } = useAuth();
  const [showReaders, setShowReaders] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const markAsReadMutation = useMarkAnnouncementAsRead();
  const deleteMutation = useDeleteAnnouncement();

  const isAuthor = Boolean(user?.id && announcement?.authorId === user.id);
  const isAdmin = role === "ADMIN";
  const isManagerOfDept =
    role === "MANAGER" &&
    Boolean(user?.departmentId && announcement?.targetDepartmentId === user.departmentId);
  const canManage = isAdmin || isManagerOfDept;

  const showReadStats = isAuthor || isAdmin;

  // Real data: Fetch read stats only when author or admin
  const { data: readStats, isLoading: loadingStats } = useAnnouncementReadStats(
    announcement?.id,
    isOpen && showReadStats
  );

  // Automatically mark as read when opened (not just when listed)
  useEffect(() => {
    if (isOpen && announcement && !announcement.isRead) {
      markAsReadMutation.mutate(announcement.id);
    }
    // Reset state on open
    if (isOpen) {
      setShowReaders(false);
      setConfirmDelete(false);
    }
  }, [isOpen, announcement?.id]);

  if (!announcement) return null;

  const handleDelete = async () => {
    await deleteMutation.mutateAsync(announcement.id);
    onClose();
  };

  const readCount = readStats?.readCount ?? announcement.readCount ?? 0;
  const totalTargetUsers = readStats?.totalTargetUsers ?? announcement.totalTargetUsers ?? 0;
  const percentage =
    totalTargetUsers > 0
      ? Math.round((readCount / totalTargetUsers) * 100)
      : readStats?.percentage ?? 0;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={announcement.title}
      maxWidth="2xl"
    >
      <div className="space-y-5">
        {/* Badges & Metadata Row */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-b border-slate-100 dark:border-slate-800 pb-3">
          {announcement.isPinned && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200">
              <Pin className="w-3 h-3 text-amber-600 dark:text-amber-400 fill-amber-500" />
              Pinned
            </span>
          )}

          {announcement.priority === "URGENT" ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              URGENT
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              Normal Priority
            </span>
          )}

          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900 text-indigo-700 dark:text-indigo-300">
            <Building2 className="w-3 h-3 text-indigo-500" />
            {announcement.targetDepartment?.name ?? "Company-Wide"}
          </span>

          <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 ml-auto">
            <Calendar className="w-3 h-3 text-slate-400" />
            {formatKolkataDateTime(announcement.createdAt)}
          </span>
        </div>

        {/* Author Details and Read Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/70 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-xs">
              {announcement.author?.name
                ? announcement.author.name.slice(0, 2).toUpperCase()
                : "OP"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {announcement.author?.name || "Author"}
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-sm">
                  {announcement.author?.role || "Operator"}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {announcement.author?.email}
              </p>
            </div>
          </div>

          {/* Authors see "Read by X of Y" with breakdown */}
          {showReadStats && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowReaders(!showReaders)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-600 text-slate-700 dark:text-slate-200 transition-colors shadow-2xs"
                title="View read breakdown"
              >
                <Users className="w-3.5 h-3.5 text-indigo-500" />
                <span>
                  Read by {readCount} of {totalTargetUsers} ({percentage}%)
                </span>
                {showReaders ? (
                  <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                )}
              </button>
            </div>
          )}
        </div>

        {/* Expandable Readers Breakdown Drawer for Authors */}
        {showReadStats && showReaders && (
          <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-indigo-200 dark:border-indigo-900/60 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-1.5">
              <span>Reader Audience ({readStats?.readers.length ?? 0} listed)</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                {percentage}% Read Rate
              </span>
            </div>

            {loadingStats ? (
              <p className="text-xs text-slate-400 py-2">Loading readers...</p>
            ) : !readStats?.readers || readStats.readers.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">No users have read this yet.</p>
            ) : (
              <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {readStats.readers.map((reader) => (
                  <div
                    key={reader.id}
                    className="py-1.5 flex items-center justify-between gap-2"
                  >
                    <div>
                      <span className="font-medium text-slate-900 dark:text-slate-100">
                        {reader.name}
                      </span>
                      <span className="text-[11px] text-slate-400 ml-1.5">
                        ({reader.departmentName})
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {formatKolkataDateTime(reader.readAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Content Section: Sanitized Safe Markdown */}
        <div className="py-2 min-h-28">
          <SafeMarkdown content={announcement.content} />
        </div>

        {/* Actions Footer */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {canManage && onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(announcement)}
                className="gap-1.5 text-xs font-semibold rounded-lg"
              >
                <Edit className="w-3.5 h-3.5" />
                Edit
              </Button>
            )}

            {canManage && (
              <>
                {confirmDelete ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-rose-600 dark:text-rose-400 font-semibold">
                      Are you sure?
                    </span>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={deleteMutation.isPending}
                      onClick={handleDelete}
                      className="text-xs font-semibold h-8 px-2.5 rounded-lg"
                    >
                      Confirm Delete
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmDelete(false)}
                      className="text-xs h-8 px-2 rounded-lg"
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmDelete(true)}
                    className="gap-1.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </Button>
                )}
              </>
            )}
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            className="text-xs font-semibold rounded-lg ml-auto"
          >
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
