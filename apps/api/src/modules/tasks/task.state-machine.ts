import { TaskStatus } from "@prisma/client";

/**
 * State machine for Task lifecycle:
 * To Do -> In Progress -> Blocked -> Done
 */
export const TASK_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  [TaskStatus.TODO]: [TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED],
  [TaskStatus.IN_PROGRESS]: [TaskStatus.BLOCKED, TaskStatus.DONE, TaskStatus.TODO],
  [TaskStatus.BLOCKED]: [TaskStatus.IN_PROGRESS, TaskStatus.DONE, TaskStatus.TODO],
  [TaskStatus.DONE]: [TaskStatus.TODO, TaskStatus.IN_PROGRESS],
} as const;

export function canTransitionTask(from: TaskStatus, to: TaskStatus): boolean {
  if (from === to) return true;
  const allowed = TASK_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}
