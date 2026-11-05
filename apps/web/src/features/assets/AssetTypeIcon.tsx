import React from "react";
import { Laptop, Monitor, Smartphone, Key, Headphones } from "lucide-react";
import type { AssetType } from "./types";

interface AssetTypeIconProps {
  type: AssetType;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const AssetTypeIcon: React.FC<AssetTypeIconProps> = ({
  type,
  className = "",
  size = "md",
}) => {
  const sizeClasses = {
    sm: "w-3.5 h-3.5",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  const iconClass = `${sizeClasses[size]} ${className}`;

  switch (type) {
    case "LAPTOP":
      return <Laptop className={`${iconClass} text-indigo-600 dark:text-indigo-400`} aria-label="Laptop" />;
    case "MONITOR":
      return <Monitor className={`${iconClass} text-sky-600 dark:text-sky-400`} aria-label="Monitor" />;
    case "PHONE":
      return <Smartphone className={`${iconClass} text-violet-600 dark:text-violet-400`} aria-label="Phone" />;
    case "LICENSE":
      return <Key className={`${iconClass} text-emerald-600 dark:text-emerald-400`} aria-label="License" />;
    case "ACCESSORY":
      return <Headphones className={`${iconClass} text-amber-600 dark:text-amber-400`} aria-label="Accessory" />;
    default:
      return <Laptop className={iconClass} aria-label="Asset" />;
  }
};
