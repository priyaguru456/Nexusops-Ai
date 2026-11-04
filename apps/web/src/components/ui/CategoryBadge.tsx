import React from "react";
import {
  Laptop,
  Users,
  DollarSign,
  Building2,
  FolderKanban,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";
import type { RequestCategory } from "../../types/requests";

interface CategoryConfig {
  label: string;
  icon: LucideIcon;
  bg: string;
  text: string;
  border: string;
  iconColor: string;
}

const CATEGORY_MAP: Record<string, CategoryConfig> = {
  IT: {
    label: "IT",
    icon: Laptop,
    bg: "bg-blue-50 dark:bg-blue-950/50",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800/70",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  HR: {
    label: "HR",
    icon: Users,
    bg: "bg-purple-50 dark:bg-purple-950/50",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-200 dark:border-purple-800/70",
    iconColor: "text-purple-600 dark:text-purple-400",
  },
  FINANCE: {
    label: "Finance",
    icon: DollarSign,
    bg: "bg-emerald-50 dark:bg-emerald-950/50",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800/70",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  FACILITIES: {
    label: "Facilities",
    icon: Building2,
    bg: "bg-amber-50 dark:bg-amber-950/50",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800/70",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  OTHER: {
    label: "Other",
    icon: FolderKanban,
    bg: "bg-slate-100 dark:bg-slate-800/60",
    text: "text-slate-700 dark:text-slate-300",
    border: "border-slate-200 dark:border-slate-700",
    iconColor: "text-slate-500 dark:text-slate-400",
  },
};

export function getCategoryConfig(category: string): CategoryConfig {
  const normalized = (category || "").toUpperCase();
  return (
    CATEGORY_MAP[normalized] || {
      label: category || "Other",
      icon: HelpCircle,
      bg: "bg-slate-100 dark:bg-slate-800/60",
      text: "text-slate-700 dark:text-slate-300",
      border: "border-slate-200 dark:border-slate-700",
      iconColor: "text-slate-500 dark:text-slate-400",
    }
  );
}

interface CategoryBadgeProps {
  category: RequestCategory | string;
  className?: string;
  size?: "sm" | "md";
  showIcon?: boolean;
}

export function CategoryBadge({
  category,
  className = "",
  size = "md",
  showIcon = true,
}: CategoryBadgeProps): React.JSX.Element {
  const config = getCategoryConfig(category);
  const IconComponent = config.icon;
  const sizeClasses =
    size === "sm"
      ? "px-2 py-0.5 text-[11px] gap-1"
      : "px-2.5 py-1 text-xs font-medium gap-1.5";
  const iconSize = size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";

  return (
    <span
      className={`inline-flex items-center rounded-md border font-medium transition-colors ${config.bg} ${config.text} ${config.border} ${sizeClasses} ${className}`}
      aria-label={`Category: ${config.label}`}
    >
      {showIcon && (
        <IconComponent className={`${iconSize} ${config.iconColor} shrink-0`} aria-hidden="true" />
      )}
      <span>{config.label}</span>
    </span>
  );
}
