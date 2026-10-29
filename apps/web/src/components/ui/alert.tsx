import * as React from "react";
import { cn } from "../../lib/utils";

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "destructive" | "success";
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = "default", ...props }, ref) => {
    const variants = {
      default: "bg-slate-50 border-slate-200 text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200",
      destructive:
        "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/50 dark:border-red-900 dark:text-red-300",
      success:
        "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/50 dark:border-emerald-900 dark:text-emerald-300",
    };

    return (
      <div
        ref={ref}
        role="alert"
        className={cn("relative w-full rounded-lg border p-3 text-sm", variants[variant], className)}
        {...props}
      />
    );
  }
);

Alert.displayName = "Alert";
