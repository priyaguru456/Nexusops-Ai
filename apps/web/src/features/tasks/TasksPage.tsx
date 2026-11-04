import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Kanban,
  List,
  Plus,
  Search,
  UserCheck,
  X,
  Calendar,
  AlertCircle,
  Clock,
  RotateCcw,
} from "lucide-react";
import { useTasks, useCreateTask, useUpdateTask } from "./hooks";
import { TaskKanbanBoard } from "./TaskKanbanBoard";
import { TaskListView } from "./TaskListView";
import { CreateTaskModal, type CreateTaskFormData } from "./CreateTaskModal";
import { Button } from "../../components/ui/button";
import { BackButton } from "../../components/ui/BackButton";
import { KanbanSkeleton } from "../../components/ui/LoadingSkeleton";
import { useAuth } from "../auth/AuthContext";
import { matchesDueDateFilter, type DueDateQuickFilter } from "./taskUtils";
import type { TaskQueryFilters, TaskStatus } from "../../types/tasks";
import type { Priority } from "../../types/requests";

const MY_TASKS_STORAGE_KEY = "nexusops_tasks_my_tasks";

export function TasksPage(): React.JSX.Element {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Open modal if navigated with ?create=true
  useEffect(() => {
    if (searchParams.get("create") === "true") {
      setIsCreateOpen(true);
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("create");
      setSearchParams(nextParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // 1. "My Tasks" toggle state with localStorage persistence
  const [myTasksOnly, setMyTasksOnly] = useState<boolean>(() => {
    try {
      return localStorage.getItem(MY_TASKS_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPriority, setSelectedPriority] = useState<Priority | "">("");
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus | "">("");
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>("");
  const [dueFilter, setDueFilter] = useState<DueDateQuickFilter>("");
  const [page, setPage] = useState(1);

  // Sync My Tasks choice to localStorage
  const handleToggleMyTasks = () => {
    setMyTasksOnly((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(MY_TASKS_STORAGE_KEY, String(next));
      } catch {
        // Safe fallback for restricted localStorage environments
      }
      return next;
    });
    setPage(1);
  };

  // Build API Query Filters
  const apiFilters = useMemo<TaskQueryFilters>(() => {
    const filters: TaskQueryFilters = {
      page,
      limit: viewMode === "kanban" ? 100 : 20,
      sortBy: "createdAt",
      sortOrder: "desc",
    };

    if (searchQuery.trim()) {
      filters.search = searchQuery.trim();
    }
    if (selectedPriority) {
      filters.priority = selectedPriority;
    }
    if (selectedStatus) {
      filters.status = selectedStatus;
    }

    // Assignee filtering: "My Tasks" takes priority, then explicit assignee selection
    if (myTasksOnly && user?.id) {
      filters.assigneeId = user.id;
    } else if (selectedAssigneeId && selectedAssigneeId !== "UNASSIGNED") {
      filters.assigneeId = selectedAssigneeId;
    }

    return filters;
  }, [
    page,
    viewMode,
    searchQuery,
    selectedPriority,
    selectedStatus,
    myTasksOnly,
    user?.id,
    selectedAssigneeId,
  ]);

  const { data, isLoading } = useTasks(apiFilters);
  const createTaskMutation = useCreateTask();
  const updateTaskMutation = useUpdateTask();

  // Extract unique assignees from tasks + current user for quick filter dropdown
  const uniqueAssignees = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    if (user?.id && user?.name) {
      map.set(user.id, { id: user.id, name: `${user.name} (You)` });
    }
    data?.tasks?.forEach((t) => {
      if (t.assignee) {
        if (!map.has(t.assignee.id)) {
          map.set(t.assignee.id, { id: t.assignee.id, name: t.assignee.name });
        }
      }
    });
    return Array.from(map.values());
  }, [data?.tasks, user]);

  // Combine filters on loaded tasks (handles client-side due-date logic in Asia/Kolkata and unassigned)
  const displayedTasks = useMemo(() => {
    let tasks = data?.tasks ?? [];

    // Filter by My Tasks if enabled
    if (myTasksOnly && user?.id) {
      tasks = tasks.filter((t) => t.assigneeId === user.id);
    } else if (selectedAssigneeId === "UNASSIGNED") {
      tasks = tasks.filter((t) => !t.assigneeId);
    } else if (selectedAssigneeId && selectedAssigneeId !== "") {
      tasks = tasks.filter((t) => t.assigneeId === selectedAssigneeId);
    }

    // Filter by Priority
    if (selectedPriority) {
      tasks = tasks.filter((t) => t.priority === selectedPriority);
    }

    // Filter by Status
    if (selectedStatus) {
      tasks = tasks.filter((t) => t.status === selectedStatus);
    }

    // Filter by Due Date (computed strictly in Asia/Kolkata)
    if (dueFilter) {
      tasks = tasks.filter((t) => matchesDueDateFilter(t, dueFilter));
    }

    // Client-side text search fallback / refinement
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      tasks = tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q))
      );
    }

    return tasks;
  }, [
    data?.tasks,
    myTasksOnly,
    user?.id,
    selectedAssigneeId,
    selectedPriority,
    selectedStatus,
    dueFilter,
    searchQuery,
  ]);

  // Check if any filter is active
  const isAnyFilterActive = Boolean(
    searchQuery.trim() ||
    selectedPriority ||
    selectedStatus ||
    selectedAssigneeId ||
    dueFilter ||
    myTasksOnly
  );

  // Clear all filters with one click
  const handleClearAll = () => {
    setSearchQuery("");
    setSelectedPriority("");
    setSelectedStatus("");
    setSelectedAssigneeId("");
    setDueFilter("");
    setMyTasksOnly(false);
    try {
      localStorage.setItem(MY_TASKS_STORAGE_KEY, "false");
    } catch {
      // ignore
    }
    setPage(1);
  };

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
        <div className="flex items-center gap-3">
          <BackButton />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Tasks
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Track workflow tasks, status transitions, and team action items
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* 1. "My Tasks" Toggle next to view switcher */}
          <button
            type="button"
            role="switch"
            aria-checked={myTasksOnly}
            onClick={handleToggleMyTasks}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              myTasksOnly
                ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
            title="Show only tasks assigned to me"
            aria-label="Toggle My Tasks only"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>My Tasks</span>
            <span
              className={`w-2 h-2 rounded-full transition-colors ${
                myTasksOnly ? "bg-white" : "bg-slate-300 dark:bg-slate-700"
              }`}
            />
          </button>

          {/* View Toggle */}
          <div className="flex items-center p-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/80">
            <button
              type="button"
              onClick={() => setViewMode("kanban")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
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
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
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

      {/* 5. Filters Bar with Quick filter chips beside search */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
        {/* Top search & dropdowns row */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search tasks by title or checklist..."
              className="w-full text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-8 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                aria-label="Clear search text"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Dropdown Filters (Assignee & Status) */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Assignee Filter Dropdown */}
            <select
              value={myTasksOnly ? (user?.id ?? "") : selectedAssigneeId}
              disabled={myTasksOnly}
              onChange={(e) => {
                setSelectedAssigneeId(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by Assignee"
              className={`text-xs sm:text-sm rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer ${
                myTasksOnly
                  ? "bg-slate-100 dark:bg-slate-800/50 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed"
                  : selectedAssigneeId
                  ? "border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 font-medium"
                  : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              }`}
            >
              <option value="">All Assignees</option>
              <option value="UNASSIGNED">Unassigned</option>
              {uniqueAssignees.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>

            {/* Status Dropdown */}
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value as TaskStatus | "");
                setPage(1);
              }}
              aria-label="Filter by Status"
              className={`text-xs sm:text-sm rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer ${
                selectedStatus
                  ? "border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 font-medium"
                  : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              }`}
            >
              <option value="">All Statuses</option>
              <option value="TODO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="BLOCKED">Blocked</option>
              <option value="DONE">Done</option>
            </select>

            {/* Clear all button */}
            {isAnyFilterActive && (
              <button
                type="button"
                onClick={handleClearAll}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900 transition-colors cursor-pointer"
                title="Reset all search and active filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear all</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Filter Chips Row (Priority & Due Date) */}
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <span className="text-slate-400 font-medium shrink-0">Quick filters:</span>

          {/* Priority Quick Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Urgent */}
            <button
              type="button"
              onClick={() => {
                setSelectedPriority((prev) => (prev === "URGENT" ? "" : "URGENT"));
                setPage(1);
              }}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                selectedPriority === "URGENT"
                  ? "bg-rose-100 text-rose-800 border-rose-400 dark:bg-rose-950/80 dark:text-rose-200 dark:border-rose-700 shadow-xs ring-1 ring-rose-400/30"
                  : "bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-rose-300 hover:text-rose-600"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              <span>Urgent</span>
            </button>

            {/* High */}
            <button
              type="button"
              onClick={() => {
                setSelectedPriority((prev) => (prev === "HIGH" ? "" : "HIGH"));
                setPage(1);
              }}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                selectedPriority === "HIGH"
                  ? "bg-amber-100 text-amber-800 border-amber-400 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-700 shadow-xs ring-1 ring-amber-400/30"
                  : "bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-amber-300 hover:text-amber-600"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span>High</span>
            </button>

            {/* Medium */}
            <button
              type="button"
              onClick={() => {
                setSelectedPriority((prev) => (prev === "MEDIUM" ? "" : "MEDIUM"));
                setPage(1);
              }}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                selectedPriority === "MEDIUM"
                  ? "bg-blue-100 text-blue-800 border-blue-400 dark:bg-blue-950/80 dark:text-blue-200 dark:border-blue-700 shadow-xs ring-1 ring-blue-400/30"
                  : "bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-blue-300 hover:text-blue-600"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              <span>Medium</span>
            </button>

            {/* Low */}
            <button
              type="button"
              onClick={() => {
                setSelectedPriority((prev) => (prev === "LOW" ? "" : "LOW"));
                setPage(1);
              }}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                selectedPriority === "LOW"
                  ? "bg-slate-200 text-slate-800 border-slate-400 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 shadow-xs ring-1 ring-slate-400/30"
                  : "bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              <span>Low</span>
            </button>
          </div>

          <span className="text-slate-300 dark:text-slate-700">|</span>

          {/* Due Date Quick Chips (Asia/Kolkata) */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Overdue */}
            <button
              type="button"
              onClick={() => {
                setDueFilter((prev) => (prev === "overdue" ? "" : "overdue"));
                setPage(1);
              }}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                dueFilter === "overdue"
                  ? "bg-rose-100 text-rose-800 border-rose-400 dark:bg-rose-950/80 dark:text-rose-200 dark:border-rose-700 shadow-xs ring-1 ring-rose-400/30"
                  : "bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-rose-300 hover:text-rose-600"
              }`}
            >
              <AlertCircle className="w-3 h-3 text-rose-500" />
              <span>Overdue</span>
            </button>

            {/* Today */}
            <button
              type="button"
              onClick={() => {
                setDueFilter((prev) => (prev === "today" ? "" : "today"));
                setPage(1);
              }}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                dueFilter === "today"
                  ? "bg-amber-100 text-amber-800 border-amber-400 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-700 shadow-xs ring-1 ring-amber-400/30"
                  : "bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-amber-300 hover:text-amber-600"
              }`}
            >
              <Clock className="w-3 h-3 text-amber-500" />
              <span>Due today</span>
            </button>

            {/* This week */}
            <button
              type="button"
              onClick={() => {
                setDueFilter((prev) => (prev === "thisWeek" ? "" : "thisWeek"));
                setPage(1);
              }}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                dueFilter === "thisWeek"
                  ? "bg-indigo-100 text-indigo-800 border-indigo-400 dark:bg-indigo-950/80 dark:text-indigo-200 dark:border-indigo-700 shadow-xs ring-1 ring-indigo-400/30"
                  : "bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-indigo-300 hover:text-indigo-600"
              }`}
            >
              <Calendar className="w-3 h-3 text-indigo-500" />
              <span>This week</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content View: Kanban vs List */}
      {isLoading ? (
        viewMode === "kanban" ? (
          <KanbanSkeleton />
        ) : (
          <div className="p-8 text-center text-slate-400">Loading tasks...</div>
        )
      ) : viewMode === "kanban" ? (
        <TaskKanbanBoard
          tasks={displayedTasks}
          onStatusChange={handleStatusChange}
        />
      ) : (
        <TaskListView
          tasks={displayedTasks}
          onStatusChange={handleStatusChange}
          page={data?.page}
          totalPages={data?.totalPages}
          total={displayedTasks.length}
          onPageChange={(newPage) => setPage(newPage)}
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
