import React, { useState, useEffect } from "react";
import {
  Mail,
  Calendar,
  Clock,
  Send,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus,
  X,
  History,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { Dialog } from "../../../components/ui/Dialog";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Badge } from "../../../components/ui/badge";
import {
  useDigestSchedule,
  useDigestDeliveries,
  useSaveDigestSchedule,
  useSendTestDigest,
} from "../api";
import { formatKolkataDateTime } from "../../../lib/date";

interface DigestScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DAYS_OF_WEEK = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
];

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${String(i).padStart(2, "0")}:00 ${i < 12 ? "AM" : "PM"}`,
}));

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const DigestScheduleModal: React.FC<DigestScheduleModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<"settings" | "history">("settings");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [newRecipientInput, setNewRecipientInput] = useState("");
  const [recipientError, setRecipientError] = useState<string | null>(null);

  const [dayOfWeek, setDayOfWeek] = useState<number>(1); // Monday
  const [hour, setHour] = useState<number>(9);           // 9 AM
  const [timezone] = useState<string>("Asia/Kolkata");
  const [isActive, setIsActive] = useState<boolean>(true);

  const [page, setPage] = useState<number>(1);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);

  // Queries & Mutations
  const {
    data: schedule,
    isLoading: isScheduleLoading,
    refetch: refetchSchedule,
  } = useDigestSchedule(isOpen);

  const {
    data: deliveriesData,
    isLoading: isDeliveriesLoading,
    refetch: refetchDeliveries,
  } = useDigestDeliveries(page, 5, isOpen);

  const saveMutation = useSaveDigestSchedule();
  const sendTestMutation = useSendTestDigest();

  // Populate state when schedule loads
  useEffect(() => {
    if (schedule) {
      setRecipients(schedule.recipients || []);
      setDayOfWeek(schedule.dayOfWeek ?? 1);
      setHour(schedule.hour ?? 9);
      setIsActive(schedule.isActive ?? true);
    }
  }, [schedule]);

  // Clear messages on modal open/close
  useEffect(() => {
    if (isOpen) {
      setActionSuccessMsg(null);
      setActionErrorMsg(null);
      setRecipientError(null);
    }
  }, [isOpen]);

  const handleAddRecipient = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const email = newRecipientInput.trim().toLowerCase();
    if (!email) return;

    if (!EMAIL_REGEX.test(email)) {
      setRecipientError("Please enter a valid email address.");
      return;
    }

    if (recipients.includes(email)) {
      setRecipientError("This email address is already added.");
      return;
    }

    setRecipients((prev) => [...prev, email]);
    setNewRecipientInput("");
    setRecipientError(null);
  };

  const handleRemoveRecipient = (emailToRemove: string) => {
    setRecipients((prev) => prev.filter((r) => r !== emailToRemove));
  };

  const handleSaveSchedule = async () => {
    if (recipients.length === 0) {
      setRecipientError("At least one recipient email address is required.");
      return;
    }

    setActionSuccessMsg(null);
    setActionErrorMsg(null);

    try {
      await saveMutation.mutateAsync({
        recipients,
        dayOfWeek,
        hour,
        timezone,
        isActive,
      });
      setActionSuccessMsg("Weekly digest schedule updated successfully.");
      refetchSchedule();
    } catch (err: any) {
      setActionErrorMsg(err?.response?.data?.message || err?.message || "Failed to save schedule.");
    }
  };

  const handleSendTest = async () => {
    if (recipients.length === 0) {
      setRecipientError("Add at least one recipient email address to send a test digest.");
      return;
    }

    setActionSuccessMsg(null);
    setActionErrorMsg(null);

    try {
      await sendTestMutation.mutateAsync(recipients);
      setActionSuccessMsg("Test digest email dispatched successfully! Check recipient inboxes.");
      refetchDeliveries();
    } catch (err: any) {
      setActionErrorMsg(
        err?.response?.data?.message || err?.message || "Failed to send test digest email."
      );
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Weekly Analytics Email Digest"
      description="Configure automated weekly KPI summaries delivered to enterprise stakeholders."
      maxWidth="xl"
    >
      <div className="space-y-5">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "settings"}
            onClick={() => setActiveTab("settings")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-t ${
              activeTab === "settings"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <Settings className="w-4 h-4" />
            Schedule Settings
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "history"}
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-t ${
              activeTab === "history"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <History className="w-4 h-4" />
            Delivery History
            {deliveriesData && deliveriesData.total > 0 && (
              <Badge variant="outline" className="text-[10px] ml-1 px-1.5 py-0">
                {deliveriesData.total}
              </Badge>
            )}
          </button>
        </div>

        {/* Status Alerts */}
        {actionSuccessMsg && (
          <div
            role="alert"
            className="flex items-center gap-2 p-3 text-xs sm:text-sm rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
        )}

        {actionErrorMsg && (
          <div
            role="alert"
            className="flex items-center gap-2 p-3 text-xs sm:text-sm rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800"
          >
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
            <span>{actionErrorMsg}</span>
          </div>
        )}

        {/* Tab 1: Schedule Settings */}
        {activeTab === "settings" && (
          <div className="space-y-5">
            {isScheduleLoading ? (
              <div className="space-y-4 py-4 animate-pulse">
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/4"></div>
                <div className="h-10 bg-slate-100 dark:bg-slate-800/60 rounded"></div>
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3"></div>
                <div className="h-10 bg-slate-100 dark:bg-slate-800/60 rounded"></div>
              </div>
            ) : (
              <>
                {/* Enable/Disable Toggle */}
                <div className="flex items-center justify-between p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50">
                  <div className="space-y-0.5">
                    <Label htmlFor="toggle-active" className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Digest Schedule Status
                    </Label>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {isActive
                        ? "Active: Automatic weekly dispatch will trigger at the designated time."
                        : "Paused: Automated dispatch is disabled."}
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      id="toggle-active"
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="sr-only peer"
                      aria-label="Enable weekly analytics digest schedule"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {/* Day of Week & Hour Selectors */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="day-of-week-select" className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                      Day of the Week
                    </Label>
                    <select
                      id="day-of-week-select"
                      value={dayOfWeek}
                      onChange={(e) => setDayOfWeek(parseInt(e.target.value, 10))}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {DAYS_OF_WEEK.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="hour-select" className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-500" />
                      Delivery Time ({timezone})
                    </Label>
                    <select
                      id="hour-select"
                      value={hour}
                      onChange={(e) => setHour(parseInt(e.target.value, 10))}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {HOURS.map((h) => (
                        <option key={h.value} value={h.value}>
                          {h.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Recipient Emails */}
                <div className="space-y-2">
                  <Label htmlFor="new-recipient-input" className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-indigo-500" />
                      Recipients ({recipients.length})
                    </span>
                    <span className="text-[11px] text-slate-400 font-normal">
                      Must be valid company or stakeholder emails
                    </span>
                  </Label>

                  {/* Add Recipient Input */}
                  <div className="flex gap-2">
                    <Input
                      id="new-recipient-input"
                      type="email"
                      placeholder="e.g. director@nexusops.com"
                      value={newRecipientInput}
                      onChange={(e) => {
                        setNewRecipientInput(e.target.value);
                        setRecipientError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddRecipient();
                        }
                      }}
                      className="text-sm"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleAddRecipient()}
                      className="flex-shrink-0"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add
                    </Button>
                  </div>

                  {recipientError && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1 mt-1">
                      <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                      {recipientError}
                    </p>
                  )}

                  {/* Chips List of Current Recipients */}
                  <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 min-h-[44px]">
                    {recipients.length === 0 ? (
                      <span className="text-xs text-slate-400 italic self-center">
                        No recipients added yet. Add at least one email address.
                      </span>
                    ) : (
                      recipients.map((email) => (
                        <span
                          key={email}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60"
                        >
                          {email}
                          <button
                            type="button"
                            onClick={() => handleRemoveRecipient(email)}
                            aria-label={`Remove ${email}`}
                            className="p-0.5 rounded-full hover:bg-indigo-200/50 dark:hover:bg-indigo-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Last Run Info */}
                {schedule?.lastRunAt && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Last automatic execution: <strong className="text-slate-700 dark:text-slate-300">{formatKolkataDateTime(schedule.lastRunAt)}</strong>
                  </p>
                )}

                {/* Footer Action Buttons */}
                <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSendTest}
                    disabled={sendTestMutation.isPending || recipients.length === 0}
                    className="w-full sm:w-auto"
                  >
                    {sendTestMutation.isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Sending Test...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2 text-indigo-500" />
                        Send test email now
                      </>
                    )}
                  </Button>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <Button type="button" variant="ghost" onClick={onClose}>
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={handleSaveSchedule}
                      disabled={saveMutation.isPending || recipients.length === 0}
                    >
                      {saveMutation.isPending ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Schedule"
                      )}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab 2: Delivery History Table */}
        {activeTab === "history" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Log of automated and manual test digest dispatches.
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => refetchDeliveries()}
                className="text-xs h-7 gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Refresh
              </Button>
            </div>

            {isDeliveriesLoading ? (
              <div className="space-y-2 py-4 animate-pulse">
                <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded"></div>
                <div className="h-10 bg-slate-100 dark:bg-slate-800/60 rounded"></div>
                <div className="h-10 bg-slate-100 dark:bg-slate-800/60 rounded"></div>
              </div>
            ) : deliveriesData && deliveriesData.deliveries.length > 0 ? (
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                    <thead className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">
                      <tr>
                        <th className="px-3.5 py-2.5">Sent At (IST)</th>
                        <th className="px-3.5 py-2.5">Status</th>
                        <th className="px-3.5 py-2.5">Recipients</th>
                        <th className="px-3.5 py-2.5">Error / Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {deliveriesData.deliveries.map((delivery) => (
                        <tr
                          key={delivery.id}
                          className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="px-3.5 py-2.5 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                            {formatKolkataDateTime(delivery.sentAt)}
                          </td>
                          <td className="px-3.5 py-2.5">
                            {delivery.status === "SUCCESS" ? (
                              <Badge variant="outline" className="text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 gap-1 text-[10px]">
                                <CheckCircle2 className="w-3 h-3" />
                                Success
                              </Badge>
                            ) : delivery.status === "FAILED" ? (
                              <Badge variant="outline" className="text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 gap-1 text-[10px]">
                                <AlertTriangle className="w-3 h-3" />
                                Failed
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 gap-1 text-[10px]">
                                <Clock className="w-3 h-3" />
                                Pending
                              </Badge>
                            )}
                          </td>
                          <td className="px-3.5 py-2.5 whitespace-nowrap">
                            {delivery.recipientCount} {delivery.recipientCount === 1 ? "recipient" : "recipients"}
                          </td>
                          <td className="px-3.5 py-2.5 text-slate-500 dark:text-slate-400 max-w-xs truncate" title={delivery.error || "Delivered successfully"}>
                            {delivery.error ? (
                              <span className="text-rose-600 dark:text-rose-400 font-mono text-[11px]">{delivery.error}</span>
                            ) : (
                              <span className="text-slate-400 italic">Dispatched without error</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {deliveriesData.totalPages > 1 && (
                  <div className="flex items-center justify-between px-3.5 py-2 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                    <span>
                      Page {deliveriesData.page} of {deliveriesData.totalPages} ({deliveriesData.total} records)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className="h-7 px-2 text-xs"
                      >
                        Previous
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={page >= deliveriesData.totalPages}
                        onClick={() => setPage((p) => p + 1)}
                        className="h-7 px-2 text-xs"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 text-center border border-dashed border-slate-300 dark:border-slate-800 rounded-lg">
                <ShieldCheck className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  No delivery logs recorded yet
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                  Deliveries will appear here after automated weekly runs or when sending a test email.
                </p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
};
