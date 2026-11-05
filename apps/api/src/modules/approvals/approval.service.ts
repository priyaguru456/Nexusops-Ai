import { prisma } from "../../lib/prisma";
import {
  Role,
  ApprovalStatus,
  RequestStatus,
  Prisma,
  type WorkRequest,
} from "@prisma/client";
import { approvalRepository } from "./approval.repository";
import { approvalHandlerRegistry } from "./handlers/approval-handler.registry";
import type { ApprovalEntityDetails } from "./handlers/approval-handler.interface";
import { auditService } from "../audit/audit.service";
import { notificationService } from "../notifications/notification.service";
import { AppError } from "../../lib/errors";
import type { AuthenticatedUser } from "../../types/express";

export class ApprovalService {
  /**
   * On submit, loads the approval flow for the request's category and amount,
   * then creates approval steps rows in order.
   * Backward-compatible with existing WorkRequest workflow.
   */
  async initializeApprovalSteps(
    requestId: string,
    request: {
      category: WorkRequest["category"];
      amount: WorkRequest["amount"];
      title: string;
      requesterId: string;
    },
    tx?: Prisma.TransactionClient
  ) {
    const amountVal =
      request.amount !== null && request.amount !== undefined
        ? Number(request.amount)
        : null;
    const flow = await approvalRepository.findMatchingFlow(
      request.category,
      amountVal,
      tx
    );

    let stepsToCreate: Array<{
      stepOrder: number;
      approverRole: Role;
      approverId?: string | null;
    }> = [];
    let matchedFlowId: string | null = null;

    if (flow && flow.steps.length > 0) {
      matchedFlowId = flow.id;
      stepsToCreate = flow.steps.map((s) => ({
        stepOrder: s.stepOrder,
        approverRole: s.approverRole || (s as any).approver?.role || Role.MANAGER,
        approverId: s.approverId ?? null,
      }));
    } else {
      // Default single-step manager approval if no flow is registered or matches
      stepsToCreate = [{ stepOrder: 1, approverRole: Role.MANAGER, approverId: null }];
    }

    const client = tx || prisma;

    // Track which flow was matched for this request (enables in-use checks)
    if (matchedFlowId) {
      await client.workRequest.update({
        where: { id: requestId },
        data: { flowId: matchedFlowId },
      });
    }

    await approvalRepository.createApprovalSteps(
      {
        entityType: "REQUEST",
        entityId: requestId,
        requestId,
        steps: stepsToCreate,
      },
      undefined,
      tx
    );

    // Notify managers / first approvers
    const firstStep = stepsToCreate[0];
    let approverIds: string[] = [];

    if (firstStep.approverId) {
      if (firstStep.approverId !== request.requesterId) {
        approverIds = [firstStep.approverId];
      }
    } else {
      const requester = await client.user.findUnique({
        where: { id: request.requesterId },
        select: { departmentId: true, managerId: true },
      });

      const eligibleApprovers = await client.user.findMany({
        where: {
          role: firstStep.approverRole,
          isActive: true,
          ...(requester?.departmentId
            ? { departmentId: requester.departmentId }
            : {}),
        },
        select: { id: true },
      });

      approverIds = eligibleApprovers
        .map((u) => u.id)
        .filter((id) => id !== request.requesterId);
    }

    if (approverIds.length > 0) {
      await notificationService.notifyMultiple(
        approverIds,
        "APPROVAL_REQUESTED",
        "Approval Requested",
        `Approval requested for "${request.title}"`,
        `/requests/${requestId}`,
        "WorkRequest",
        requestId
      );
    }
  }

