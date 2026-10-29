import { RequestStatus } from "@prisma/client";

/**
 * State machine transition map for WorkRequest lifecycle:
 * Draft -> Submitted -> In Review -> Approved/Rejected -> In Progress -> Completed/Cancelled
 */
export const REQUEST_TRANSITIONS: Record<RequestStatus, readonly RequestStatus[]> = {
  [RequestStatus.DRAFT]: [RequestStatus.SUBMITTED, RequestStatus.CANCELLED],
  [RequestStatus.SUBMITTED]: [RequestStatus.IN_REVIEW, RequestStatus.CANCELLED],
  [RequestStatus.IN_REVIEW]: [RequestStatus.APPROVED, RequestStatus.REJECTED, RequestStatus.CANCELLED],
  [RequestStatus.APPROVED]: [RequestStatus.IN_PROGRESS, RequestStatus.CANCELLED],
  [RequestStatus.REJECTED]: [],
  [RequestStatus.IN_PROGRESS]: [RequestStatus.COMPLETED, RequestStatus.CANCELLED],
  [RequestStatus.COMPLETED]: [],
  [RequestStatus.CANCELLED]: [],
} as const;

export function canTransitionRequest(from: RequestStatus, to: RequestStatus): boolean {
  const allowed = REQUEST_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}
