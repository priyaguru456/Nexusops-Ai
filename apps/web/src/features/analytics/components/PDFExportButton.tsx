import React, { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "../../../components/ui/button";

interface PDFExportButtonProps {
  reportTitle?: string;
}

export const PDFExportButton: React.FC<PDFExportButtonProps> = ({
  reportTitle = "NexusOps-AI-Analytics-Report",
}) => {
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPDF = () => {
    try {
      setIsExporting(true);
      const originalTitle = document.title;
      const dateStamp = new Date().toISOString().slice(0, 10);
      document.title = `${reportTitle}-${dateStamp}`;

      // Allow DOM state update and initiate print/save as PDF
      setTimeout(() => {
        window.print();
        setIsExporting(false);
        document.title = originalTitle;
      }, 100);
    } catch {
      setIsExporting(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isExporting}
      onClick={handleExportPDF}
      aria-label="Export analytics report to PDF"
      className="h-9 gap-1.5 text-xs font-semibold shadow-xs border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
    >
      {isExporting ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
          <span>Generating PDF...</span>
        </>
      ) : (
        <>
          <FileDown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          <span>Export PDF</span>
        </>
      )}
    </Button>
  );
};
