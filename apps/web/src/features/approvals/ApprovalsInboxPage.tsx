import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  XCircle,
  ExternalLink,
  ClipboardCheck,
  Search,
  DollarSign,
  Calendar,
  User as UserIcon,
  Building,
  Filter,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
  MinusSquare,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import {
  usePendingApprovals,
  useApproveStep,
  useRejectStep,
  useBulkApprove,
} from "./hooks";
import { SlaBadge } from "./SlaBadge";
import { ApprovePopover } from "./ApprovePopover";
import { RejectModal } from "./RejectModal";
import { BulkApproveModal } from "./BulkApproveModal";
import { BulkResultsModal } from "./BulkResultsModal";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { PriorityBadge } from "../../components/ui/PriorityBadge";
import { Button } from "../../components/ui/button";
import { BackButton } from "../../components/ui/BackButton";
import { EmptyState } from "../../components/ui/EmptyState";
import { LoadingSkeleton } from "../../components/ui/LoadingSkeleton";
import { formatKolkataDate } from "../../lib/date";
import type {
  PendingApprovalStep,
  BulkApproveResponse,
} from "../../types/approvals";
import type { Priority } from "../../types/requests";

type SortOption = "newest" | "oldest" | "priority";
type PriorityFilter = "ALL" | Priority;

