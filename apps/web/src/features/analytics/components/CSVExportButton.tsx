import React, { useState } from "react";
import { Download, Loader2, ChevronDown } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { analyticsApi } from "../api";
import { toast } from "../../../components/ui/toast";
import { useAuth } from "../../auth/AuthContext";

interface CSVExportButtonProps {
  from?: string;
  to?: string;
}

export const CSVExportButton: React.FC<CSVExportButtonProps> = ({ from, to }) => {
  const { role } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState<string | null>(null);

  const handleExport = async (type: "requests" | "tasks" | "approvals" | "ai-usage") => {
    try {
      setIsExporting(type);
      setIsOpen(false);
      await analyticsApi.downloadCSV(type, from, to);
      toast.success(`${type.toUpperCase()} CSV export downloaded successfully`);
    } catch (err: unknown) {
      toast.error((err as Error)?.message || "Failed to download CSV export");
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className="relative inline-block text-left">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={Boolean(isExporting)}
        onClick={() => setIsOpen((prev) => !prev)}
        className="h-9 gap-1.5 text-xs font-semibold shadow-xs border-slate-300 dark:border-slate-700"
      >
        {isExporting ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
            <span>Exporting {isExporting}...</span>
          </>
        ) : (
          <>
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
            <ChevronDown className="w-3.5 h-3.5 opacity-60 ml-0.5" />
          </>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl z-30 py-1.5 animate-in fade-in duration-150">
          <button
            type="button"
            onClick={() => handleExport("requests")}
            className="w-full text-left px-3.5 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Export Requests
          </button>
          <button
            type="button"
            onClick={() => handleExport("tasks")}
            className="w-full text-left px-3.5 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Export Tasks
          </button>
          <button
            type="button"
            onClick={() => handleExport("approvals")}
            className="w-full text-left px-3.5 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Export Approvals
          </button>
          {role === "ADMIN" && (
            <button
              type="button"
              onClick={() => handleExport("ai-usage")}
              className="w-full text-left px-3.5 py-2 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 font-medium transition-colors cursor-pointer border-t border-slate-100 dark:border-slate-800"
            >
              Export AI Usage (Admin)
            </button>
          )}
        </div>
      )}
    </div>
  );
};
