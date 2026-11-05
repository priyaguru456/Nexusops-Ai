import React, { useState } from "react";
import {
  Megaphone,
  Plus,
  Pin,
  AlertTriangle,
  Building2,
  Calendar,
  Search,
  Users,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useAnnouncements } from "./hooks";
import { NewAnnouncementModal } from "./NewAnnouncementModal";
import { EditAnnouncementModal } from "./EditAnnouncementModal";
import { AnnouncementDetailModal } from "./AnnouncementDetailModal";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { formatKolkataDateTime } from "../../lib/date";
import type { Announcement } from "../../types/announcements";

export const AnnouncementsPage: React.FC = () => {
  const { user, role } = useAuth();

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "unread" | "urgent" | "pinned">("all");

  // Modals state
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);

  const canPost = role === "ADMIN" || role === "MANAGER";

  // Real data: Announcements query with current filter params
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useAnnouncements({
    search: searchTerm.trim() || undefined,
    unreadOnly: activeFilter === "unread" ? true : undefined,
    priority: activeFilter === "urgent" ? "URGENT" : undefined,
    pinnedOnly: activeFilter === "pinned" ? true : undefined,
  });

  const announcements = data?.items || [];
  const unreadCount = data?.unreadCount || 0;

  const handleOpenAnnouncement = (item: Announcement) => {
    setSelectedAnnouncement(item);
  };

  const handleEditAnnouncement = (item: Announcement) => {
    setSelectedAnnouncement(null);
    setEditingAnnouncement(item);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Announcements
                </h1>
                {unreadCount > 0 && (
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300"
                    aria-label={`${unreadCount} unread announcements`}
                  >
                    {unreadCount} unread
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Official company updates, urgent alerts, and departmental notices.
              </p>
            </div>
          </div>
        </div>

        {/* Action Button: Visible only to Admin and Manager */}
        {canPost && (
          <div className="flex items-center gap-2 shrink-0">
            <Button
              onClick={() => setIsNewModalOpen(true)}
              className="h-9 px-4 gap-2 font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm shadow-indigo-500/20"
            >
              <Plus className="h-4 w-4" />
              <span>+ New Announcement</span>
            </Button>
          </div>
        )}
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search announcements by title or keyword..."
            className="pl-9 h-9 text-xs rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
          />
        </div>

        {/* Filter Chips */}
        <div
          className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0"
          role="tablist"
          aria-label="Announcement filters"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeFilter === "all"}
            onClick={() => setActiveFilter("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              activeFilter === "all"
                ? "bg-indigo-600 text-white shadow-2xs shadow-indigo-500/20"
                : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            All Announcements
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeFilter === "unread"}
            onClick={() => setActiveFilter("unread")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeFilter === "unread"
                ? "bg-indigo-600 text-white shadow-2xs shadow-indigo-500/20"
                : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            <span>Unread</span>
            {unreadCount > 0 && (
              <span
                className={`w-2 h-2 rounded-full ${
                  activeFilter === "unread" ? "bg-white" : "bg-indigo-600"
                }`}
              />
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeFilter === "urgent"}
            onClick={() => setActiveFilter("urgent")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeFilter === "urgent"
                ? "bg-rose-600 text-white shadow-2xs shadow-rose-500/20"
                : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Urgent</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeFilter === "pinned"}
            onClick={() => setActiveFilter("pinned")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeFilter === "pinned"
                ? "bg-amber-600 text-white shadow-2xs shadow-amber-500/20"
                : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            <Pin className="w-3.5 h-3.5" />
            <span>Pinned</span>
          </button>

          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Refresh announcements"
            className="p-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors ml-auto"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Feed Content */}
      <div role="feed" aria-busy={isLoading} className="space-y-3.5">
        {isLoading ? (
          // Skeletons
          <div className="space-y-3" role="status" aria-label="Loading announcements">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="h-4 w-48 bg-slate-200 dark:bg-slate-800 rounded-md" />
                  <div className="h-4 w-16 bg-slate-200 dark:bg-slate-800 rounded-md" />
                </div>
                <div className="h-3 w-3/4 bg-slate-100 dark:bg-slate-850 rounded-md" />
                <div className="h-3 w-1/2 bg-slate-100 dark:bg-slate-850 rounded-md" />
              </div>
            ))}
          </div>
        ) : isError ? (
          // Error State
          <div
            className="p-8 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 text-center space-y-3"
            role="alert"
          >
            <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Unable to load announcements
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              {(error as any)?.message || "A network or server error occurred while retrieving announcements."}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="rounded-xl text-xs font-semibold gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </Button>
          </div>
        ) : announcements.length === 0 ? (
          // Empty State
          <div
            className="py-16 px-6 text-center space-y-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
            role="status"
          >
            <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-500">
              <Megaphone className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              No announcements found
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {searchTerm || activeFilter !== "all"
                ? "No announcements matched your current search filters. Try resetting your criteria."
                : "There are currently no active announcements published for your department or company."}
            </p>
            {canPost && !searchTerm && activeFilter === "all" && (
              <Button
                size="sm"
                onClick={() => setIsNewModalOpen(true)}
                className="mt-2 text-xs font-semibold rounded-xl bg-indigo-600 text-white"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Post First Announcement
              </Button>
            )}
          </div>
        ) : (
          // Announcement Cards
          announcements.map((item) => {
            const isAuthor = user?.id === item.authorId;
            const isAdmin = role === "ADMIN";
            const showAuthorStats = isAuthor || isAdmin;
            const targetUsers = item.totalTargetUsers ?? 0;
            const readPercentage =
              targetUsers > 0 ? Math.round((item.readCount / targetUsers) * 100) : 0;

            return (
              <article
                key={item.id}
                onClick={() => handleOpenAnnouncement(item)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleOpenAnnouncement(item);
                  }
                }}
                tabIndex={0}
                role="article"
                aria-label={`Announcement: ${item.title}`}
                className={`relative group p-4 sm:p-5 rounded-2xl border transition-all duration-200 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ${
                  item.isPinned
                    ? "bg-amber-50/20 dark:bg-amber-950/10 border-amber-200/90 dark:border-amber-900/50 hover:border-amber-300 dark:hover:border-amber-700 shadow-2xs"
                    : item.isRead
                    ? "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 shadow-xs"
                    : "bg-indigo-50/20 dark:bg-indigo-950/15 border-indigo-200/80 dark:border-indigo-900/60 hover:border-indigo-400 dark:hover:border-indigo-600 shadow-xs"
                }`}
              >
                {/* Unread Dot Indicator */}
                {!item.isRead && (
                  <span
                    className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-indigo-600 dark:bg-indigo-400 shadow-xs ring-4 ring-indigo-50 dark:ring-indigo-950"
                    title="Unread announcement"
                    aria-label="Unread"
                  />
                )}

                <div className="space-y-2.5">
                  {/* Top Badges Row */}
                  <div className="flex flex-wrap items-center gap-2 pr-6">
                    {item.isPinned && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100/80 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200">
                        <Pin className="w-3 h-3 text-amber-600 fill-amber-500" />
                        Pinned
                      </span>
                    )}

                    {item.priority === "URGENT" && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200">
                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                        URGENT
                      </span>
                    )}

                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60">
                      <Building2 className="w-3 h-3 text-slate-400" />
                      {item.targetDepartment?.name ?? "Company-Wide"}
                    </span>

                    <span className="text-[11px] text-slate-400 flex items-center gap-1 ml-auto">
                      <Calendar className="w-3 h-3" />
                      {formatKolkataDateTime(item.createdAt)}
                    </span>
                  </div>

                  {/* Title & Preview Content */}
                  <div>
                    <h2
                      className={`text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors ${
                        !item.isRead ? "font-extrabold" : ""
                      }`}
                    >
                      {item.title}
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                      {item.content.replace(/^[#*>_`\-\s]+/gm, "")}
                    </p>
                  </div>

                  {/* Card Footer: Author + Read Count */}
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100/80 dark:border-slate-800/80 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center text-[10px]">
                        {item.author?.name ? item.author.name[0].toUpperCase() : "U"}
                      </div>
                      <span className="font-medium text-slate-700 dark:text-slate-300 text-xs">
                        {item.author?.name || "Author"}
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                        • {item.author?.role}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Authors see "Read by X of Y" */}
                      {showAuthorStats && targetUsers > 0 && (
                        <div
                          className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-semibold"
                          title={`Read by ${item.readCount} out of ${targetUsers} eligible users (${readPercentage}%)`}
                        >
                          <Users className="w-3 h-3 text-indigo-500" />
                          <span>
                            Read by {item.readCount} of {targetUsers} ({readPercentage}%)
                          </span>
                        </div>
                      )}

                      <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 group-hover:underline flex items-center gap-1">
                        Read notice →
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* Modals */}
      <NewAnnouncementModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSuccess={() => refetch()}
      />

      <EditAnnouncementModal
        announcement={editingAnnouncement}
        isOpen={Boolean(editingAnnouncement)}
        onClose={() => setEditingAnnouncement(null)}
        onSuccess={() => refetch()}
      />

      <AnnouncementDetailModal
        announcement={selectedAnnouncement}
        isOpen={Boolean(selectedAnnouncement)}
        onClose={() => setSelectedAnnouncement(null)}
        onEdit={(item) => handleEditAnnouncement(item)}
      />
    </div>
  );
};
