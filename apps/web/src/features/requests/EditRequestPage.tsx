import React from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { RequestForm, type RequestFormSubmitData } from "./RequestForm";
import { useRequest, useUpdateRequest } from "./hooks";
import { DetailSkeleton } from "../../components/ui/LoadingSkeleton";
import { useAuth } from "../auth/AuthContext";

export function EditRequestPage(): React.JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: request, isLoading } = useRequest(id || "");
  const updateMutation = useUpdateRequest(id || "");

  if (isLoading) {
    return <DetailSkeleton />;
  }

  if (!request) {
    return (
      <div className="text-center py-12">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
          Request not found
        </h2>
        <Link to="/requests" className="text-sm text-indigo-600 hover:underline mt-2 inline-block">
          Back to Work Requests
        </Link>
      </div>
    );
  }

  // Only requester while Draft
  const isOwner = user?.id === request.requesterId;
  const isDraft = request.status === "DRAFT";

  if (!isOwner || !isDraft) {
    return (
      <div className="max-w-md mx-auto text-center py-16 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-3">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
          Editing Not Allowed
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Requests can only be edited by their original author while in DRAFT status.
        </p>
        <Link to={`/requests/${request.id}`} className="inline-block mt-2">
          <span className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
            View Request Details
          </span>
        </Link>
      </div>
    );
  }

  const handleUpdate = (data: RequestFormSubmitData) => {
    updateMutation.mutate(
      {
        title: data.title,
        description: data.description,
        category: data.category,
        priority: data.priority,
        amount: data.amount,
        dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : null,
      },
      {
        onSuccess: () => {
          navigate(`/requests/${request.id}`);
        },
      }
    );
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to={`/requests/${request.id}`}
          className="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Edit Request
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Modifying draft #{request.id.slice(0, 8)}
          </p>
        </div>
      </div>

      <RequestForm
        initialData={request}
        onSubmit={handleUpdate}
        isLoading={updateMutation.isPending}
        submitLabel="Save Changes"
        onCancel={() => navigate(`/requests/${request.id}`)}
      />
    </div>
  );
}
