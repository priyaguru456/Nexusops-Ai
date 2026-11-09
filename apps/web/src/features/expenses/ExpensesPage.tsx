import React, { useState } from "react";
import {
  Receipt,
  Plus,
  Search,
  CreditCard,
  Eye,
  Send,
  AlertCircle,
  RefreshCw,
  Building2,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { EmptyState } from "../../components/ui/EmptyState";
import { TableSkeleton } from "../../components/ui/LoadingSkeleton";
import { formatINR, formatKolkataDate } from "../../lib/utils";
import { useAuth } from "../auth/AuthContext";
import { EmployeeSummaryCards } from "./EmployeeSummaryCards";
import { NewExpenseModal } from "./NewExpenseModal";
import { ExpenseDetailModal } from "./ExpenseDetailModal";
import { MarkAsPaidModal } from "./MarkAsPaidModal";
import { useExpenseSummary, useExpensesList, useSubmitExpense } from "./hooks";
import type { ExpenseClaim, ExpenseStatus } from "../../types/expenses";

export function ExpensesPage(): React.JSX.Element {
  const { user } = useAuth();
  const isFinanceOrAdmin = user?.role === "ADMIN" || user?.role === "MANAGER";

  const [activeTab, setActiveTab] = useState<"my" | "finance">("my");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<ExpenseClaim | null>(null);
  const [claimToPay, setClaimToPay] = useState<ExpenseClaim | null>(null);

  const submitMutation = useSubmitExpense();

  // 1. Fetch Summary Cards
  const {
    data: summaryData,
    isLoading: isLoadingSummary,
    refetch: refetchSummary,
  } = useExpenseSummary();

  // 2. Fetch Expenses List
  const {
    data: listData,
    isLoading: isLoadingList,
    isError: isListError,
    error: listError,
    refetch: refetchList,
  } = useExpensesList({
    tab: activeTab,
    status: statusFilter === "ALL" ? undefined : (statusFilter as ExpenseStatus),
    search: searchQuery.trim() || undefined,
    page,
    limit: 10,
  });

  const claims = listData?.claims || listData?.items || [];
  const pagination = listData?.pagination || {
    page: 1,
    limit: 10,
    total: claims.length,
    totalPages: 1,
  };

  const handleRefreshAll = () => {
    refetchSummary();
    refetchList();
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
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Page Title & New Report CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Expenses & Reimbursements
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Submit claims, manage receipt uploads, and track payout approvals
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            aria-label="Refresh expenses data"
            className="text-slate-600 dark:text-slate-400"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => setIsNewModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            New Expense Report
          </Button>
        </div>
      </div>

      {/* Employee Summary Cards */}
      <EmployeeSummaryCards
        summary={summaryData}
        isLoading={isLoadingSummary}
        isFinanceOrAdmin={isFinanceOrAdmin}
      />

      {/* Main Content Area */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        {/* Tabs & Filters Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* View Tabs */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl max-w-fit">
            <button
              type="button"
              onClick={() => {
                setActiveTab("my");
                setPage(1);
              }}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === "my"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              My Expenses
            </button>

            {/* Finance View: only for Manager and Admin */}
            {isFinanceOrAdmin && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab("finance");
                  setPage(1);
                }}
                className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === "finance"
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                Finance Queue
                {summaryData?.finance?.queueCount ? (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 font-bold">
                    {summaryData.finance.queueCount}
                  </span>
                ) : null}
              </button>
            )}
          </div>

          {/* Search & Status Filters */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Search */}
            <div className="relative min-w-[200px] flex-1 sm:flex-initial">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search claims or reference..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                aria-label="Search claims"
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Status dropdown (only for My Expenses tab) */}
            {activeTab === "my" && (
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter by status"
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="PAID">Paid</option>
              </select>
            )}
          </div>
        </div>

        {/* Content Table / Skeletons / Empty State */}
        {isLoadingList ? (
          <div className="p-6">
            <TableSkeleton rows={5} cols={5} />
          </div>
        ) : isListError ? (
          <div className="p-8 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Failed to load expense claims
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {(listError as any)?.response?.data?.message ||
                "A network or server error occurred while retrieving data."}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetchList()}>
              Try Again
            </Button>
          </div>
        ) : claims.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title={
                activeTab === "finance"
                  ? "No Approved Claims in Finance Queue"
                  : statusFilter !== "ALL" || searchQuery
                  ? "No Matching Claims Found"
                  : "No Expense Claims Yet"
              }
              description={
                activeTab === "finance"
                  ? "There are currently no approved claims waiting for finance reimbursement."
                  : statusFilter !== "ALL" || searchQuery
                  ? "Try clearing your search query or filters to see more results."
                  : "Start logging your travel, meals, software, and general expenses for fast reimbursement."
              }
              icon={Receipt}
              actionLabel={activeTab === "my" ? "Create Expense Report" : undefined}
              onAction={activeTab === "my" ? () => setIsNewModalOpen(true) : undefined}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200/80 dark:border-slate-800 font-semibold text-slate-600 dark:text-slate-400">
                  <th className="py-3 px-4">Claim Details</th>
                  {activeTab === "finance" && <th className="py-3 px-4">Claimant</th>}
                  <th className="py-3 px-4">Items & Category</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Total Amount (INR)</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {claims.map((claim) => (
                  <tr
                    key={claim.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Claim Details */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {claim.title}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        #{claim.id.slice(0, 8)}
                        {claim.paymentReference && (
                          <span className="ml-2 text-emerald-600 dark:text-emerald-400 font-medium">
                            • Ref: {claim.paymentReference}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Claimant (in Finance Queue tab) */}
                    {activeTab === "finance" && (
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          {claim.employee?.name || "Employee"}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[150px]">
                          {claim.employee?.email}
                        </div>
                      </td>
                    )}

                    {/* Items & Categories */}
                    <td className="py-3 px-4">
                      <div className="text-slate-700 dark:text-slate-300 font-medium">
                        {claim.items?.length || 0}{" "}
                        {claim.items?.length === 1 ? "item" : "items"}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                        {claim.items?.slice(0, 2).map((it, idx) => (
                          <span
                            key={idx}
                            className="inline-block px-1.5 py-0.2 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                          >
                            {it.category}
                          </span>
                        ))}
                        {(claim.items?.length || 0) > 2 && (
                          <span className="text-[10px] text-slate-400">
                            +{(claim.items?.length || 0) - 2} more
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Date */}
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      <div>
                        {claim.submittedAt
                          ? formatKolkataDate(claim.submittedAt)
                          : formatKolkataDate(claim.createdAt)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {claim.submittedAt ? "Submitted" : "Created"}
                      </div>
                    </td>

                    {/* Total Amount in INR */}
                    <td className="py-3 px-4">
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {formatINR(claim.totalAmount)}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase border ${getStatusBadge(
                          claim.status
                        )}`}
                      >
                        {claim.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Quick Submit for Draft */}
                        {claim.status === "DRAFT" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              await submitMutation.mutateAsync(claim.id);
                              handleRefreshAll();
                            }}
                            disabled={submitMutation.isPending}
                            className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 h-7 px-2 gap-1"
                          >
                            <Send className="w-3 h-3" />
                            Submit
                          </Button>
                        )}

                        {/* Quick Mark As Paid for Approved Claims in Finance Tab */}
                        {activeTab === "finance" && claim.status === "APPROVED" && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => setClaimToPay(claim)}
                            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white h-7 px-2.5 gap-1"
                          >
                            <CreditCard className="w-3 h-3" />
                            Mark as Paid
                          </Button>
                        )}

                        {/* View Details Modal */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedClaim(claim)}
                          className="text-xs h-7 px-2 gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          View
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800 text-xs">
                <span className="text-slate-500">
                  Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} claims)
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="h-7 px-2 text-xs"
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="h-7 px-2 text-xs"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* New Expense Modal */}
      {isNewModalOpen && (
        <NewExpenseModal
          isOpen={isNewModalOpen}
          onClose={() => setIsNewModalOpen(false)}
          onSuccess={handleRefreshAll}
        />
      )}

      {/* Detail Modal */}
      {selectedClaim && (
        <ExpenseDetailModal
          isOpen={Boolean(selectedClaim)}
          claim={selectedClaim}
          currentUserRole={user?.role}
          currentUserId={user?.id}
          onClose={() => setSelectedClaim(null)}
          onRefresh={handleRefreshAll}
        />
      )}

      {/* Mark As Paid Modal */}
      {claimToPay && (
        <MarkAsPaidModal
          isOpen={Boolean(claimToPay)}
          claim={claimToPay}
          onClose={() => setClaimToPay(null)}
          onSuccess={handleRefreshAll}
        />
      )}
    </div>
  );
}
