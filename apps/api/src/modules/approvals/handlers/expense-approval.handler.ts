import {
  Role,
  type Prisma,
} from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import { auditService } from "../../audit/audit.service";
import { notificationService } from "../../notifications/notification.service";
import type {
  ApprovalEntityHandler,
  ApprovalEntityDetails,
  OnStepApprovedParams,
  OnFinalApprovedParams,
  OnRejectedParams,
} from "./approval-handler.interface";

export class ExpenseApprovalHandler implements ApprovalEntityHandler {
  readonly entityType = "EXPENSE";

  getLink(entityId: string): string {
    return `/expenses/${entityId}`;
  }

  getEntityTypeName(): string {
    return "Expense";
  }

  async getEntityDetails(
    entityId: string,
    tx?: Prisma.TransactionClient
  ): Promise<ApprovalEntityDetails | null> {
    const client = tx || prisma;
    const steps = await client.approvalStep.findMany({
      where: {
        entityType: this.entityType,
        entityId,
      },
      include: {
        approver: true,
      },
      orderBy: { stepOrder: "asc" },
    });

    if (steps.length === 0) return null;

    // Default metadata for Expense items until full Expense module models are introduced
    return {
      id: entityId,
      title: `Expense Claim #${entityId.slice(0, 8)}`,
      description: "Employee expense claim pending reimbursement approval",
      requesterId: "",
      requester: {
        id: "",
        name: "Expense Claimant",
        email: "",
        role: Role.EMPLOYEE,
        departmentId: null,
      },
      link: this.getLink(entityId),
      approvalSteps: steps.map((s) => ({
        id: s.id,
        stepOrder: s.stepOrder,
        status: s.status,
      })),
      metadata: {
        entityType: this.entityType,
      },
    };
  }

  async onStepApproved(params: OnStepApprovedParams): Promise<void> {
    const { step, nextStep, user } = params;
    await auditService.log({
      actorId: user.id,
      action: "EXPENSE_STEP_APPROVED",
      entityType: this.getEntityTypeName(),
      entityId: step.entityId,
      summary: `Approved step ${step.stepOrder} for expense claim #${step.entityId.slice(0, 8)}`,
      metadata: {
        stepOrder: step.stepOrder,
        nextStepOrder: nextStep?.stepOrder ?? null,
      },
    });
  }

  async onFinalApproved(params: OnFinalApprovedParams): Promise<void> {
    const { step, user } = params;
    await auditService.log({
      actorId: user.id,
      action: "EXPENSE_APPROVED",
      entityType: this.getEntityTypeName(),
      entityId: step.entityId,
      summary: `Final approval granted for expense claim #${step.entityId.slice(0, 8)}`,
      metadata: {
        finalStepOrder: step.stepOrder,
      },
    });
  }

  async onRejected(params: OnRejectedParams): Promise<void> {
    const { step, user, comment } = params;
    await auditService.log({
      actorId: user.id,
      action: "EXPENSE_REJECTED",
      entityType: this.getEntityTypeName(),
      entityId: step.entityId,
      summary: `Expense claim #${step.entityId.slice(0, 8)} was rejected at step ${step.stepOrder}`,
      metadata: {
        rejectedAtStep: step.stepOrder,
        reason: comment.trim(),
      },
    });
  }
}

export const expenseApprovalHandler = new ExpenseApprovalHandler();