  /**
   * Generic step initialization for any entity type (e.g., Leave, Expense, or test entities).
   */
  async initializeApprovalStepsForEntity(
    params: {
      entityType: string;
      entityId: string;
      title: string;
      requesterId: string;
      steps: Array<{
        stepOrder: number;
        approverRole: Role;
        approverId?: string | null;
      }>;
      requestId?: string | null;
      link?: string;
    },
    tx?: Prisma.TransactionClient
  ) {
    const { entityType, entityId, title, requesterId, steps, requestId, link } = params;
    const client = tx || prisma;

    await approvalRepository.createApprovalSteps(
      {
        entityType,
        entityId,
        requestId: requestId ?? (entityType === "REQUEST" ? entityId : null),
        steps,
      },
      undefined,
      tx
    );

    if (steps.length === 0) return;

    const firstStep = steps[0];
    let approverIds: string[] = [];

    if (firstStep.approverId) {
      if (firstStep.approverId !== requesterId) {
        approverIds = [firstStep.approverId];
      }
    } else {
      const requester = await client.user.findUnique({
        where: { id: requesterId },
        select: { departmentId: true, managerId: true },
      });

      const eligibleApprovers = await client.user.findMany({
        where: {
          role: firstStep.approverRole,
          isActive: true,
          ...(requester?.departmentId
            ? { departmentId: requester.departmentId }
            : {}),
        },
        select: { id: true },
      });

      approverIds = eligibleApprovers
        .map((u) => u.id)
        .filter((id) => id !== requesterId);
    }

    if (approverIds.length > 0) {
      const handler = approvalHandlerRegistry.get(entityType);
      const targetLink = link || handler.getLink(entityId);
      await notificationService.notifyMultiple(
        approverIds,
        "APPROVAL_REQUESTED",
        "Approval Requested",
        `Approval requested for "${title}"`,
        targetLink,
        handler.getEntityTypeName(),
        entityId
      );
    }
  }

  /**
   * Verifies if a user is eligible to act on a given approval step.
   */
  private isUserEligibleForStep(
    step: {
      approverRole: Role;
      approverId: string | null;
      request?: {
        requesterId: string;
        requester?: { departmentId: string | null; managerId: string | null } | null;
      } | null;
    },
    user: AuthenticatedUser,
    entityDetails?: ApprovalEntityDetails | null
  ): boolean {
    const requesterId =
      step.request?.requesterId ?? entityDetails?.requesterId;

    // Requesters can never approve or decide on their own items
    if (requesterId && requesterId === user.id) {
      return false;
    }

    // Admins can approve any step
    if (user.role === Role.ADMIN) {
      return true;
    }

    // Explicit assignee takes priority
    if (step.approverId) {
      return step.approverId === user.id;
    }

    // Role check
    if (user.role === Role.MANAGER && step.approverRole === Role.MANAGER) {
      const requesterObj = step.request?.requester ?? entityDetails?.requester;
      if (!requesterObj) {
        return true;
      }
      // Manager department matching: same department or direct manager
      const isDirectManager = requesterObj.managerId === user.id;
      const isSameDept = Boolean(
        user.departmentId && requesterObj.departmentId === user.departmentId
      );
      return isDirectManager || isSameDept || !user.departmentId;
    }

    return user.role === step.approverRole;
  }

  /**
   * GET /api/approvals/pending
   * Returns steps assigned to my role/me that are currently active in the sequence.
   */
  async getPendingApprovals(user: AuthenticatedUser) {
    const candidates = await approvalRepository.findActivePendingCandidateSteps();

    // Cache entity details per (entityType, entityId) to avoid duplicate queries
    const detailsCache = new Map<string, ApprovalEntityDetails | null>();

    const activeAndEligible: any[] = [];

    for (const step of candidates) {
      const entityType = step.entityType || "REQUEST";
      const entityId = step.entityId || step.requestId || "";
      const cacheKey = `${entityType}:${entityId}`;

      let entityDetails: ApprovalEntityDetails | null = null;

      if (step.request && entityType === "REQUEST") {
        entityDetails = {
          id: step.request.id || entityId,
          title: step.request.title,
          description: step.request.description,
          requesterId: step.request.requesterId,
          requester: step.request.requester,
          status: step.request.status,
          priority: step.request.priority,
          category: step.request.category,
          amount: step.request.amount,
          dueDate: step.request.dueDate,
          link: `/requests/${step.request.id || entityId}`,
          approvalSteps: step.request.approvalSteps,
        };
      } else if (detailsCache.has(cacheKey)) {
        entityDetails = detailsCache.get(cacheKey) || null;
      } else {
        if (approvalHandlerRegistry.has(entityType)) {
          const handler = approvalHandlerRegistry.get(entityType);
          entityDetails = await handler.getEntityDetails(entityId);
          detailsCache.set(cacheKey, entityDetails);
        } else {
          detailsCache.set(cacheKey, null);
        }
      }

      const requesterId = step.request?.requesterId ?? entityDetails?.requesterId;

      // 1. Check self-approval block
      if (requesterId && requesterId === user.id) {
        continue;
      }

      // 2. Check out-of-order: all steps with stepOrder < current must be APPROVED
      let siblingSteps = step.request?.approvalSteps;
      if (!siblingSteps || siblingSteps.length === 0) {
        siblingSteps = await approvalRepository.findSiblingSteps(entityType, entityId);
      }

      const precedingSteps = siblingSteps.filter((s: any) => s.stepOrder < step.stepOrder);
      const allPrecedingApproved = precedingSteps.every(
        (s: any) => s.status === ApprovalStatus.APPROVED
      );
      if (!allPrecedingApproved) {
        continue;
      }

      // 3. Check role / assignee eligibility
      if (!this.isUserEligibleForStep(step, user, entityDetails)) {
        continue;
      }

      // Decorate with generic UI fields while preserving backward-compatible request object
      const handler = approvalHandlerRegistry.has(entityType)
        ? approvalHandlerRegistry.get(entityType)
        : null;

      const itemTitle =
        step.request?.title || entityDetails?.title || `Approval #${step.id.slice(0, 8)}`;
      const itemLink =
        entityDetails?.link || (handler ? handler.getLink(entityId) : `/requests/${entityId}`);

      activeAndEligible.push({
        ...step,
        entityType,
        entityId,
        itemTitle,
        itemLink,
        itemDescription: step.request?.description ?? entityDetails?.description ?? null,
      });
    }

    return activeAndEligible;
  }

