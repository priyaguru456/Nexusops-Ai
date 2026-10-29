import * as React from "react";
import { cn } from "../../lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = "default",
  ...props
}) => {
  const variants = {
    default: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 border-transparent",
    secondary: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-transparent",
    destructive: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 border-transparent",
    outline: "text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700",
    success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 border-transparent",
    warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 border-transparent",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        variants[variant],
        className
      )}
      {...props}
    />
  );
};
