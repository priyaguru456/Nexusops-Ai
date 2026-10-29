import React from "react";
import { DataTable, type Column } from "../../components/ui/DataTable";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { PriorityBadge } from "../../components/ui/PriorityBadge";
import type { TaskItem, TaskStatus } from "../../types/tasks";

interface TaskListViewProps {
  tasks: TaskItem[];
  isLoading?: boolean;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  page?: number;
  totalPages?: number;
  total?: number;
  onPageChange?: (newPage: number) => void;
  onSort?: (col: string) => void;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export function TaskListView({
  tasks,
  isLoading = false,
  onStatusChange,
  page,
  totalPages,
  total,
  onPageChange,
  onSort,
  sortBy,
  sortOrder,
}: TaskListViewProps): React.JSX.Element {
  const columns: Column<TaskItem>[] = [
    {
      key: "title",
      header: "Task",
      sortable: true,
      render: (task) => (
        <div className="max-w-xs sm:max-w-md">
          <div className="font-semibold text-slate-900 dark:text-slate-100 line-clamp-1">
            {task.title}
          </div>
          {task.description && (
            <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
              {task.description}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (task) => (
        <div className="flex items-center gap-2">
          <StatusBadge status={task.status} size="sm" />
          <select
            value={task.status}
            onChange={(e) => onStatusChange(task.id, e.target.value as TaskStatus)}
            className="text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-1.5 py-0.5 text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="TODO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="BLOCKED">Blocked</option>
            <option value="DONE">Done</option>
          </select>
        </div>
      ),
    },
    {
      key: "priority",
      header: "Priority",
      sortable: true,
      render: (task) => <PriorityBadge priority={task.priority} />,
    },
    {
      key: "assignee",
      header: "Assignee",
      render: (task) => (
        <div className="text-xs">
          {task.assignee ? (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold flex items-center justify-center">
                {task.assignee.name.charAt(0).toUpperCase()}
              </div>
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {task.assignee.name}
              </span>
            </div>
          ) : (
            <span className="text-slate-400 italic">Unassigned</span>
          )}
        </div>
      ),
    },
    {
      key: "dueDate",
      header: "Due Date",
      sortable: true,
      render: (task) => (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {task.dueDate
            ? new Date(task.dueDate).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })
            : "—"}
        </span>
      ),
    },
    {
      key: "request",
      header: "Request",
      render: (task) => (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {task.request ? `#${task.request.id.slice(0, 8)}` : "—"}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={tasks}
      keyExtractor={(t) => t.id}
      isLoading={isLoading}
      emptyTitle="No tasks found"
      emptyDescription="No tasks match your current criteria."
      sortBy={sortBy}
      sortOrder={sortOrder}
      onSort={onSort}
      page={page}
      totalPages={totalPages}
      total={total}
      onPageChange={onPageChange}
    />
  );
}
