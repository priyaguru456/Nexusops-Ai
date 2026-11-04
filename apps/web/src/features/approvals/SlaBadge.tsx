import React from "react";
import { formatKolkataDateTime } from "../../lib/date";

export interface SlaBadgeProps {
  activatedAt?: string | null;
  createdAt: string;
  escalatedAt?: string | null;
  escalationThresholdHours?: number | null;
  className?: string;
}

export function calculateSlaStatus(
  activatedAt: string | null | undefined,
  createdAt: string,
  escalatedAt: string | null | undefined,
  escalationThresholdHours: number | null | undefined,
  currentTimeMs: number = Date.now()
) {
  const activationTimeStr = activatedAt || createdAt;
  const activationDate = new Date(activationTimeStr);
  const elapsedMs = Math.max(0, currentTimeMs - activationDate.getTime());
  const elapsedHours = elapsedMs / (1000 * 60 * 60);

  // SLA Color: green under 24h, amber 24–48h, red over 48h
  let variant: "green" | "amber" | "red" = "green";
  if (elapsedHours > 48) {
    variant = "red";
  } else if (elapsedHours >= 24) {
    variant = "amber";
  }

  // Elapsed label
  const elapsedDisplay =
    elapsedHours < 1
      ? "< 1h pending"
      : `${Math.floor(elapsedHours)}h pending`;

  // Escalation info: only if real escalation threshold exists and is > 0
  let escalationLabel: string | null = null;
  const hasThreshold =
    typeof escalationThresholdHours === "number" && escalationThresholdHours > 0;

  if (hasThreshold) {
    if (escalatedAt) {
      escalationLabel = "Escalated";
    } else if (elapsedHours < escalationThresholdHours) {
      const remainingHours = Math.max(
        1,
        Math.ceil(escalationThresholdHours - elapsedHours)
      );
      escalationLabel = `Escalates in ${remainingHours}h`;
    } else {
      escalationLabel = "Escalation Overdue";
    }
  }

  return {
    variant,
    elapsedHours,
    elapsedDisplay,
    escalationLabel,
    activationTimeStr,
    isEscalated: Boolean(escalatedAt),
  };
}

export const SlaBadge: React.FC<SlaBadgeProps> = ({
  activatedAt,
  createdAt,
  escalatedAt,
  escalationThresholdHours,
  className = "",
}) => {
  const { variant, elapsedDisplay, escalationLabel, activationTimeStr, isEscalated } =
    calculateSlaStatus(
      activatedAt,
      createdAt,
      escalatedAt,
      escalationThresholdHours
    );

  const variantStyles = {
    green:
      "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/80",
    amber:
      "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/80",
    red:
      "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/80",
  };

  const dotColors = {
    green: "bg-emerald-500",
    amber: "bg-amber-500",
    red: "bg-rose-500",
  };

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium tracking-tight shadow-2xs transition-colors ${variantStyles[variant]} ${className}`}
      title={`Activated: ${formatKolkataDateTime(activationTimeStr)} (IST)`}
      aria-label={`SLA status: ${elapsedDisplay}${escalationLabel ? `, ${escalationLabel}` : ""}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]} ${
          variant === "red" ? "animate-pulse" : ""
        }`}
      />
      <span className="font-semibold">{elapsedDisplay}</span>

      {escalationLabel && (
        <>
          <span className="text-slate-300 dark:text-slate-600">•</span>
          <span
            className={`font-medium ${
              isEscalated
                ? "font-bold text-rose-600 dark:text-rose-400"
                : "text-slate-600 dark:text-slate-300"
            }`}
          >
            {escalationLabel}
          </span>
        </>
      )}
    </div>
  );
};
