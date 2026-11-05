import React from "react";
import type { AssetStatus } from "./types";

interface AssetStatusBadgeProps {
  status: AssetStatus;
  size?: "sm" | "md";
  className?: string;
}

export const AssetStatusBadge: React.FC<AssetStatusBadgeProps> = ({
  status,
  size = "md",
  className = "",
}) => {
  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";

  const getVariant = () => {
    switch (status) {
      case "AVAILABLE":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800";
      case "ASSIGNED":
        return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800";
      case "IN_REPAIR":
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800";
      case "RETIRED":
        return "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300";
    }
  };

  const getLabel = () => {
    switch (status) {
      case "AVAILABLE":
        return "Available";
      case "ASSIGNED":
        return "Assigned";
      case "IN_REPAIR":
        return "In Repair";
      case "RETIRED":
        return "Retired";
      default:
        return status;
    }
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border shadow-xs select-none transition-colors ${sizeClasses} ${getVariant()} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 shrink-0 bg-current opacity-80" />
      {getLabel()}
    </span>
  );
};
