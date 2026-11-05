import React from "react";
import { AlertTriangle, Clock, ShieldCheck } from "lucide-react";
import { formatKolkataDate } from "../../lib/utils";

interface WarrantyBadgeProps {
  warrantyExpiresAt?: string | null;
  className?: string;
  showDate?: boolean;
}

export const WarrantyBadge: React.FC<WarrantyBadgeProps> = ({
  warrantyExpiresAt,
  className = "",
  showDate = false,
}) => {
  if (!warrantyExpiresAt) {
    return (
      <span className={`inline-flex items-center text-xs text-slate-400 dark:text-slate-500 ${className}`}>
        —
      </span>
    );
  }

  const expiry = new Date(warrantyExpiresAt);
  if (isNaN(expiry.getTime())) {
    return null;
  }

  const now = new Date();
  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    // Expired
    const daysAgo = Math.abs(diffDays);
    return (
      <span
        title={`Expired on ${formatKolkataDate(warrantyExpiresAt)}`}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 ${className}`}
      >
        <AlertTriangle className="w-3 h-3 shrink-0" />
        <span>Expired {daysAgo > 1 ? `(${daysAgo}d ago)` : ""}</span>
        {showDate && <span className="opacity-75 text-[10px]">({formatKolkataDate(warrantyExpiresAt)})</span>}
      </span>
    );
  }

  if (diffDays <= 30) {
    // Expiring within 30 days
    return (
      <span
        title={`Expires on ${formatKolkataDate(warrantyExpiresAt)}`}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 ${className}`}
      >
        <Clock className="w-3 h-3 shrink-0 text-amber-600 dark:text-amber-400" />
        <span>Expiring in {diffDays}d</span>
        {showDate && <span className="opacity-75 text-[10px]">({formatKolkataDate(warrantyExpiresAt)})</span>}
      </span>
    );
  }

  // Active / Valid
  return (
    <span
      title={`Warranty expires on ${formatKolkataDate(warrantyExpiresAt)}`}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-50 text-slate-700 border border-slate-200 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700 ${className}`}
    >
      <ShieldCheck className="w-3 h-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
      <span>Valid until {formatKolkataDate(warrantyExpiresAt)}</span>
    </span>
  );
};