  /**
   * POST /api/approvals/:stepId/approve
   * Decision runs inside a database transaction.
   */
  async approveStep(
    stepId: string,
    user: AuthenticatedUser,
    comment?: string
  ) {
    return prisma.$transaction(async (tx) => {
      const step = await approvalRepository.findStepById(stepId, tx);
      if (!step) {
        throw AppError.notFound("Approval step not found");
      }

      if (step.status !== ApprovalStatus.PENDING) {
        throw AppError.conflict(
          `Approval step has already been decided with status: ${step.status}`
        );
      }

      const entityType = step.entityType || "REQUEST";
      const entityId = step.entityId || step.requestId || "";
      const handler = approvalHandlerRegistry.get(entityType);

      let entityDetails: ApprovalEntityDetails | null = null;
      if (step.request && entityType === "REQUEST") {
        entityDetails = {
          id: step.request.id || entityId,
          title: step.request.title,
          description: step.request.description,
          requesterId: step.request.requesterId,
          requester: step.request.requester,
          status: step.request.status,
          priority: step.request.priority,
          category: step.request.category,
          amount: step.request.amount,
          dueDate: step.request.dueDate,
          link: handler.getLink(step.request.id || entityId),
          approvalSteps: step.request.approvalSteps,
        };
      } else {
        entityDetails = await handler.getEntityDetails(entityId, tx);
      }

      // Rule: Requester cannot approve their own item
      const requesterId = step.request?.requesterId ?? entityDetails?.requesterId;
      if (requesterId && requesterId === user.id) {
        throw AppError.forbidden("Requesters cannot approve their own requests");
      }

      // Rule: Steps run in order. Preceding steps must be APPROVED
      let siblingSteps = step.request?.approvalSteps;
      if (!siblingSteps || siblingSteps.length === 0) {
        siblingSteps = await approvalRepository.findSiblingSteps(entityType, entityId, tx);
      }

      const precedingSteps = siblingSteps.filter((s: any) => s.stepOrder < step.stepOrder);
      const isPrecedingComplete = precedingSteps.every(
        (s: any) => s.status === ApprovalStatus.APPROVED
      );

      if (!isPrecedingComplete) {
        throw AppError.badRequest(
          "Cannot approve out-of-order step. Preceding approval steps must be approved first."
        );
      }

      // Permission check
      if (!this.isUserEligibleForStep(step, user, entityDetails)) {
        throw AppError.forbidden("You are not authorized to approve this step");
      }

      // 1. Update this step to APPROVED
      const updatedStep = await approvalRepository.updateStep(
        stepId,
        {
          status: ApprovalStatus.APPROVED,
          approverId: user.id,
          decidedAt: new Date(),
          comment: comment?.trim() || null,
        },
        tx
      );

      const itemTitle =
        step.request?.title || entityDetails?.title || `Approval #${step.id.slice(0, 8)}`;

      await auditService.log({
        actorId: user.id,
        action: "APPROVAL_STEP_APPROVED",
        entityType: "ApprovalStep",
        entityId: stepId,
        summary: `Approved step ${step.stepOrder} for ${handler.getEntityTypeName().toLowerCase()} "${itemTitle}"`,
        metadata: {
          stepOrder: step.stepOrder,
          entityType,
          entityId,
          requestId: step.requestId,
          comment: comment ?? null,
        },
      });

      // 2. Check if there are subsequent steps
      const nextStep = siblingSteps.find((s: any) => s.stepOrder === step.stepOrder + 1);

      if (nextStep) {
        // Next step is now active. Set activatedAt timestamp.
        await tx.approvalStep.update({
          where: { id: nextStep.id },
          data: { activatedAt: new Date() },
        });

        // Delegate intermediate progression to the entity handler
        if (handler.onStepApproved) {
          await handler.onStepApproved({
            step: {
              id: step.id,
              entityType,
              entityId,
              requestId: step.requestId,
              stepOrder: step.stepOrder,
              approverRole: step.approverRole,
              approverId: step.approverId,
              request: step.request,
            },
            nextStep,
            user,
            comment,
            tx,
          });
        }
      } else {
        // Final approval step! Delegate final approval to entity handler
        await handler.onFinalApproved({
          step: {
            id: step.id,
            entityType,
            entityId,
            requestId: step.requestId,
            stepOrder: step.stepOrder,
            approverRole: step.approverRole,
            approverId: step.approverId,
            request: step.request,
          },
          user,
          comment,
          tx,
        });
      }

      return updatedStep;
    });
  }

