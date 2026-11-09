import React, { useState, useEffect, useRef } from "react";
import { X, CheckCircle2, CreditCard, Loader2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { formatINR } from "../../lib/utils";
import { useMarkAsPaid } from "./hooks";
import type { ExpenseClaim } from "../../types/expenses";

interface MarkAsPaidModalProps {
  claim: ExpenseClaim | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function MarkAsPaidModal({
  claim,
  isOpen,
  onClose,
  onSuccess,
}: MarkAsPaidModalProps): React.JSX.Element | null {
  const [paymentReference, setPaymentReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const markAsPaidMutation = useMarkAsPaid();

  useEffect(() => {
    if (isOpen) {
      setPaymentReference("");
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !markAsPaidMutation.isPending) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, markAsPaidMutation.isPending]);

  if (!isOpen || !claim) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = paymentReference.trim();
    if (!trimmed) {
      setError("Payment reference number (UTR / NEFT / Txn ID) is required");
      return;
    }
    if (trimmed.length < 2) {
      setError("Payment reference must be at least 2 characters");
      return;
    }

    try {
      await markAsPaidMutation.mutateAsync({
        id: claim.id,
        paymentReference: trimmed,
      });
      onSuccess?.();
      onClose();
    } catch {
      // Handled by mutation onError toast
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mark-paid-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !markAsPaidMutation.isPending) {
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100 dark:border-emerald-900/30">
              <CreditCard className="w-4 h-4" />
            </div>
            <h2
              id="mark-paid-modal-title"
              className="text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              Record Reimbursement Payout
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={markAsPaidMutation.isPending}
            aria-label="Close modal"
            className="h-8 w-8 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-700/60 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Claim:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[200px]">
                {claim.title}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Claimant:</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {claim.employee?.name || "Employee"}
              </span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700">
              <span className="font-medium text-slate-600 dark:text-slate-300">Total Reimbursement:</span>
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                {formatINR(claim.totalAmount)}
              </span>
            </div>
          </div>

          <div>
            <label
              htmlFor="payment-reference"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Payment Reference (UTR / Bank Reference) *
            </label>
            <input
              id="payment-reference"
              ref={inputRef}
              type="text"
              value={paymentReference}
              onChange={(e) => {
                setPaymentReference(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. UTR-2026-88771122 or NEFT-098877"
              disabled={markAsPaidMutation.isPending}
              className={`w-full px-3 py-2 text-sm rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-all ${
                error
                  ? "border-rose-400 focus:ring-rose-500"
                  : "border-slate-300 dark:border-slate-700"
              }`}
            />
            {error && (
              <p className="mt-1 text-xs text-rose-500 font-medium" role="alert">
                {error}
              </p>
            )}
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              This reference will be saved on the claim and emailed/notified to the employee.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={markAsPaidMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="default"
              size="sm"
              disabled={markAsPaidMutation.isPending || !paymentReference.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              {markAsPaidMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Confirm Payout
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
