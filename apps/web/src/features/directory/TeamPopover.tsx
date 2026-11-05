import React from "react";
import { Building2, UserCheck, Users, ArrowRight } from "lucide-react";
import { Dialog } from "../../components/ui/Dialog";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { useUserTeam } from "./hooks";
import { getInitials, getAvatarColor } from "./ProfileCard";
import type { DirectoryUser } from "../../types/directory";
import type { Role } from "../../types/auth";

interface TeamPopoverProps {
  user: DirectoryUser | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectUser: (user: DirectoryUser) => void;
}

export function TeamPopover({
  user,
  isOpen,
  onClose,
  onSelectUser,
}: TeamPopoverProps): React.JSX.Element | null {
  const { data: teamData, isLoading, isError, refetch } = useUserTeam(user?.id ?? null);

  if (!isOpen || !user) return null;

  const roleVariant = (role: Role) => {
    switch (role) {
      case "ADMIN":
        return "destructive";
      case "MANAGER":
        return "warning";
      default:
        return "default";
    }
  };

  const renderMemberRow = (member: DirectoryUser, subtitle?: string) => (
    <div
      key={member.id}
      className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors group cursor-pointer"
      onClick={() => onSelectUser(member)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelectUser(member);
        }
      }}
      aria-label={`View team of ${member.name}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${getAvatarColor(
            member.name
          )}`}
          aria-hidden="true"
        >
          {getInitials(member.name)}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
            {member.name}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {subtitle || member.email}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant={roleVariant(member.role)} className="text-[10px] px-1.5 py-0">
          {member.role}
        </Badge>
        <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-transform group-hover:translate-x-0.5" />
      </div>
    </div>
  );

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Team Members & Reporting Line"
      description={`Organizational team context for ${user.name}`}
      maxWidth="lg"
    >
      <div className="space-y-6 pt-2">
        {/* User Card Header */}
        <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
          <div
            className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg shadow-inner shrink-0 ${getAvatarColor(
              user.name
            )}`}
            aria-hidden="true"
          >
            {getInitials(user.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-base text-slate-900 dark:text-slate-100 truncate">
                {user.name}
              </h4>
              <Badge variant={roleVariant(user.role)} className="text-xs">
                {user.role}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              {user.email}
            </p>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-600 dark:text-slate-300">
              {user.department && (
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  {user.department.name}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-3 py-4 animate-pulse">
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
            <div className="h-12 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/4 mt-4" />
            <div className="h-12 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
          </div>
        )}

        {/* Error State */}
        {isError && (
          <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-center">
            <p className="text-xs font-semibold text-rose-800 dark:text-rose-300">
              Failed to load team relationships.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="mt-2 text-xs"
            >
              Retry
            </Button>
          </div>
        )}

        {/* Loaded Team Data */}
        {!isLoading && !isError && teamData && (
          <div className="space-y-5 max-h-[55vh] overflow-y-auto pr-1">
            {/* Reporting Manager Section */}
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                <UserCheck className="w-4 h-4 text-indigo-500" />
                <span>Reporting Manager</span>
              </div>
              {teamData.manager ? (
                renderMemberRow(teamData.manager, `Manager • ${teamData.manager.email}`)
              ) : (
                <div className="p-3 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
                  {user.role === "ADMIN"
                    ? "Executive / Top-level leader (No manager above)"
                    : "No direct reporting manager assigned"}
                </div>
              )}
            </div>

            {/* Direct Reports Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  <Users className="w-4 h-4 text-emerald-500" />
                  <span>Direct Reports</span>
                </div>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {teamData.directReports.length} {teamData.directReports.length === 1 ? "member" : "members"}
                </span>
              </div>
              {teamData.directReports.length > 0 ? (
                <div className="space-y-1.5">
                  {teamData.directReports.map((report) => renderMemberRow(report))}
                </div>
              ) : (
                <div className="p-3 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
                  No direct reports (individual contributor).
                </div>
              )}
            </div>

            {/* Peers Section */}
            {teamData.peers.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    <Users className="w-4 h-4 text-blue-500" />
                    <span>Teammates / Peers</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {teamData.peers.length} {teamData.peers.length === 1 ? "peer" : "peers"}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {teamData.peers.map((peer) => renderMemberRow(peer))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
