import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle,
  XCircle,
  ExternalLink,
  ClipboardCheck,
  Search,
  DollarSign,
  Calendar,
  User,
  Building,
  Filter,
} from "lucide-react";
import { usePendingApprovals, useApproveStep, useRejectStep } from "./hooks";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { PriorityBadge } from "../../components/ui/PriorityBadge";
import { Button } from "../../components/ui/button";
import { EmptyState } from "../../components/ui/EmptyState";
import { LoadingSkeleton } from "../../components/ui/LoadingSkeleton";
import type { PendingApprovalStep } from "../../types/approvals";

export const ApprovalsInboxPage: React.FC = () => {
  const { data, isLoading, error } = usePendingApprovals();
  const approveMutation = useApproveStep();
  const rejectMutation = useRejectStep();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStep, setSelectedStep] = useState<PendingApprovalStep | null>(null);
  const [decisionType, setDecisionType] = useState<"approve" | "reject" | null>(null);
  const [comment, setComment] = useState("");
  const [commentError, setCommentError] = useState("");

  const steps = data?.steps || [];

  const filteredSteps = steps.filter((step) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      step.request.title.toLowerCase().includes(term) ||
      step.request.category.toLowerCase().includes(term) ||
      step.request.requester.name.toLowerCase().includes(term) ||
      (step.request.requester.department?.name &&
        step.request.requester.department.name.toLowerCase().includes(term))
    );
  });

  const handleOpenDecision = (step: PendingApprovalStep, type: "approve" | "reject") => {
    setSelectedStep(step);
    setDecisionType(type);
    setComment("");
    setCommentError("");
  };

  const handleCloseDialog = () => {
    setSelectedStep(null);
    setDecisionType(null);
    setComment("");
    setCommentError("");
  };

  const handleSubmitDecision = async () => {
    if (!selectedStep || !decisionType) return;

    if (decisionType === "reject" && !comment.trim()) {
      setCommentError("A reason or comment is required when rejecting a request.");
      return;
    }

    if (decisionType === "approve") {
      await approveMutation.mutateAsync({
        stepId: selectedStep.id,
        payload: { comment: comment.trim() || undefined },
      });
    } else {
      await rejectMutation.mutateAsync({
        stepId: selectedStep.id,
        payload: { comment: comment.trim() },
      });
    }

    handleCloseDialog();
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Approvals Inbox
            </h1>
            <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
              {steps.length} Pending
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Review and make decisions on workflow requests waiting for your authorization
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by title, requester, department..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Filter className="w-3.5 h-3.5" />
          <span>Showing {filteredSteps.length} of {steps.length} pending items</span>
        </div>
      </div>

      {/* Loading & Error States */}
      {isLoading && (
        <div className="space-y-4">
          <LoadingSkeleton className="h-32 w-full" />
          <LoadingSkeleton className="h-32 w-full" />
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
          Failed to load pending approvals: {(error as Error).message}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredSteps.length === 0 && (
        <EmptyState
          icon={ClipboardCheck}
          title={searchTerm ? "No matching approvals found" : "All Caught Up!"}
          description={
            searchTerm
              ? "Try adjusting your search keywords."
              : "There are no pending requests waiting for your approval right now."
          }
        />
      )}

      {/* Approvals List */}
      {!isLoading && !error && filteredSteps.length > 0 && (
        <div className="space-y-4">
          {filteredSteps.map((step) => {
            const totalSteps = step.request.approvalSteps?.length || 1;
            return (
              <div
                key={step.id}
                className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left Section: Request Info */}
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        Step {step.stepOrder} of {totalSteps} ({step.approverRole})
                      </span>
                      <StatusBadge status={step.request.status} />
                      <PriorityBadge priority={step.request.priority} />
                      <span className="text-xs text-slate-400 font-mono">
                        #{step.request.id.slice(0, 8)}
                      </span>
                    </div>

                    <div>
                      <Link
                        to={`/requests/${step.request.id}`}
                        className="text-base font-semibold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1.5"
                      >
                        <span>{step.request.title}</span>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                      </Link>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                        {step.request.description}
                      </p>
                    </div>

                    {/* Metadata chips */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-1">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-indigo-500" />
                        <span>
                          Requester: <strong>{step.request.requester.name}</strong>
                        </span>
                      </div>

                      {step.request.requester.department && (
                        <div className="flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-slate-400" />
                          <span>{step.request.requester.department.name}</span>
                        </div>
                      )}

                      {step.request.amount && (
                        <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>
                            ${Number(step.request.amount).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                      )}

                      {step.request.dueDate && (
                        <div className="flex items-center gap-1 text-slate-500">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>
                            Due {new Date(step.request.dueDate).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Section: Action Buttons */}
                  <div className="flex items-center gap-2.5 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
                    <Link
                      to={`/requests/${step.request.id}`}
                      className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors shadow-xs"
                    >
                      View Details
                    </Link>

                    <Button
                      variant="destructive"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => handleOpenDecision(step, "reject")}
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Reject</span>
                    </Button>

                    <Button
                      size="sm"
                      className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => handleOpenDecision(step, "approve")}
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Approve</span>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Decision Dialog (Approve / Reject Modal) */}
      {selectedStep && decisionType && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    decisionType === "approve"
                      ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-600"
                      : "bg-rose-100 dark:bg-rose-950 text-rose-600"
                  }`}
                >
                  {decisionType === "approve" ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <XCircle className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {decisionType === "approve"
                      ? "Approve Request Step"
                      : "Reject Request Step"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {decisionType === "approve"
                      ? "Record your approval to advance the workflow."
                      : "Rejection terminates this workflow and notifies the requester."}
                  </p>
                </div>
              </div>

              {/* Request Summary Box */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                <div className="font-semibold text-slate-800 dark:text-slate-200">
                  {selectedStep.request.title}
                </div>
                <div className="text-slate-500">
                  Requester: {selectedStep.request.requester.name} • Category:{" "}
                  {selectedStep.request.category}
                </div>
              </div>

              {/* Comment Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>
                    Comments / Decision Notes{" "}
                    {decisionType === "reject" ? (
                      <span className="text-rose-500 font-bold">* (Required)</span>
                    ) : (
                      <span className="text-slate-400 font-normal">(Optional)</span>
                    )}
                  </span>
                </label>
                <textarea
                  rows={3}
                  value={comment}
                  onChange={(e) => {
                    setComment(e.target.value);
                    if (commentError) setCommentError("");
                  }}
                  placeholder={
                    decisionType === "reject"
                      ? "Explain why this request is being rejected..."
                      : "Add any approval notes or instructions..."
                  }
                  className={`w-full p-3 rounded-xl border text-xs focus:outline-none focus:ring-2 bg-transparent ${
                    commentError
                      ? "border-rose-500 focus:ring-rose-500"
                      : "border-slate-300 dark:border-slate-700 focus:ring-indigo-500"
                  }`}
                />
                {commentError && (
                  <p className="text-[11px] text-rose-500">{commentError}</p>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCloseDialog}
                disabled={approveMutation.isPending || rejectMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSubmitDecision}
                isLoading={
                  decisionType === "approve"
                    ? approveMutation.isPending
                    : rejectMutation.isPending
                }
                className={
                  decisionType === "approve"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "bg-rose-600 hover:bg-rose-700 text-white"
                }
              >
                {decisionType === "approve" ? "Confirm Approval" : "Confirm Rejection"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
