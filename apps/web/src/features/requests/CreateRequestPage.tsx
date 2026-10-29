import React from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { RequestForm, type RequestFormSubmitData } from "./RequestForm";
import { useCreateRequest } from "./hooks";

export function CreateRequestPage(): React.JSX.Element {
  const navigate = useNavigate();
  const createMutation = useCreateRequest();

  const handleCreate = (data: RequestFormSubmitData, files: File[]) => {
    const formData = new FormData();
    formData.append("title", data.title);
    formData.append("description", data.description);
    formData.append("category", data.category);
    formData.append("priority", data.priority);
    if (data.amount !== null && data.amount !== undefined) {
      formData.append("amount", String(data.amount));
    }
    if (data.dueDate) {
      formData.append("dueDate", new Date(data.dueDate).toISOString());
    }

    files.forEach((file) => {
      formData.append("attachments", file);
    });

    createMutation.mutate(formData, {
      onSuccess: (created) => {
        navigate(`/requests/${created.id}`);
      },
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/requests"
          className="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Create Work Request
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Submit a new operational, IT, or facilities ticket (saved initially as Draft)
          </p>
        </div>
      </div>

      <RequestForm
        onSubmit={handleCreate}
        isLoading={createMutation.isPending}
        submitLabel="Create Draft Request"
        onCancel={() => navigate("/requests")}
      />
    </div>
  );
}
