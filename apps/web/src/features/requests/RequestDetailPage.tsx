import React, { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  DollarSign,
  Paperclip,
  Upload,
  Send,
  Ban,
  Edit,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRightCircle,
  FileCheck,
} from "lucide-react";
import {
  useRequest,
  useRequestActivity,
  useSubmitRequest,
  useCancelRequest,
  useTransitionRequestStatus,
  useUploadAttachment,
} from "./hooks";
import { useAuth } from "../auth/AuthContext";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { PriorityBadge } from "../../components/ui/PriorityBadge";
import { Button } from "../../components/ui/button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { DetailSkeleton } from "../../components/ui/LoadingSkeleton";
import { CommentThread } from "../comments/CommentThread";
import { ActivityTimeline } from "./ActivityTimeline";

export function RequestDetailPage(): React.JSX.Element {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: request, isLoading } = useRequest(id);
  const { data: activity, isLoading: isLoadingActivity } = useRequestActivity(id);

  // Mutations
  const submitMutation = useSubmitRequest(id);
  const cancelMutation = useCancelRequest(id);
  const transitionMutation = useTransitionRequestStatus(id);
  const uploadAttachmentMutation = useUploadAttachment(id);

  // Dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    action: () => void;
    variant?: "default" | "destructive";
    confirmLabel?: string;
  }>({
    isOpen: false,
    title: "",
    description: "",
    action: () => {},
  });

  if (isLoading) {
    return <DetailSkeleton />;
  }

  if (!request) {
    return (
      <div className="text-center py-16 space-y-3">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
          Request not found or access denied
        </h2>
        <Button variant="outline" size="sm" onClick={() => navigate("/requests")}>
          Back to Work Requests
        </Button>
      </div>
    );
  }

  const isRequester = user?.id === request.requesterId;
  const isManager = user?.role === "MANAGER";
  const isAdmin = user?.role === "ADMIN";
  const isPrivileged = isManager || isAdmin;

  const canEdit = isRequester && request.status === "DRAFT";
  const canSubmit = (isRequester || isAdmin) && request.status === "DRAFT";
  const canCancel =
    (isRequester || isPrivileged) &&
    !["COMPLETED", "CANCELLED", "REJECTED"].includes(request.status);

  // Handler for uploading new attachments
  const handleAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    uploadAttachmentMutation.mutate(file);
    e.target.value = "";
  };

  const handleOpenConfirm = (
    title: string,
    description: string,
    action: () => void,
    variant: "default" | "destructive" = "default",
    confirmLabel = "Confirm"
  ) => {
    setConfirmDialog({
      isOpen: true,
      title,
      description,
      action,
      variant,
      confirmLabel,
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header / Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <Link
            to="/requests"
            className="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {request.title}
              </h1>
              <StatusBadge status={request.status} />
              <PriorityBadge priority={request.priority} />
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-3">
              <span>ID: #{request.id.slice(0, 8)}</span>
              <span>•</span>
              <span>Category: <strong>{request.category}</strong></span>
              <span>•</span>
              <span>Created {new Date(request.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons depending on role and status */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Edit (Draft only, Requester only) */}
          {canEdit && (
            <Link to={`/requests/${request.id}/edit`}>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Edit className="w-3.5 h-3.5" />
                <span>Edit</span>
              </Button>
            </Link>
          )}

          {/* Submit (Draft only) */}
          {canSubmit && (
            <Button
              size="sm"
              className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() =>
                handleOpenConfirm(
                  "Submit Request for Review",
                  "Are you sure you want to submit this request? It will be locked for review by your department manager.",
                  () => submitMutation.mutate(),
                  "default",
                  "Submit Request"
                )
              }
              isLoading={submitMutation.isPending}
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit Request</span>
            </Button>
          )}

          {/* Manager/Admin Status Transitions */}
          {isPrivileged && request.status === "SUBMITTED" && (
            <Button
              size="sm"
              className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={() =>
                handleOpenConfirm(
                  "Move to Review",
                  "Move this submitted request into formal review stage?",
                  () => transitionMutation.mutate({ status: "IN_REVIEW" }),
                  "default",
                  "Start Review"
                )
              }
              isLoading={transitionMutation.isPending}
            >
              <ArrowRightCircle className="w-3.5 h-3.5" />
              <span>Move to Review</span>
            </Button>
          )}

          {isPrivileged && request.status === "IN_REVIEW" && (
            <>
              <Button
                size="sm"
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() =>
                  handleOpenConfirm(
                    "Approve Request",
                    "Approve this request to allow operational tasks to proceed?",
                    () => transitionMutation.mutate({ status: "APPROVED" }),
                    "default",
                    "Approve"
                  )
                }
                isLoading={transitionMutation.isPending}
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Approve</span>
              </Button>

              <Button
                variant="destructive"
                size="sm"
                className="gap-1.5"
                onClick={() =>
                  handleOpenConfirm(
                    "Reject Request",
                    "Reject this request? This is a terminal state.",
                    () => transitionMutation.mutate({ status: "REJECTED" }),
                    "destructive",
                    "Reject"
                  )
                }
                isLoading={transitionMutation.isPending}
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Reject</span>
              </Button>
            </>
          )}

          {isPrivileged && request.status === "APPROVED" && (
            <Button
              size="sm"
              className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() =>
                handleOpenConfirm(
                  "Begin Work",
                  "Transition this approved request to In Progress?",
                  () => transitionMutation.mutate({ status: "IN_PROGRESS" }),
                  "default",
                  "Start Progress"
                )
              }
              isLoading={transitionMutation.isPending}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Start Progress</span>
            </Button>
          )}

          {isPrivileged && request.status === "IN_PROGRESS" && (
            <Button
              size="sm"
              className="gap-1.5 bg-teal-600 hover:bg-teal-700 text-white"
              onClick={() =>
                handleOpenConfirm(
                  "Complete Request",
                  "Mark all requirements as successfully completed and close this request?",
                  () => transitionMutation.mutate({ status: "COMPLETED" }),
                  "default",
                  "Complete Request"
                )
              }
              isLoading={transitionMutation.isPending}
            >
              <FileCheck className="w-3.5 h-3.5" />
              <span>Complete</span>
            </Button>
          )}

          {/* Cancel */}
          {canCancel && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-rose-200 dark:border-rose-800"
              onClick={() =>
                handleOpenConfirm(
                  "Cancel Request",
                  "Are you sure you want to cancel this request? This action cannot be reversed.",
                  () => cancelMutation.mutate(),
                  "destructive",
                  "Cancel Request"
                )
              }
              isLoading={cancelMutation.isPending}
            >
              <Ban className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Description, Attachments, Comments */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description Card */}
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Description & Specifications
            </h2>
            <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
              {request.description}
            </div>

            {/* Meta chips */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap gap-4 text-xs">
              {request.amount && (
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>
                    Budget:{" "}
                    <strong className="text-slate-900 dark:text-slate-100">
                      ${Number(request.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </strong>
                  </span>
                </div>
              )}

              {request.dueDate && (
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>
                    Due Date:{" "}
                    <strong className="text-slate-900 dark:text-slate-100">
                      {new Date(request.dueDate).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </strong>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Attachments Card */}
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                <Paperclip className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Attachments ({request.attachments?.length ?? 0})</span>
              </div>

              {/* Upload file button for requester / admin */}
              {(isRequester || isAdmin) && (
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload File</span>
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleAttachmentUpload}
                    disabled={uploadAttachmentMutation.isPending}
                  />
                </label>
              )}
            </div>

            {request.attachments && request.attachments.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {request.attachments.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-xs"
                  >
                    <div className="flex items-center gap-2.5 truncate mr-2">
                      <Paperclip className="w-4 h-4 text-indigo-500 shrink-0" />
                      <div className="truncate">
                        <div className="font-medium text-slate-800 dark:text-slate-200 truncate">
                          {file.fileName}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {new Date(file.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-3 text-center">
                No files uploaded with this request.
              </p>
            )}
          </div>

          {/* Comments Discussion Thread */}
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <CommentThread entityType="request" entityId={request.id} />
          </div>
        </div>

        {/* Right Column: Requester details & Timeline */}
        <div className="space-y-6">
          {/* Requester Profile Card */}
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Requester Information
            </h3>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center">
                {request.requester.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                  {request.requester.name}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {request.requester.email}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Department:</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {request.requester.department?.name || "General"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Role:</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {request.requester.role}
                </span>
              </div>
            </div>
          </div>

          {/* Activity Timeline Card */}
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <ActivityTimeline activity={activity} isLoading={isLoadingActivity} />
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        description={confirmDialog.description}
        variant={confirmDialog.variant}
        confirmLabel={confirmDialog.confirmLabel}
        onConfirm={() => {
          confirmDialog.action();
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