  /**
   * POST /api/approvals/:stepId/reject
   * Comment REQUIRED on reject. Rejection ends flow and marks entity Rejected.
   * Runs inside a database transaction.
   */
  async rejectStep(
    stepId: string,
    user: AuthenticatedUser,
    comment: string
  ) {
    if (!comment || !comment.trim()) {
      throw AppError.badRequest("Comment is required when rejecting an approval step");
    }

    return prisma.$transaction(async (tx) => {
      const step = await approvalRepository.findStepById(stepId, tx);
      if (!step) {
        throw AppError.notFound("Approval step not found");
      }

      if (step.status !== ApprovalStatus.PENDING) {
        throw AppError.conflict(
          `Approval step has already been decided with status: ${step.status}`
        );
      }

      const entityType = step.entityType || "REQUEST";
      const entityId = step.entityId || step.requestId || "";
      const handler = approvalHandlerRegistry.get(entityType);

      let entityDetails: ApprovalEntityDetails | null = null;
      if (step.request && entityType === "REQUEST") {
        entityDetails = {
          id: step.request.id || entityId,
          title: step.request.title,
          description: step.request.description,
          requesterId: step.request.requesterId,
          requester: step.request.requester,
          status: step.request.status,
          priority: step.request.priority,
          category: step.request.category,
          amount: step.request.amount,
          dueDate: step.request.dueDate,
          link: handler.getLink(step.request.id || entityId),
          approvalSteps: step.request.approvalSteps,
        };
      } else {
        entityDetails = await handler.getEntityDetails(entityId, tx);
      }

      // Requesters cannot reject their own item
      const requesterId = step.request?.requesterId ?? entityDetails?.requesterId;
      if (requesterId && requesterId === user.id) {
        throw AppError.forbidden("Requesters cannot decide on their own requests");
      }

      // Check preceding steps
      let siblingSteps = step.request?.approvalSteps;
      if (!siblingSteps || siblingSteps.length === 0) {
        siblingSteps = await approvalRepository.findSiblingSteps(entityType, entityId, tx);
      }

      const precedingSteps = siblingSteps.filter((s: any) => s.stepOrder < step.stepOrder);
      const isPrecedingComplete = precedingSteps.every(
        (s: any) => s.status === ApprovalStatus.APPROVED
      );

      if (!isPrecedingComplete) {
        throw AppError.badRequest(
          "Cannot reject out-of-order step. Preceding approval steps must be approved first."
        );
      }

      if (!this.isUserEligibleForStep(step, user, entityDetails)) {
        throw AppError.forbidden("You are not authorized to reject this step");
      }

      // 1. Mark this step as REJECTED
      const updatedStep = await approvalRepository.updateStep(
        stepId,
        {
          status: ApprovalStatus.REJECTED,
          approverId: user.id,
          decidedAt: new Date(),
          comment: comment.trim(),
        },
        tx
      );

      // 2. Any subsequent steps wait/skip
      const laterSteps = siblingSteps.filter((s: any) => s.stepOrder > step.stepOrder);
      if (laterSteps.length > 0) {
        await tx.approvalStep.updateMany({
          where: {
            ...(step.requestId
              ? { requestId: step.requestId }
              : { entityType, entityId }),
            stepOrder: { gt: step.stepOrder },
          },
          data: {
            status: ApprovalStatus.SKIPPED,
          },
        });
      }

      const itemTitle =
        step.request?.title || entityDetails?.title || `Approval #${step.id.slice(0, 8)}`;

      await auditService.log({
        actorId: user.id,
        action: "APPROVAL_STEP_REJECTED",
        entityType: "ApprovalStep",
        entityId: stepId,
        summary: `Rejected step ${step.stepOrder} for ${handler.getEntityTypeName().toLowerCase()} "${itemTitle}"`,
        metadata: {
          stepOrder: step.stepOrder,
          entityType,
          entityId,
          requestId: step.requestId,
          comment: comment.trim(),
        },
      });

      // 3. Delegate rejection execution to entity handler
      await handler.onRejected({
        step: {
          id: step.id,
          entityType,
          entityId,
          requestId: step.requestId,
          stepOrder: step.stepOrder,
          approverRole: step.approverRole,
          approverId: step.approverId,
          request: step.request,
        },
        user,
        comment: comment.trim(),
        tx,
      });

      return updatedStep;
    });
  }

