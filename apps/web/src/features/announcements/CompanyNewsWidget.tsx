import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Megaphone,
  Pin,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../../components/ui/card";
import { useUnreadAnnouncements } from "./hooks";
import { AnnouncementDetailModal } from "./AnnouncementDetailModal";
import { formatKolkataDateTime } from "../../lib/date";
import type { Announcement } from "../../types/announcements";

export const CompanyNewsWidget: React.FC = () => {
  const { data, isLoading, isError, refetch } = useUnreadAnnouncements(3);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  const announcements = data?.items || [];

  return (
    <>
      <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Megaphone className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Company News & Updates
              </CardTitle>
              <CardDescription className="text-xs">
                {announcements.length > 0
                  ? `${announcements.length} unread announcement${announcements.length > 1 ? "s" : ""}`
                  : "All caught up"}
              </CardDescription>
            </div>
          </div>

          <Link
            to="/announcements"
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 group"
          >
            <span>View all</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3" role="status" aria-label="Loading company news">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-16 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse"
                />
              ))}
            </div>
          ) : isError ? (
            <div className="p-6 text-center text-xs text-slate-400 space-y-2">
              <p>Unable to load company news right now.</p>
              <button
                type="button"
                onClick={() => refetch()}
                className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
              >
                Retry
              </button>
            </div>
          ) : announcements.length === 0 ? (
            <div className="py-8 px-6 text-center space-y-2">
              <div className="w-9 h-9 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              </div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                You're all caught up!
              </p>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                No unread announcements. Check the announcements feed to view all past notices.
              </p>
              <Link
                to="/announcements"
                className="inline-block mt-1 text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
              >
                Browse all announcements →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {announcements.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedAnnouncement(item)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedAnnouncement(item);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Open announcement: ${item.title}`}
                  className="p-3.5 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-850/60 transition-colors cursor-pointer group focus:outline-hidden focus:bg-slate-50 dark:focus:bg-slate-850"
                >
                  {/* Indicator icon */}
                  <div className="mt-0.5 shrink-0 p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                    {item.priority === "URGENT" ? (
                      <AlertTriangle className="w-4 h-4 text-rose-500" />
                    ) : item.isPinned ? (
                      <Pin className="w-4 h-4 text-amber-500 fill-amber-400" />
                    ) : (
                      <Megaphone className="w-4 h-4 text-indigo-500" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {item.isPinned && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-sm bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-200">
                          Pinned
                        </span>
                      )}
                      {item.priority === "URGENT" && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-sm bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300">
                          Urgent
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400">
                        {item.targetDepartment?.name ?? "Company-Wide"}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {item.title}
                    </h4>

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                      {item.content.replace(/^[#*>_`\-\s]+/gm, "")}
                    </p>

                    <div className="flex items-center gap-2 text-[10px] text-slate-400 pt-0.5">
                      <span>{item.author?.name}</span>
                      <span>•</span>
                      <span>{formatKolkataDateTime(item.createdAt)}</span>
                    </div>
                  </div>

                  {/* Unread dot */}
                  <span
                    className="w-2 h-2 rounded-full bg-indigo-600 shrink-0 mt-2"
                    title="Unread"
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal on click */}
      <AnnouncementDetailModal
        announcement={selectedAnnouncement}
        isOpen={Boolean(selectedAnnouncement)}
        onClose={() => setSelectedAnnouncement(null)}
      />
    </>
  );
};
