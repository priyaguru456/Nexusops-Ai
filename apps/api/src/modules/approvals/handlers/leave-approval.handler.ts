import {
  Role,
  LeaveType,
  type Prisma,
} from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import { auditService } from "../../audit/audit.service";
import { notificationService } from "../../notifications/notification.service";
import { leaveService } from "../../leaves/leave.service";
import type {
  ApprovalEntityHandler,
  ApprovalEntityDetails,
  OnStepApprovedParams,
  OnFinalApprovedParams,
  OnRejectedParams,
} from "./approval-handler.interface";

export class LeaveApprovalHandler implements ApprovalEntityHandler {
  readonly entityType = "LEAVE";

  getLink(entityId: string): string {
    return `/leaves/${entityId}`;
  }

  getEntityTypeName(): string {
    return "Leave";
  }

  async getEntityDetails(
    entityId: string,
    tx?: Prisma.TransactionClient
  ): Promise<ApprovalEntityDetails | null> {
    const client = tx || prisma;
    const leave = await client.leaveRequest.findUnique({
      where: { id: entityId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            departmentId: true,
            managerId: true,
          },
        },
      },
    });

    if (!leave) return null;

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

    return {
      id: entityId,
      title: `${leave.type} Leave (${leave.daysCount} days)`,
      description: leave.reason,
      requesterId: leave.userId,
      requester: {
        id: leave.user.id,
        name: leave.user.name,
        email: leave.user.email,
        role: leave.user.role,
        departmentId: leave.user.departmentId,
      },
      link: this.getLink(entityId),
      approvalSteps: steps.map((s) => ({
        id: s.id,
        stepOrder: s.stepOrder,
        status: s.status,
      })),
      metadata: {
        entityType: this.entityType,
        type: leave.type,
        startDate: leave.startDate,
        endDate: leave.endDate,
        daysCount: leave.daysCount,
      },
    };
  }

  async onStepApproved(params: OnStepApprovedParams): Promise<void> {
    const { step, nextStep, user } = params;
    await auditService.log({
      actorId: user.id,
      action: "LEAVE_STEP_APPROVED",
      entityType: this.getEntityTypeName(),
      entityId: step.entityId,
      summary: `Approved step ${step.stepOrder} for leave request #${step.entityId.slice(0, 8)}`,
      metadata: {
        stepOrder: step.stepOrder,
        nextStepOrder: nextStep?.stepOrder ?? null,
      },
    });
  }

  async onFinalApproved(params: OnFinalApprovedParams): Promise<void> {
    const { step, user, comment, tx } = params;
    await leaveService.approveLeave(step.entityId, user, comment, tx);
  }

  async onRejected(params: OnRejectedParams): Promise<void> {
    const { step, user, comment, tx } = params;
    await leaveService.rejectLeave(step.entityId, user, comment, tx);
  }
}

export const leaveApprovalHandler = new LeaveApprovalHandler();
