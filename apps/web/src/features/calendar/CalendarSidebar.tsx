import React from "react";
import { CheckSquare, FileText, CalendarCheck, Sparkles, Plus, Eye, EyeOff } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { useAuth } from "../auth/AuthContext";
import type { CalendarToggles, CalendarEventType } from "../../types/calendar";

interface CalendarSidebarProps {
  toggles: CalendarToggles;
  onToggle: (key: keyof CalendarToggles) => void;
  counts: {
    tasks: number;
    requests: number;
    leaves: number;
    holidays: number;
  };
  onOpenAddHolidayModal?: () => void;
}

interface FilterItemConfig {
  key: keyof CalendarToggles;
  type: CalendarEventType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  colorClasses: {
    activeBorder: string;
    activeBg: string;
    activeText: string;
    dot: string;
    badge: string;
  };
  description: string;
}

const FILTER_CONFIGS: FilterItemConfig[] = [
  {
    key: "tasks",
    type: "TASK",
    label: "Tasks",
    icon: CheckSquare,
    colorClasses: {
      activeBorder: "border-blue-500/40 dark:border-blue-500/50",
      activeBg: "bg-blue-50/70 dark:bg-blue-950/30",
      activeText: "text-blue-700 dark:text-blue-300",
      dot: "bg-blue-500",
      badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
    },
    description: "Task deadlines & due dates",
  },
  {
    key: "requests",
    type: "REQUEST",
    label: "Work Requests",
    icon: FileText,
    colorClasses: {
      activeBorder: "border-amber-500/40 dark:border-amber-500/50",
      activeBg: "bg-amber-50/70 dark:bg-amber-950/30",
      activeText: "text-amber-700 dark:text-amber-300",
      dot: "bg-amber-500",
      badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
    },
    description: "Request target & due dates",
  },
  {
    key: "leaves",
    type: "LEAVE",
    label: "Approved Leaves",
    icon: CalendarCheck,
    colorClasses: {
      activeBorder: "border-emerald-500/40 dark:border-emerald-500/50",
      activeBg: "bg-emerald-50/70 dark:bg-emerald-950/30",
      activeText: "text-emerald-700 dark:text-emerald-300",
      dot: "bg-emerald-500",
      badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300",
    },
    description: "Team & personal approved leaves",
  },
  {
    key: "holidays",
    type: "HOLIDAY",
    label: "Company Holidays",
    icon: Sparkles,
    colorClasses: {
      activeBorder: "border-purple-500/40 dark:border-purple-500/50",
      activeBg: "bg-purple-50/70 dark:bg-purple-950/30",
      activeText: "text-purple-700 dark:text-purple-300",
      dot: "bg-purple-500",
      badge: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300",
    },
    description: "Official public and company holidays",
  },
];

export const CalendarSidebar: React.FC<CalendarSidebarProps> = ({
  toggles,
  onToggle,
  counts,
  onOpenAddHolidayModal,
}) => {
  const { role } = useAuth();
  const isAdmin = role === "ADMIN";

  return (
    <aside
      className="w-full lg:w-64 shrink-0 space-y-5 rounded-xl border border-neutral-200 bg-white p-4 shadow-xs dark:border-neutral-800 dark:bg-neutral-900"
      aria-label="Calendar filters and legend"
    >
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          Event Filters
        </h2>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Toggle sources to show or hide events on the calendar.
        </p>
      </div>

      <div className="space-y-2" role="group" aria-label="Event source toggles">
        {FILTER_CONFIGS.map((cfg) => {
          const isEnabled = toggles[cfg.key];
          const count = counts[cfg.key];
          const IconComponent = cfg.icon;

          return (
            <button
              key={cfg.key}
              type="button"
              onClick={() => onToggle(cfg.key)}
              aria-pressed={isEnabled}
              aria-label={`Toggle ${cfg.label} (${count} visible)`}
              className={`flex w-full items-center justify-between rounded-lg border p-2.5 text-left transition-all focus:outline-hidden focus:ring-2 focus:ring-primary-500 ${
                isEnabled
                  ? `${cfg.colorClasses.activeBorder} ${cfg.colorClasses.activeBg} ${cfg.colorClasses.activeText}`
                  : "border-neutral-200 bg-neutral-50/60 text-neutral-400 hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-800/40 dark:text-neutral-500 dark:hover:bg-neutral-800/80"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
                    isEnabled
                      ? cfg.colorClasses.activeBg
                      : "bg-neutral-200/60 dark:bg-neutral-700/60"
                  }`}
                  aria-hidden="true"
                >
                  <IconComponent className="h-4 w-4 shrink-0" />
                </span>
                <div className="min-w-0 flex-1 truncate">
                  <div className="flex items-center gap-1.5 font-medium text-sm">
                    <span
                      className={`h-2 w-2 rounded-full shrink-0 ${
                        isEnabled ? cfg.colorClasses.dot : "bg-neutral-300 dark:bg-neutral-600"
                      }`}
                      aria-hidden="true"
                    />
                    <span className="truncate">{cfg.label}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                <Badge
                  variant="outline"
                  className={`text-xs px-1.5 py-0.5 border-none font-semibold ${
                    isEnabled
                      ? cfg.colorClasses.badge
                      : "bg-neutral-200/60 text-neutral-500 dark:bg-neutral-700/60 dark:text-neutral-400"
                  }`}
                >
                  {count}
                </Badge>
                {isEnabled ? (
                  <Eye className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5 opacity-40" aria-hidden="true" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {isAdmin && onOpenAddHolidayModal && (
        <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenAddHolidayModal}
            className="w-full flex items-center justify-center gap-2 border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800 dark:border-purple-800/60 dark:text-purple-300 dark:hover:bg-purple-950/50"
            aria-label="Add Holiday"
          >
            <Plus className="h-4 w-4" />
            <span>Add Holiday</span>
          </Button>
        </div>
      )}
    </aside>
  );
};