const PRIORITY_ORDER: Record<Priority, number> = {
  URGENT: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export const ApprovalsInboxPage: React.FC = () => {
  const { user } = useAuth();
  const { data, isLoading, error, refetch, isFetching } = usePendingApprovals();
  const approveMutation = useApproveStep();
  const rejectMutation = useRejectStep();
  const bulkApproveMutation = useBulkApprove();

  // Role permissions check
  const canBulkApprove = user?.role === "MANAGER" || user?.role === "ADMIN";

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("ALL");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Selection states for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Dialog / Popover states
  const [activeApprovePopoverId, setActiveApprovePopoverId] = useState<string | null>(null);
  const [rejectStepTarget, setRejectStepTarget] = useState<PendingApprovalStep | null>(null);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkResultResponse, setBulkResultResponse] = useState<BulkApproveResponse | null>(null);

  // In-flight action tracking for double-submission prevention
  const [submittingStepId, setSubmittingStepId] = useState<string | null>(null);

  const steps = data?.steps || [];
  const escalationThresholdHours = data?.escalationAfterHours ?? null;

  // Filter and sort steps
  const processedSteps = useMemo(() => {
    let result = [...steps];

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      result = result.filter(
        (step) =>
          step.request.title.toLowerCase().includes(term) ||
          step.request.category.toLowerCase().includes(term) ||
          step.request.requester.name.toLowerCase().includes(term) ||
          step.request.id.toLowerCase().includes(term) ||
          (step.request.requester.department?.name &&
            step.request.requester.department.name.toLowerCase().includes(term))
      );
    }

    // Priority filter
    if (priorityFilter !== "ALL") {
      result = result.filter((step) => step.request.priority === priorityFilter);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === "oldest") {
        const timeA = new Date(a.activatedAt || a.createdAt).getTime();
        const timeB = new Date(b.activatedAt || b.createdAt).getTime();
        return timeA - timeB; // Oldest pending first
      }

      if (sortBy === "priority") {
        const orderA = PRIORITY_ORDER[a.request.priority] || 0;
        const orderB = PRIORITY_ORDER[b.request.priority] || 0;
        if (orderB !== orderA) return orderB - orderA; // Urgent first
        // Secondary sort by oldest pending
        const timeA = new Date(a.activatedAt || a.createdAt).getTime();
        const timeB = new Date(b.activatedAt || b.createdAt).getTime();
        return timeA - timeB;
      }

      // Default: "newest"
      const timeA = new Date(a.activatedAt || a.createdAt).getTime();
      const timeB = new Date(b.activatedAt || b.createdAt).getTime();
      return timeB - timeA;
    });

    return result;
  }, [steps, searchTerm, priorityFilter, sortBy]);

  // Pagination calculations
  const totalItems = processedSteps.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const paginatedSteps = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return processedSteps.slice(start, start + itemsPerPage);
  }, [processedSteps, currentPage, itemsPerPage]);

  // Handle single item selection
  const handleToggleSelect = (stepId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  // Handle select all on current page
  const isAllPageSelected =
    paginatedSteps.length > 0 &&
    paginatedSteps.every((step) => selectedIds.has(step.id));
  const isSomePageSelected =
    paginatedSteps.some((step) => selectedIds.has(step.id)) && !isAllPageSelected;

  const handleToggleSelectAllPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (isAllPageSelected) {
        paginatedSteps.forEach((s) => next.delete(s.id));
      } else {
        paginatedSteps.forEach((s) => next.add(s.id));
      }
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Inline Single Approve submission
  const handleConfirmApprove = async (stepId: string, comment?: string) => {
    try {
      setSubmittingStepId(stepId);
      await approveMutation.mutateAsync({
        stepId,
        payload: { comment },
      });
      setActiveApprovePopoverId(null);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(stepId);
        return next;
      });
    } catch {
      // Error is caught and surfaced via toast in hook
    } finally {
      setSubmittingStepId(null);
    }
  };

  // Modal Single Reject submission
  const handleConfirmReject = async (reason: string) => {
    if (!rejectStepTarget) return;
    const stepId = rejectStepTarget.id;

    try {
      setSubmittingStepId(stepId);
      await rejectMutation.mutateAsync({
        stepId,
        payload: { comment: reason },
      });
      setRejectStepTarget(null);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(stepId);
        return next;
      });
    } catch {
      // Error surfaced in hook
    } finally {
      setSubmittingStepId(null);
    }
  };

  // Bulk Approve submission
  const selectedStepsList = useMemo(() => {
    return steps.filter((step) => selectedIds.has(step.id));
  }, [steps, selectedIds]);

  const handleConfirmBulkApprove = async (comment?: string) => {
    if (selectedStepsList.length === 0) return;

    try {
      const stepIds = selectedStepsList.map((s) => s.id);
      const res = await bulkApproveMutation.mutateAsync({
        stepIds,
        comment,
      });

      setIsBulkModalOpen(false);
      setSelectedIds(new Set());

      // If any failed or mixed, show detailed results modal
      if (res.summary.failed > 0) {
        setBulkResultResponse(res);
      }
    } catch {
      // Error handled in hook
    }
  };

  const isAnySaving =
    approveMutation.isPending ||
    rejectMutation.isPending ||
    bulkApproveMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <BackButton />
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Approvals Inbox
              </h1>
              <span
                className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                aria-label={`${steps.length} pending approvals`}
              >
                {steps.length} Pending
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Review and act on operational requests waiting for your authorization
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching || isAnySaving}
            className="gap-1.5 text-xs h-9"
            aria-label="Refresh approvals list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Filter, Search & Sort Control Bar */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Keyword Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by title, requester, department, category..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
              aria-label="Search pending approvals"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Priority Filter */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="priority-filter" className="text-xs font-medium text-slate-500 shrink-0">
                Priority:
              </label>
              <select
                id="priority-filter"
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value as PriorityFilter);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                aria-label="Filter by request priority"
              >
                <option value="ALL">All Priorities</option>
                <option value="URGENT">URGENT</option>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="sort-filter" className="text-xs font-medium text-slate-500 shrink-0">
                Sort:
              </label>
              <select
                id="sort-filter"
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as SortOption);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                aria-label="Sort pending approvals"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest pending first</option>
                <option value="priority">Priority: Urgent to Low</option>
              </select>
            </div>
          </div>
        </div>

        {/* Counter & Active Filter Indicators */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>
              Showing <strong>{processedSteps.length}</strong> of{" "}
              <strong>{steps.length}</strong> pending items
            </span>
          </div>

          {canBulkApprove && selectedIds.size > 0 && (
            <div className="text-indigo-600 dark:text-indigo-400 font-semibold">
              {selectedIds.size} request{selectedIds.size > 1 ? "s" : ""} selected for bulk action
            </div>
          )}
        </div>
      </div>

      {/* Bulk Action Sticky Bar (Managers & Admins only) */}
      {canBulkApprove && selectedIds.size > 0 && (
        <div
          role="region"
          aria-label="Bulk actions toolbar"
          className="sticky top-4 z-20 p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/90 dark:bg-indigo-950/80 backdrop-blur-sm shadow-md flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-150"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-2.5 w-2.5 rounded-full bg-indigo-600 dark:bg-indigo-400 animate-ping" />
            <div className="text-xs text-slate-900 dark:text-slate-100 font-medium">
              <strong className="text-indigo-700 dark:text-indigo-300 font-bold">
                {selectedIds.size}
              </strong>{" "}
              approval step{selectedIds.size > 1 ? "s" : ""} selected
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearSelection}
              disabled={isAnySaving}
              className="h-8 text-xs bg-white dark:bg-slate-900"
            >
              Clear
            </Button>
            <Button
              size="sm"
              onClick={() => setIsBulkModalOpen(true)}
              disabled={isAnySaving}
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Bulk Approve ({selectedIds.size})</span>
            </Button>
          </div>
        </div>
      )}

      {/* Loading & Error States */}
      {isLoading && (
        <div className="space-y-4">
          <LoadingSkeleton className="h-28 w-full rounded-2xl" />
          <LoadingSkeleton className="h-28 w-full rounded-2xl" />
          <LoadingSkeleton className="h-28 w-full rounded-2xl" />
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-800 text-sm text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
          <div>
            <h3 className="font-semibold">Unable to load pending approvals</h3>
            <p className="text-xs mt-0.5">{(error as Error).message}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="mt-2 text-xs h-7"
            >
              Try Again
            </Button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && processedSteps.length === 0 && (
        <EmptyState
          icon={ClipboardCheck}
          title={
            searchTerm || priorityFilter !== "ALL"
              ? "No matching approvals found"
              : "All Caught Up!"
          }
          description={
            searchTerm || priorityFilter !== "ALL"
              ? "Try adjusting your search keywords or priority filter."
              : "There are no pending requests waiting for your authorization right now."
          }
        />
      )}

      {/* Approvals Table / Row List */}
      {!isLoading && !error && paginatedSteps.length > 0 && (
        <div className="space-y-3">
          {/* Header Row with Select All checkbox (if Manager/Admin) */}
          {canBulkApprove && (
            <div className="px-4 py-2 flex items-center justify-between text-xs text-slate-500 font-medium">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <button
                  type="button"
                  onClick={handleToggleSelectAllPage}
                  disabled={isAnySaving}
                  aria-label="Select all on this page"
                  className="text-slate-600 dark:text-slate-300 hover:text-indigo-600 transition-colors"
                >
                  {isAllPageSelected ? (
                    <CheckSquare className="w-4 h-4 text-indigo-600" />
                  ) : isSomePageSelected ? (
                    <MinusSquare className="w-4 h-4 text-indigo-600" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                </button>
                <span>Select all on page ({paginatedSteps.length})</span>
              </label>

              <span>
                Page {currentPage} of {totalPages}
              </span>
            </div>
          )}

          {/* Item Rows */}
          <div className="space-y-3">
            {paginatedSteps.map((step) => {
              const totalSteps = step.request.approvalSteps?.length || 1;
              const isSelected = selectedIds.has(step.id);
              const isStepSaving = submittingStepId === step.id;
              const isRowDisabled = isAnySaving;
              const isApprovePopoverOpen = activeApprovePopoverId === step.id;

              return (
                <div
                  key={step.id}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                    isSelected
                      ? "border-indigo-300 dark:border-indigo-700 bg-indigo-50/20 dark:bg-indigo-950/10 shadow-sm"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs"
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Checkbox + Request info */}
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      {/* Selection Checkbox (Managers & Admins only) */}
                      {canBulkApprove && (
                        <button
                          type="button"
                          onClick={() => handleToggleSelect(step.id)}
                          disabled={isRowDisabled}
                          aria-label={`Select request ${step.request.title}`}
                          className="mt-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors shrink-0"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      )}

                      <div className="space-y-2 flex-1 min-w-0">
                        {/* Top Metadata Badges */}
                        <div className="flex flex-wrap items-center gap-2">
                          {/* SLA Badge */}
                          <SlaBadge
                            activatedAt={step.activatedAt}
                            createdAt={step.createdAt}
                            escalatedAt={step.escalatedAt}
                            escalationThresholdHours={escalationThresholdHours}
                          />

                          {/* Step Order Badge */}
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            Step {step.stepOrder} of {totalSteps} ({step.approverRole})
                          </span>

                          <PriorityBadge priority={step.request.priority} />
                          <StatusBadge status={step.request.status} />

                          <span className="text-xs text-slate-400 font-mono">
                            #{step.request.id.slice(0, 8)}
                          </span>
                        </div>

                        {/* Title & Description */}
                        <div>
                          <Link
                            to={`/requests/${step.request.id}`}
                            className="text-base font-semibold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors inline-flex items-center gap-1.5 max-w-full"
                          >
                            <span className="truncate">{step.request.title}</span>
                            <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          </Link>
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                            {step.request.description}
                          </p>
                        </div>

                        {/* Metadata chips (Requester, Dept, Amount, Dates in Asia/Kolkata) */}
                        <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500 dark:text-slate-400 pt-0.5">
                          <div className="flex items-center gap-1.5">
                            <UserIcon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            <span>
                              Requester: <strong className="text-slate-700 dark:text-slate-300">{step.request.requester.name}</strong>
                            </span>
                          </div>

                          {step.request.requester.department && (
                            <div className="flex items-center gap-1.5">
                              <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{step.request.requester.department.name}</span>
                            </div>
                          )}

                          {step.request.amount && (
                            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                              <DollarSign className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                ${Number(step.request.amount).toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                })}
                              </span>
                            </div>
                          )}

                          {step.request.dueDate && (
                            <div className="flex items-center gap-1 text-slate-500">
                              <Calendar className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                Due: {formatKolkataDate(step.request.dueDate)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Inline Actions (Approve with Popover, Reject with Modal, View Details) */}
                    <div className="flex items-center gap-2 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800 shrink-0">
                      <Link
                        to={`/requests/${step.request.id}`}
                        className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors shadow-2xs h-8"
                      >
                        View Details
                      </Link>

                      {/* Inline Reject Button (opens RejectModal) */}
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={isRowDisabled || isStepSaving}
                        isLoading={isStepSaving && rejectStepTarget?.id === step.id}
                        className="gap-1.5 text-xs h-8"
                        onClick={() => {
                          setActiveApprovePopoverId(null);
                          setRejectStepTarget(step);
                        }}
                        aria-label={`Reject request: ${step.request.title}`}
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </Button>

                      {/* Inline Approve Button with Popover */}
                      <div className="relative">
                        <Button
                          size="sm"
                          disabled={isRowDisabled || isStepSaving}
                          isLoading={isStepSaving && activeApprovePopoverId === step.id}
                          className="gap-1.5 text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
                          onClick={() => {
                            setActiveApprovePopoverId((prev) =>
                              prev === step.id ? null : step.id
                            );
                          }}
                          aria-label={`Approve request: ${step.request.title}`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </Button>

                        {/* Inline Popover for single approval comment */}
                        <ApprovePopover
                          isOpen={isApprovePopoverOpen}
                          onClose={() => setActiveApprovePopoverId(null)}
                          onConfirm={(comment) => handleConfirmApprove(step.id, comment)}
                          isLoading={isStepSaving}
                          requestTitle={step.request.title}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-4 text-xs">
              <span className="text-slate-500">
                Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> ({totalItems} total requests)
              </span>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1 || isAnySaving}
                  className="h-8 gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || isAnySaving}
                  className="h-8 gap-1"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reject Confirmation Modal with Mandatory Reason */}
      {rejectStepTarget && (
        <RejectModal
          isOpen={Boolean(rejectStepTarget)}
          onClose={() => setRejectStepTarget(null)}
          onConfirm={handleConfirmReject}
          isLoading={submittingStepId === rejectStepTarget.id && rejectMutation.isPending}
          requestTitle={rejectStepTarget.request.title}
          requesterName={rejectStepTarget.request.requester.name}
        />
      )}

      {/* Bulk Approve Confirmation Modal */}
      {isBulkModalOpen && (
        <BulkApproveModal
          isOpen={isBulkModalOpen}
          onClose={() => setIsBulkModalOpen(false)}
          onConfirm={handleConfirmBulkApprove}
          isLoading={bulkApproveMutation.isPending}
          selectedSteps={selectedStepsList}
        />
      )}

      {/* Bulk Results Breakdown Modal (Shows which succeeded and which failed) */}
      {bulkResultResponse && (
        <BulkResultsModal
          isOpen={Boolean(bulkResultResponse)}
          onClose={() => setBulkResultResponse(null)}
          result={bulkResultResponse}
          steps={steps}
        />
      )}
    </div>
  );
};