  /**
   * Admin can reassign/delegate an approver.
   */
  async reassignStep(
    stepId: string,
    user: AuthenticatedUser,
    newApproverId: string
  ) {
    if (user.role !== Role.ADMIN) {
      throw AppError.forbidden("Only admins can reassign or delegate approval steps");
    }

    const step = await approvalRepository.findStepById(stepId);
    if (!step) {
      throw AppError.notFound("Approval step not found");
    }

    if (step.status !== ApprovalStatus.PENDING) {
      throw AppError.conflict("Cannot reassign an approval step that has already been decided");
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: newApproverId },
    });

    if (!targetUser || !targetUser.isActive) {
      throw AppError.badRequest("Target approver user does not exist or is inactive");
    }

    const updated = await approvalRepository.updateStep(stepId, {
      approverId: newApproverId,
    });

    const entityType = step.entityType || "REQUEST";
    const entityId = step.entityId || step.requestId || "";
    const handler = approvalHandlerRegistry.get(entityType);
    const itemTitle =
      step.request?.title ||
      (entityId ? (await handler.getEntityDetails(entityId))?.title : null) ||
      `Item #${entityId.slice(0, 8)}`;

    await auditService.log({
      actorId: user.id,
      action: "APPROVAL_STEP_REASSIGNED",
      entityType: "ApprovalStep",
      entityId: stepId,
      metadata: {
        entityType,
        entityId,
        previousApproverId: step.approverId,
        newApproverId,
      },
    });

    await notificationService.notify({
      userId: newApproverId,
      type: "APPROVAL_REQUESTED",
      title: "Approval Assigned",
      message: `You have been delegated to approve "${itemTitle}"`,
      link: handler.getLink(entityId),
      entityType: handler.getEntityTypeName(),
      entityId,
    });

    return updated;
  }

  /**
   * Bulk approves multiple approval steps.
   * Checks authorization and validity per item, executing approved steps
   * and returning detailed success/failure per item.
   */
  async bulkApproveSteps(
    stepIds: string[],
    user: AuthenticatedUser,
    comment?: string
  ) {
    if (user.role !== Role.MANAGER && user.role !== Role.ADMIN) {
      throw AppError.forbidden("Only managers and admins can approve requests");
    }

    const results: Array<{
      stepId: string;
      success: boolean;
      step?: any;
      error?: string;
    }> = [];

    for (const stepId of stepIds) {
      try {
        const approvedStep = await this.approveStep(stepId, user, comment);
        results.push({
          stepId,
          success: true,
          step: approvedStep,
        });
      } catch (err: any) {
        results.push({
          stepId,
          success: false,
          error: err?.message || "Failed to approve step",
        });
      }
    }

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return {
      results,
      summary: {
        total: stepIds.length,
        succeeded,
        failed,
      },
    };
  }
}

export const approvalService = new ApprovalService();
