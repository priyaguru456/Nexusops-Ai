import React, { useState } from "react";
import { Calendar } from "lucide-react";
import { PriorityBadge } from "../../components/ui/PriorityBadge";
import type { TaskItem, TaskStatus } from "../../types/tasks";

interface TaskKanbanBoardProps {
  tasks: TaskItem[];
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onTaskClick?: (task: TaskItem) => void;
}

const COLUMNS: Array<{
  status: TaskStatus;
  title: string;
  dotColor: string;
  badgeBg: string;
}> = [
  {
    status: "TODO",
    title: "To Do",
    dotColor: "bg-slate-400",
    badgeBg: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300",
  },
  {
    status: "IN_PROGRESS",
    title: "In Progress",
    dotColor: "bg-amber-500",
    badgeBg: "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300",
  },
  {
    status: "BLOCKED",
    title: "Blocked",
    dotColor: "bg-rose-500",
    badgeBg: "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300",
  },
  {
    status: "DONE",
    title: "Done",
    dotColor: "bg-emerald-500",
    badgeBg: "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300",
  },
];

export function TaskKanbanBoard({
  tasks,
  onStatusChange,
  onTaskClick,
}: TaskKanbanBoardProps): React.JSX.Element {
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null);

  const handleDragStart = (e: React.DragEvent, task: TaskItem) => {
    e.dataTransfer.setData("text/plain", task.id);
    e.dataTransfer.effectAllowed = "move";
    setActiveDragId(task.id);
  };

  const handleDragEnd = () => {
    setActiveDragId(null);
    setDragOverCol(null);
  };

  const handleDragOver = (e: React.DragEvent, colStatus: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverCol !== colStatus) {
      setDragOverCol(colStatus);
    }
  };

  const handleDrop = (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    setDragOverCol(null);
    setActiveDragId(null);

    const taskId = e.dataTransfer.getData("text/plain");
    if (!taskId) return;

    const task = tasks.find((t) => t.id === taskId);
    if (task && task.status !== targetStatus) {
      onStatusChange(taskId, targetStatus);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start select-none">
      {COLUMNS.map((column) => {
        const columnTasks = tasks.filter((t) => t.status === column.status);
        const isHovered = dragOverCol === column.status;

        return (
          <div
            key={column.status}
            onDragOver={(e) => handleDragOver(e, column.status)}
            onDragLeave={() => setDragOverCol(null)}
            onDrop={(e) => handleDrop(e, column.status)}
            className={`flex flex-col rounded-2xl border p-4 transition-all duration-200 min-h-[500px] ${
              isHovered
                ? "border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20 ring-2 ring-indigo-400/30"
                : "border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40"
            }`}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200/60 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${column.dotColor}`} />
                <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                  {column.title}
                </h3>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${column.badgeBg}`}>
                {columnTasks.length}
              </span>
            </div>

            {/* Column Cards */}
            <div className="space-y-3 flex-1">
              {columnTasks.map((task) => {
                const isDragging = activeDragId === task.id;

                return (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task)}
                    onDragEnd={handleDragEnd}
                    onClick={() => onTaskClick?.(task)}
                    className={`group p-4 rounded-xl border bg-white dark:bg-slate-900 shadow-xs hover:shadow-md transition-all duration-200 cursor-grab active:cursor-grabbing ${
                      isDragging
                        ? "opacity-40 border-dashed border-indigo-400"
                        : "border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-slate-700"
                    }`}
                  >
                    {/* Header: Priority & ID */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <PriorityBadge priority={task.priority} />
                      {task.dueDate && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-400">
                          <Calendar className="w-3 h-3" />
                          <span>
                            {new Date(task.dueDate).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Task Title */}
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2 mb-1.5">
                      {task.title}
                    </h4>

                    {/* Task Description */}
                    {task.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">
                        {task.description}
                      </p>
                    )}

                    {/* Footer: Linked Request & Assignee */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                      {task.request ? (
                        <span className="text-[11px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded truncate max-w-[120px]">
                          #{task.request.id.slice(0, 6)}
                        </span>
                      ) : (
                        <span />
                      )}

                      {task.assignee ? (
                        <div
                          className="flex items-center gap-1.5"
                          title={`Assigned to ${task.assignee.name}`}
                        >
                          <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold flex items-center justify-center">
                            {task.assignee.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 truncate max-w-[80px]">
                            {task.assignee.name.split(" ")[0]}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Unassigned</span>
                      )}
                    </div>
                  </div>
                );
              })}

              {columnTasks.length === 0 && (
                <div className="h-32 flex items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400">
                  Drop tasks here
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
