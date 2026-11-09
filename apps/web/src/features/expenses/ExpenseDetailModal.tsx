import React, { useState } from "react";
import {
  X,
  CreditCard,
  Eye,
  Trash2,
  Send,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { formatINR, formatKolkataDateTime, formatKolkataDate } from "../../lib/utils";
import { ApprovalStepper } from "./ApprovalStepper";
import { ReceiptPreviewModal } from "./ReceiptPreviewModal";
import { MarkAsPaidModal } from "./MarkAsPaidModal";
import { useSubmitExpense, useDeleteExpense } from "./hooks";
import type { ExpenseClaim } from "../../types/expenses";
import type { Role } from "../../types/auth";

interface ExpenseDetailModalProps {
  claim: ExpenseClaim | null;
  isOpen: boolean;
  onClose: () => void;
  currentUserRole?: Role;
  currentUserId?: string;
  onRefresh?: () => void;
}

export function ExpenseDetailModal({
  claim,
  isOpen,
  onClose,
  currentUserRole,
  currentUserId,
  onRefresh,
}: ExpenseDetailModalProps): React.JSX.Element | null {
  const [selectedReceipt, setSelectedReceipt] = useState<{
    url: string;
    name: string;
  } | null>(null);

  const [isMarkAsPaidOpen, setIsMarkAsPaidOpen] = useState(false);

  const submitMutation = useSubmitExpense();
  const deleteMutation = useDeleteExpense();

  if (!isOpen || !claim) return null;

  const isOwner = claim.employeeId === currentUserId;
  const isManagerOrAdmin =
    currentUserRole === "MANAGER" || currentUserRole === "ADMIN";

  const isDraft = claim.status === "DRAFT";
  const isApproved = claim.status === "APPROVED";
  const isPaid = claim.status === "PAID";

  const handleSubmitClaim = async () => {
    try {
      await submitMutation.mutateAsync(claim.id);
      onRefresh?.();
      onClose();
    } catch {
      // Toast handled by hook
    }
  };

  const handleDeleteClaim = async () => {
    if (!window.confirm("Are you sure you want to delete this draft expense claim?")) return;
    try {
      await deleteMutation.mutateAsync(claim.id);
      onRefresh?.();
      onClose();
    } catch {
      // Toast handled by hook
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PAID":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
      case "APPROVED":
        return "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      case "SUBMITTED":
        return "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800";
      case "REJECTED":
        return "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800";
      default:
        return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700";
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="expense-detail-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="relative w-full max-w-3xl my-8 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-start justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  id="expense-detail-title"
                  className="text-lg font-bold text-slate-900 dark:text-slate-100"
                >
                  {claim.title}
                </h2>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide uppercase border ${getStatusBadge(
                    claim.status
                  )}`}
                >
                  {claim.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Claim ID: #{claim.id.slice(0, 8)} • Created{" "}
                {formatKolkataDateTime(claim.createdAt)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close dialog"
              className="h-8 w-8 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Body Content */}
          <div className="flex-1 p-6 overflow-y-auto space-y-6">
            {/* Top Metadata Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Total Amount */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/60">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Total Claim Amount
                </span>
                <p className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-400">
                  {formatINR(claim.totalAmount)}
                </p>
              </div>

              {/* Claimant */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/60">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Claimant
                </span>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {claim.employee?.name || "Employee"}
                </p>
                <p className="text-[11px] text-slate-500 truncate">
                  {claim.employee?.email}
                </p>
              </div>

              {/* Submission / Payout Info */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/60">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {isPaid ? "Paid On" : "Submitted On"}
                </span>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {isPaid
                    ? formatKolkataDateTime(claim.paidAt)
                    : claim.submittedAt
                    ? formatKolkataDateTime(claim.submittedAt)
                    : "Not Submitted"}
                </p>
                {claim.paymentReference && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono font-medium truncate">
                    Ref: {claim.paymentReference}
                  </p>
                )}
              </div>
            </div>

            {/* Line Items Table */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center justify-between">
                <span>Expense Items ({claim.items?.length || 0})</span>
                <span className="text-xs text-slate-500 font-normal">
                  All amounts in INR (₹)
                </span>
              </h3>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 font-semibold text-slate-600 dark:text-slate-400">
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3">Incurred Date</th>
                      <th className="py-2.5 px-3">Receipt</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {claim.items?.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-slate-100">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {item.category}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                          {item.description || "—"}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                          {formatKolkataDate(item.date)}
                        </td>
                        <td className="py-2.5 px-3">
                          {item.receiptUrl ? (
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedReceipt({
                                  url: item.receiptUrl!,
                                  name: `${item.category}-Receipt`,
                                })
                              }
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
                            >
                              <Eye className="w-3 h-3" /> View Receipt
                            </button>
                          ) : (
                            <span className="text-slate-400 text-[11px]">No receipt</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100">
                          {formatINR(item.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50/80 dark:bg-slate-800/80 font-bold border-t border-slate-200 dark:border-slate-800">
                      <td colSpan={4} className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">
                        Total Auto-Calculated:
                      </td>
                      <td className="py-2.5 px-3 text-right text-sm text-emerald-600 dark:text-emerald-400">
                        {formatINR(claim.totalAmount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Approval Stepper Section */}
            <div className="space-y-3 pt-2">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Approval Stepper & Decision History
              </h3>
              <ApprovalStepper
                steps={claim.approvalSteps}
                currentStatus={claim.status}
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
            <div>
              {isDraft && isOwner && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteClaim}
                  disabled={deleteMutation.isPending}
                  className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-rose-200 dark:border-rose-900 gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Draft
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>

              {isDraft && isOwner && (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={handleSubmitClaim}
                  disabled={submitMutation.isPending}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  Submit for Approval
                </Button>
              )}

              {isApproved && isManagerOrAdmin && (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={() => setIsMarkAsPaidOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  Mark as Paid
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Receipt Preview Modal */}
      {selectedReceipt && (
        <ReceiptPreviewModal
          isOpen={Boolean(selectedReceipt)}
          receiptUrl={selectedReceipt.url}
          fileName={selectedReceipt.name}
          onClose={() => setSelectedReceipt(null)}
        />
      )}

      {/* Mark As Paid Modal */}
      {isMarkAsPaidOpen && (
        <MarkAsPaidModal
          isOpen={isMarkAsPaidOpen}
          claim={claim}
          onClose={() => setIsMarkAsPaidOpen(false)}
          onSuccess={() => {
            onRefresh?.();
            onClose();
          }}
        />
      )}
    </>
  );
}
