import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Calendar, ChevronDown } from "lucide-react";
import { Button } from "../../../components/ui/button";

interface DateRangeFilterProps {
  onRangeChange?: (from: string, to: string) => void;
}

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({ onRangeChange }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showCustom, setShowCustom] = useState(false);

  const currentFrom = searchParams.get("from") || "";
  const currentTo = searchParams.get("to") || "";

  const formatDate = (date: Date): string => {
    return date.toISOString().slice(0, 10);
  };

  const setPreset = (days: number) => {
    const to = new Date();
    const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
    const fromStr = formatDate(from);
    const toStr = formatDate(to);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("from", fromStr);
    nextParams.set("to", toStr);
    setSearchParams(nextParams);
    onRangeChange?.(fromStr, toStr);
    setShowCustom(false);
  };

  const handleCustomApply = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fromInput = form.elements.namedItem("from") as HTMLInputElement;
    const toInput = form.elements.namedItem("to") as HTMLInputElement;

    if (fromInput.value && toInput.value) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set("from", fromInput.value);
      nextParams.set("to", toInput.value);
      setSearchParams(nextParams);
      onRangeChange?.(fromInput.value, toInput.value);
      setShowCustom(false);
    }
  };

  // Determine active preset label
  let activePreset = "Last 30 Days";
  if (currentFrom && currentTo) {
    const diffDays = Math.round(
      (new Date(currentTo).getTime() - new Date(currentFrom).getTime()) / (24 * 60 * 60 * 1000)
    );
    if (diffDays <= 7) activePreset = "Last 7 Days";
    else if (diffDays <= 31) activePreset = "Last 30 Days";
    else if (diffDays <= 92) activePreset = "Last 90 Days";
    else if (diffDays >= 360) activePreset = "This Year";
    else activePreset = "Custom";
  }

  return (
    <div className="relative inline-flex flex-col sm:flex-row sm:items-center gap-2">
      <div className="inline-flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-xs">
        <Calendar className="w-4 h-4 ml-2 text-slate-500 shrink-0" />

        <button
          type="button"
          onClick={() => setPreset(7)}
          className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
            activePreset === "Last 7 Days" && !showCustom
              ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          }`}
        >
          7D
        </button>

        <button
          type="button"
          onClick={() => setPreset(30)}
          className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
            activePreset === "Last 30 Days" && !showCustom
              ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          }`}
        >
          30D
        </button>

        <button
          type="button"
          onClick={() => setPreset(90)}
          className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
            activePreset === "Last 90 Days" && !showCustom
              ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          }`}
        >
          90D
        </button>

        <button
          type="button"
          onClick={() => setPreset(365)}
          className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
            activePreset === "This Year" && !showCustom
              ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          }`}
        >
          1Y
        </button>

        <button
          type="button"
          onClick={() => setShowCustom((prev) => !prev)}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
            showCustom || activePreset === "Custom"
              ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
          }`}
        >
          <span>Custom</span>
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>

      {/* Custom Date Range Popover */}
      {showCustom && (
        <div className="absolute top-full sm:right-0 mt-2 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg z-30 min-w-[260px] animate-in fade-in duration-150">
          <form onSubmit={handleCustomApply} className="space-y-2.5 text-xs">
            <div>
              <label className="block text-slate-500 mb-1 font-medium">From Date (UTC)</label>
              <input
                type="date"
                name="from"
                defaultValue={currentFrom}
                required
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-1 font-medium">To Date (UTC)</label>
              <input
                type="date"
                name="to"
                defaultValue={currentTo}
                required
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowCustom(false)}
                className="h-7 text-xs"
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" className="h-7 text-xs">
                Apply
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
