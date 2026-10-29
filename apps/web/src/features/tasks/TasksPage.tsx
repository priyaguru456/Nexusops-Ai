import React, { useState } from "react";
import {
  Kanban,
  List,
  Plus,
  Search,
} from "lucide-react";
import { useTasks, useCreateTask, useUpdateTask } from "./hooks";
import { TaskKanbanBoard } from "./TaskKanbanBoard";
import { TaskListView } from "./TaskListView";
import { CreateTaskModal, type CreateTaskFormData } from "./CreateTaskModal";
import { Button } from "../../components/ui/button";
import { KanbanSkeleton } from "../../components/ui/LoadingSkeleton";
import type { TaskQueryFilters, TaskStatus } from "../../types/tasks";

export function TasksPage(): React.JSX.Element {
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [filters, setFilters] = useState<TaskQueryFilters>({
    status: "",
    priority: "",
    search: "",
    page: 1,
    limit: 20,
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  const { data, isLoading } = useTasks(filters);
  const createTaskMutation = useCreateTask();
  const updateTaskMutation = useUpdateTask();

  const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
    updateTaskMutation.mutate({
      id: taskId,
      data: { status: newStatus },
    });
  };

  const handleCreateTask = (formData: CreateTaskFormData) => {
    createTaskMutation.mutate(
      {
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        status: formData.status,
        dueDate: formData.dueDate,
        requestId: formData.requestId,
        assigneeId: formData.assigneeId,
      },
      {
        onSuccess: () => {
          setIsCreateOpen(false);
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Tasks
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Track workflow tasks, status transitions, and team action items
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex items-center p-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/80">
            <button
              type="button"
              onClick={() => setViewMode("kanban")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === "kanban"
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Kanban</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === "list"
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
          </div>

          {/* New Task Button */}
          <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            <span>New Task</span>
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={filters.search || ""}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value, page: 1 }))}
              placeholder="Search tasks..."
              className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Priority */}
          <select
            value={filters.priority || ""}
            onChange={(e) => setFilters((prev) => ({ ...prev, priority: e.target.value as TaskQueryFilters["priority"], page: 1 }))}
            className="text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>

          {/* Status (especially relevant in List view) */}
          <select
            value={filters.status || ""}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value as TaskQueryFilters["status"], page: 1 }))}
            className="text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="TODO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="BLOCKED">Blocked</option>
            <option value="DONE">Done</option>
          </select>
        </div>
      </div>

      {/* Content View: Kanban vs List */}
      {isLoading ? (
        viewMode === "kanban" ? <KanbanSkeleton /> : <div className="p-8 text-center text-slate-400">Loading tasks...</div>
      ) : viewMode === "kanban" ? (
        <TaskKanbanBoard
          tasks={data?.tasks ?? []}
          onStatusChange={handleStatusChange}
        />
      ) : (
        <TaskListView
          tasks={data?.tasks ?? []}
          onStatusChange={handleStatusChange}
          page={data?.page}
          totalPages={data?.totalPages}
          total={data?.total}
          onPageChange={(newPage) => setFilters((prev) => ({ ...prev, page: newPage }))}
        />
      )}

      {/* Create Task Modal */}
      <CreateTaskModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreateTask}
        isLoading={createTaskMutation.isPending}
      />
    </div>
  );
}
