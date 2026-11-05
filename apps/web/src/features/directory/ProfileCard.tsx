import React, { useState } from "react";
import { Mail, Building2, UserCheck, Users, Copy, Check } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import type { DirectoryUser } from "../../types/directory";
import type { Role } from "../../types/auth";

interface ProfileCardProps {
  user: DirectoryUser;
  onViewTeam: (user: DirectoryUser) => void;
}

export function getInitials(name?: string): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function getAvatarColor(name: string): string {
  const colors = [
    "bg-indigo-600 text-white",
    "bg-blue-600 text-white",
    "bg-emerald-600 text-white",
    "bg-violet-600 text-white",
    "bg-amber-600 text-white",
    "bg-rose-600 text-white",
    "bg-teal-600 text-white",
    "bg-cyan-600 text-white",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function ProfileCard({ user, onViewTeam }: ProfileCardProps): React.JSX.Element {
  const [copied, setCopied] = useState(false);

  const handleCopyEmail = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(user.email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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

  const initials = getInitials(user.name);
  const avatarClass = getAvatarColor(user.name);

  return (
    <div
      tabIndex={0}
      aria-label={`Profile card for ${user.name}`}
      className="group relative flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
    >
      <div>
        {/* Top Header: Avatar & Role Badge */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-base shadow-inner shrink-0 ${avatarClass}`}
              aria-hidden="true"
            >
              {initials}
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-base text-slate-900 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {user.name}
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Badge variant={roleVariant(user.role)} className="text-[11px] font-medium uppercase px-2 py-0">
                  {user.role}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Details List */}
        <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-400 mb-4">
          {/* Email with copy */}
          <div className="flex items-center justify-between gap-2 group/email">
            <div className="flex items-center gap-2 min-w-0">
              <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
              <a
                href={`mailto:${user.email}`}
                className="truncate hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline"
                title={`Send email to ${user.email}`}
                onClick={(e) => e.stopPropagation()}
              >
                {user.email}
              </a>
            </div>
            <button
              type="button"
              onClick={handleCopyEmail}
              aria-label={copied ? "Copied email" : `Copy email address for ${user.name}`}
              className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500"
              title="Copy email"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {/* Department */}
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
            <span className="truncate">
              {user.department ? (
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {user.department.name}
                </span>
              ) : (
                <span className="text-slate-400 italic">No department assigned</span>
              )}
            </span>
          </div>

          {/* Reporting Manager */}
          <div className="flex items-center gap-2 min-w-0">
            <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
            <span className="truncate">
              {user.manager ? (
                <span>
                  Reports to{" "}
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {user.manager.name}
                  </span>
                </span>
              ) : (
                <span className="text-slate-500 dark:text-slate-400">
                  {user.role === "ADMIN" ? "Executive / Head" : "No manager assigned"}
                </span>
              )}
            </span>
          </div>

          {/* Direct Reports Count Badge if any */}
          {user.directReportsCount > 0 && (
            <div className="pt-1 flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-medium">
              <Users className="w-3.5 h-3.5" aria-hidden="true" />
              <span>
                {user.directReportsCount} {user.directReportsCount === 1 ? "direct report" : "direct reports"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Footer Action */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 mt-auto flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onViewTeam(user)}
          className="w-full justify-center gap-1.5 text-xs font-semibold hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/30 dark:hover:text-indigo-400"
          aria-label={`View team of ${user.name}`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>View Team</span>
        </Button>
      </div>
    </div>
  );
}
