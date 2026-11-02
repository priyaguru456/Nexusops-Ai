import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, FileText, CheckSquare, Loader2, CornerDownLeft, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { searchApi, type SearchResultRequest, type SearchResultTask } from "../../features/search/api";
import { Badge } from "../ui/badge";

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type FlattenedItem =
  | ({ itemType: "request" } & SearchResultRequest)
  | ({ itemType: "task" } & SearchResultTask);

export function GlobalSearchModal({ isOpen, onClose }: GlobalSearchModalProps): React.JSX.Element | null {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Debounce input by 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchTerm.trim());
      setSelectedIndex(0);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setSearchTerm("");
      setDebouncedQuery("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Query search endpoint with TanStack Query and abort signal for stale cancellation
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["global-search", debouncedQuery],
    queryFn: ({ signal }) => searchApi.search(debouncedQuery, signal),
    enabled: isOpen && debouncedQuery.length >= 2,
    staleTime: 1000 * 30, // 30s cache
  });

  const flattenedItems = useMemo<FlattenedItem[]>(() => {
    if (!data) return [];
    const requests = (data.requests || []).map((r) => ({ ...r, itemType: "request" as const }));
    const tasks = (data.tasks || []).map((t) => ({ ...t, itemType: "task" as const }));
    return [...requests, ...tasks];
  }, [data]);

  const handleSelect = (item: FlattenedItem) => {
    onClose();
    if (item.itemType === "request") {
      navigate(`/requests/${item.id}`);
    } else {
      // Navigate to tasks or request detail
      navigate(item.requestId ? `/requests/${item.requestId}` : `/tasks`);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (flattenedItems.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % flattenedItems.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + flattenedItems.length) % flattenedItems.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (flattenedItems[selectedIndex]) {
          handleSelect(flattenedItems[selectedIndex]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, flattenedItems, selectedIndex, onClose]);

  // Scroll active item into view
  useEffect(() => {
    if (resultsRef.current && flattenedItems.length > 0) {
      const activeEl = resultsRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex, flattenedItems.length]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 md:pt-24 px-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Global Search"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Search Palette Container */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden z-10 flex flex-col max-h-[80vh]">
        {/* Search Header Input */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 gap-3">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search work requests, tasks, and issues..."
            className="flex-1 bg-transparent border-0 text-sm md:text-base font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-0"
            aria-label="Global search query"
          />
          {isFetching ? (
            <Loader2 className="w-4 h-4 text-indigo-500 animate-spin shrink-0" />
          ) : searchTerm ? (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              aria-label="Clear search input"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
              ESC
            </kbd>
          )}
        </div>

        {/* Results Area */}
        <div ref={resultsRef} className="flex-1 overflow-y-auto p-2 divide-y divide-slate-100 dark:divide-slate-800/60">
          {debouncedQuery.length < 2 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Type at least 2 characters to search across requests and tasks.
            </div>
          ) : isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-slate-400">
              <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
              <span>Searching across your workspace...</span>
            </div>
          ) : flattenedItems.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No results found
              </p>
              <p className="text-xs text-slate-400 mt-1">
                No requests or tasks matched &ldquo;{debouncedQuery}&rdquo;.
              </p>
            </div>
          ) : (
            <>
              {/* Requests Section */}
              {data?.requests && data.requests.length > 0 && (
                <div className="py-2">
                  <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Work Requests ({data.requests.length})
                  </div>
                  <div className="space-y-1">
                    {data.requests.map((item) => {
                      const idx = flattenedItems.findIndex(
                        (fi) => fi.itemType === "request" && fi.id === item.id
                      );
                      const isSelected = selectedIndex === idx;
                      return (
                        <div
                          key={`request-${item.id}`}
                          data-index={idx}
                          onClick={() => handleSelect({ ...item, itemType: "request" })}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-indigo-50 dark:bg-indigo-950/70 text-indigo-900 dark:text-indigo-200"
                              : "hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-800 dark:text-slate-200"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-medium truncate">{item.title}</p>
                              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                                <span>{item.category}</span>
                                <span>•</span>
                                <span>by {item.requesterName}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                              {item.status}
                            </Badge>
                            {isSelected && (
                              <CornerDownLeft className="w-3.5 h-3.5 text-indigo-500 hidden sm:block" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tasks Section */}
              {data?.tasks && data.tasks.length > 0 && (
                <div className="py-2">
                  <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Tasks ({data.tasks.length})
                  </div>
                  <div className="space-y-1">
                    {data.tasks.map((item) => {
                      const idx = flattenedItems.findIndex(
                        (fi) => fi.itemType === "task" && fi.id === item.id
                      );
                      const isSelected = selectedIndex === idx;
                      return (
                        <div
                          key={`task-${item.id}`}
                          data-index={idx}
                          onClick={() => handleSelect({ ...item, itemType: "task" })}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-indigo-50 dark:bg-indigo-950/70 text-indigo-900 dark:text-indigo-200"
                              : "hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-800 dark:text-slate-200"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                              <CheckSquare className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-medium truncate">{item.title}</p>
                              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                                <span>{item.assigneeName ? `Assigned to ${item.assigneeName}` : "Unassigned"}</span>
                                {item.dueDate && (
                                  <>
                                    <span>•</span>
                                    <span>Due {new Date(item.dueDate).toLocaleDateString()}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                              {item.status}
                            </Badge>
                            {isSelected && (
                              <CornerDownLeft className="w-3.5 h-3.5 text-indigo-500 hidden sm:block" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Shortcut Bar */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-[10px]">
                ↑
              </kbd>
              <kbd className="px-1 py-0.5 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-[10px]">
                ↓
              </kbd>
              to navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-[10px]">
                ↵
              </kbd>
              to open
            </span>
          </div>
          <div>Scoped to your role permissions</div>
        </div>
      </div>
    </div>
  );
}
