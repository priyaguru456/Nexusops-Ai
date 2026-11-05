import {
  RequestStatus,
  TaskStatus,
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

export class RequestApprovalHandler implements ApprovalEntityHandler {
  readonly entityType = "REQUEST";

  getLink(entityId: string): string {
    return `/requests/${entityId}`;
  }

  getEntityTypeName(): string {
    return "WorkRequest";
  }

  async getEntityDetails(
    entityId: string,
    tx?: Prisma.TransactionClient
  ): Promise<ApprovalEntityDetails | null> {
    const client = tx || prisma;
    const request = await client.workRequest.findUnique({
      where: { id: entityId },
      include: {
        requester: {
          include: {
            department: true,
          },
        },
        approvalSteps: {
          orderBy: { stepOrder: "asc" },
        },
      },
    });

    if (!request) return null;

    return {
      id: request.id,
      title: request.title,
      description: request.description,
      requesterId: request.requesterId,
      requester: request.requester || {
        id: request.requesterId,
        name: "Requester",
        email: "",
        role: Role.EMPLOYEE,
        departmentId: null,
      },
      status: request.status,
      priority: request.priority,
      category: request.category,
      amount: request.amount,
      dueDate: request.dueDate,
      link: this.getLink(request.id),
      approvalSteps: (request.approvalSteps || []).map((s) => ({
        id: s.id,
        stepOrder: s.stepOrder,
        status: s.status,
      })),
      metadata: {
        category: request.category,
        flowId: request.flowId,
      },
    };
  }

  async onStepApproved(params: OnStepApprovedParams): Promise<void> {
    const { step, nextStep, user, tx } = params;
    const requestId = step.requestId || step.entityId;

    const request =
      (await tx.workRequest.findUnique({
        where: { id: requestId },
        include: {
          requester: {
            select: {
              id: true,
              name: true,
              departmentId: true,
            },
          },
        },
      })) || (step as any).request;

    if (!request) return;

    if (request.status !== RequestStatus.IN_REVIEW) {
      await tx.workRequest.update({
        where: { id: requestId },
        data: { status: RequestStatus.IN_REVIEW },
      });
    }

    if (nextStep) {
      // Notify next approver(s)
      let nextApproverIds: string[] = [];

      if (nextStep.approverId) {
        if (nextStep.approverId !== request.requesterId) {
          nextApproverIds = [nextStep.approverId];
        }
      } else {
        const eligibleNext = await tx.user.findMany({
          where: {
            role: nextStep.approverRole,
            isActive: true,
            ...(request.requester?.departmentId
              ? { departmentId: request.requester.departmentId }
              : {}),
          },
          select: { id: true },
        });

        nextApproverIds = eligibleNext
          .map((u) => u.id)
          .filter((id) => id !== request.requesterId);
      }

      if (nextApproverIds.length > 0) {
        await notificationService.notifyMultiple(
          nextApproverIds,
          "APPROVAL_REQUESTED",
          "Approval Required",
          `Step ${nextStep.stepOrder} approval needed for "${request.title}"`,
          this.getLink(requestId),
          this.getEntityTypeName(),
          requestId
        );
      }

      // Notify requester of progress
      await notificationService.notify({
        userId: request.requesterId,
        type: "APPROVAL_DECISION",
        title: "Request Update",
        message: `Step ${step.stepOrder} of your request "${request.title}" was approved by ${user.name}`,
        link: this.getLink(requestId),
        entityType: this.getEntityTypeName(),
        entityId: requestId,
      });
    }
  }

  async onFinalApproved(params: OnFinalApprovedParams): Promise<void> {
    const { step, user, tx } = params;
    const requestId = step.requestId || step.entityId;

    const request =
      (await tx.workRequest.findUnique({
        where: { id: requestId },
      })) || (step as any).request;

    if (!request) return;

    // Final approval sets request to APPROVED and auto-creates a fulfillment task
    await tx.workRequest.update({
      where: { id: requestId },
      data: { status: RequestStatus.APPROVED },
    });

    const createdTask = await tx.task.create({
      data: {
        title: `Fulfill Request: ${request.title}`,
        description: `Auto-generated task from approved request #${request.id.slice(0, 8)}.\n\n${request.description}`,
        priority: request.priority,
        status: TaskStatus.TODO,
        dueDate: request.dueDate,
        requestId: request.id,
        assignedById: user.id,
        assigneeId: null,
      },
    });

    await auditService.log({
      actorId: user.id,
      action: "REQUEST_APPROVED",
      entityType: this.getEntityTypeName(),
      entityId: requestId,
      summary: `Final approval granted for request "${request.title}"`,
      metadata: {
        finalStepOrder: step.stepOrder,
        autoTaskId: createdTask.id,
      },
    });

    await auditService.log({
      actorId: user.id,
      action: "TASK_CREATED",
      entityType: "Task",
      entityId: createdTask.id,
      summary: `Auto-created fulfillment task for request "${request.title}"`,
      metadata: {
        autoCreated: true,
        requestId,
      },
    });

    // Notify requester of approval and task creation
    await notificationService.notify({
      userId: request.requesterId,
      type: "APPROVAL_DECISION",
      title: "Request Approved",
      message: `Your request "${request.title}" has been approved! A fulfillment task has been created.`,
      link: this.getLink(requestId),
      entityType: this.getEntityTypeName(),
      entityId: requestId,
    });
  }

  async onRejected(params: OnRejectedParams): Promise<void> {
    const { step, user, comment, tx } = params;
    const requestId = step.requestId || step.entityId;

    const request =
      (await tx.workRequest.findUnique({
        where: { id: requestId },
      })) || (step as any).request;

    if (!request) return;

    await tx.workRequest.update({
      where: { id: requestId },
      data: { status: RequestStatus.REJECTED },
    });

    await auditService.log({
      actorId: user.id,
      action: "REQUEST_REJECTED",
      entityType: this.getEntityTypeName(),
      entityId: requestId,
      summary: `Request "${request.title}" was rejected at step ${step.stepOrder}`,
      metadata: {
        rejectedAtStep: step.stepOrder,
        reason: comment.trim(),
      },
    });

    await notificationService.notify({
      userId: request.requesterId,
      type: "APPROVAL_DECISION",
      title: "Request Rejected",
      message: `Your request "${request.title}" was rejected by ${user.name}: "${comment.trim()}"`,
      link: this.getLink(requestId),
      entityType: this.getEntityTypeName(),
      entityId: requestId,
    });
  }
}

export const requestApprovalHandler = new RequestApprovalHandler();
