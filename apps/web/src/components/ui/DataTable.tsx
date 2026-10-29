import React from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from "lucide-react";
import { TableSkeleton } from "./LoadingSkeleton";
import { EmptyState } from "./EmptyState";
import { Button } from "./button";

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (row: T) => void;
  // Sorting
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  onSort?: (columnKey: string) => void;
  // Pagination
  page?: number;
  totalPages?: number;
  total?: number;
  onPageChange?: (newPage: number) => void;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  emptyTitle = "No records found",
  emptyDescription = "There are currently no items matching your criteria.",
  onRowClick,
  sortBy,
  sortOrder,
  onSort,
  page,
  totalPages,
  total,
  onPageChange,
  className = "",
}: DataTableProps<T>): React.JSX.Element {
  if (isLoading) {
    return (
      <div className={`rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden ${className}`}>
        <TableSkeleton rows={5} cols={columns.length} />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={`rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 ${className}`}>
        <EmptyState title={emptyTitle} description={emptyDescription} />
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm flex flex-col ${className}`}
    >
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold select-none">
            <tr>
              {columns.map((col) => {
                const isSorted = sortBy === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    onClick={() => col.sortable && onSort?.(col.key)}
                    className={`py-3.5 px-4 ${col.sortable ? "cursor-pointer hover:text-slate-900 dark:hover:text-slate-100 transition-colors" : ""} ${col.headerClassName || ""}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{col.header}</span>
                      {col.sortable && (
                        <span className="text-slate-400">
                          {isSorted ? (
                            sortOrder === "asc" ? (
                              <ArrowUp className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            ) : (
                              <ArrowDown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 opacity-40 hover:opacity-100" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
            {data.map((row) => (
              <tr
                key={keyExtractor(row)}
                onClick={() => onRowClick?.(row)}
                className={`transition-colors ${
                  onRowClick
                    ? "cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    : "hover:bg-slate-50/40 dark:hover:bg-slate-800/20"
                }`}
              >
                {columns.map((col) => (
                  <td key={col.key} className={`py-3 px-4 align-middle ${col.className || ""}`}>
                    {col.render
                      ? col.render(row)
                      : String((row as Record<string, unknown>)[col.key] ?? "-")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      {totalPages !== undefined && page !== undefined && totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-xs text-slate-500 dark:text-slate-400">
          <div>
            {total !== undefined ? (
              <span>
                Total <strong className="text-slate-800 dark:text-slate-200">{total}</strong> items
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <span>
              Page <strong className="text-slate-800 dark:text-slate-200">{page}</strong> of{" "}
              <strong className="text-slate-800 dark:text-slate-200">{totalPages}</strong>
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => onPageChange?.(page - 1)}
                className="h-8 w-8 p-0"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => onPageChange?.(page + 1)}
                className="h-8 w-8 p-0"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
