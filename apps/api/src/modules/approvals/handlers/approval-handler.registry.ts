import { AppError } from "../../../lib/errors";
import type { ApprovalEntityHandler } from "./approval-handler.interface";
import { requestApprovalHandler } from "./request-approval.handler";
import { leaveApprovalHandler } from "./leave-approval.handler";
import { expenseApprovalHandler } from "./expense-approval.handler";

export class ApprovalHandlerRegistry {
  private handlers = new Map<string, ApprovalEntityHandler>();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults() {
    this.register(requestApprovalHandler);
    // Alias for WorkRequest naming convention
    this.handlers.set("WORKREQUEST", requestApprovalHandler);
    this.register(leaveApprovalHandler);
    this.register(expenseApprovalHandler);
  }

  register(handler: ApprovalEntityHandler): void {
    const key = handler.entityType.toUpperCase();
    this.handlers.set(key, handler);
  }

  unregister(entityType: string): void {
    const key = entityType.toUpperCase();
    this.handlers.delete(key);
  }

  has(entityType: string): boolean {
    return this.handlers.has(entityType.toUpperCase());
  }

  get(entityType: string): ApprovalEntityHandler {
    const key = (entityType || "REQUEST").toUpperCase();
    const handler = this.handlers.get(key);
    if (!handler) {
      throw AppError.badRequest(`Unsupported approval entity type: ${entityType}`);
    }
    return handler;
  }

  /**
   * Resets registry back to default handlers (useful in unit tests).
   */
  reset(): void {
    this.handlers.clear();
    this.registerDefaults();
  }
}

export const approvalHandlerRegistry = new ApprovalHandlerRegistry();
