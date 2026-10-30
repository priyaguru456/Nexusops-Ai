import { prisma } from "../../lib/prisma";
import {
  Role,
  ApprovalStatus,
  RequestStatus,
  TaskStatus,
  Prisma,
  type WorkRequest,
} from "@prisma/client";
import { approvalRepository } from "./approval.repository";
import { auditService } from "../audit/audit.service";
import { notificationService } from "../notifications/notification.service";
import { AppError } from "../../lib/errors";
import type { AuthenticatedUser } from "../../types/express";

export class ApprovalService {
  /**
   * On submit, loads the approval flow for the request's category and amount,
   * then creates approval steps rows in order.
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
    const amountVal = request.amount ? Number(request.amount) : null;
    const flow = await approvalRepository.findApprovalFlow(request.category, amountVal);

    let stepsToCreate: Array<{ stepOrder: number; approverRole: Role }> = [];

    if (flow && flow.steps.length > 0) {
      stepsToCreate = flow.steps.map((s) => ({
        stepOrder: s.stepOrder,
        approverRole: s.approverRole,
      }));
    } else {
      // Default single-step manager approval if no flow is registered
      stepsToCreate = [{ stepOrder: 1, approverRole: Role.MANAGER }];
    }

    await approvalRepository.createApprovalSteps(requestId, stepsToCreate, tx);

    // Notify managers / first approvers
    const client = tx || prisma;
    const requester = await client.user.findUnique({
      where: { id: request.requesterId },
      select: { departmentId: true, managerId: true },
    });

    const eligibleApprovers = await client.user.findMany({
      where: {
        role: stepsToCreate[0].approverRole,
        isActive: true,
        ...(requester?.departmentId ? { departmentId: requester.departmentId } : {}),
      },
      select: { id: true },
    });

    const approverIds = eligibleApprovers
      .map((u) => u.id)
      .filter((id) => id !== request.requesterId);

    if (approverIds.length > 0) {
      await notificationService.notifyMultiple(
        approverIds,
        "APPROVAL_REQUESTED",
        `Approval requested for "${request.title}"`,
        `/requests/${requestId}`
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
      request: {
        requesterId: string;
        requester: { departmentId: string | null; managerId: string | null };
      };
    },
    user: AuthenticatedUser
  ): boolean {
    // Requesters can never approve or decide on their own requests
    if (step.request.requesterId === user.id) {
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
      // Manager department matching: same department or direct manager
      const isDirectManager = step.request.requester.managerId === user.id;
      const isSameDept = Boolean(
        user.departmentId &&
          step.request.requester.departmentId === user.departmentId
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

    // Filter to only steps that are currently active (all previous steps are approved)
    const activeAndEligible = candidates.filter((step) => {
      // 1. Check self-approval block
      if (step.request.requesterId === user.id) return false;

      // 2. Check out-of-order: all steps with stepOrder < current must be APPROVED
      const siblingSteps = step.request.approvalSteps || [];
      const precedingSteps = siblingSteps.filter((s) => s.stepOrder < step.stepOrder);
      const allPrecedingApproved = precedingSteps.every(
        (s) => s.status === ApprovalStatus.APPROVED
      );
      if (!allPrecedingApproved) return false;

      // 3. Check role / assignee eligibility
      return this.isUserEligibleForStep(step, user);
    });

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

      // Rule: Requester cannot approve their own request
      if (step.request.requesterId === user.id) {
        throw AppError.forbidden("Requesters cannot approve their own requests");
      }

      // Rule: Steps run in order. Preceding steps must be APPROVED
      const siblingSteps = step.request.approvalSteps || [];
      const precedingSteps = siblingSteps.filter((s) => s.stepOrder < step.stepOrder);
      const isPrecedingComplete = precedingSteps.every(
        (s) => s.status === ApprovalStatus.APPROVED
      );

      if (!isPrecedingComplete) {
        throw AppError.badRequest(
          "Cannot approve out-of-order step. Preceding approval steps must be approved first."
        );
      }

      // Permission check
      if (!this.isUserEligibleForStep(step, user)) {
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

      await auditService.log({
        actorId: user.id,
        action: "APPROVAL_STEP_APPROVED",
        entityType: "ApprovalStep",
        entityId: stepId,
        metadata: {
          stepOrder: step.stepOrder,
          requestId: step.requestId,
          comment: comment ?? null,
        },
      });

      // 2. Check if there are subsequent steps
      const nextStep = siblingSteps.find((s) => s.stepOrder === step.stepOrder + 1);

      if (nextStep) {
        // Next step is now active. Move request to IN_REVIEW if not already.
        if (step.request.status !== RequestStatus.IN_REVIEW) {
          await tx.workRequest.update({
            where: { id: step.requestId },
            data: { status: RequestStatus.IN_REVIEW },
          });
        }

        // Notify next approvers
        const eligibleNext = await tx.user.findMany({
          where: {
            role: nextStep.approverRole,
            isActive: true,
            ...(step.request.requester.departmentId
              ? { departmentId: step.request.requester.departmentId }
              : {}),
          },
          select: { id: true },
        });

        const nextApproverIds = eligibleNext
          .map((u) => u.id)
          .filter((id) => id !== step.request.requesterId);

        await notificationService.notifyMultiple(
          nextApproverIds,
          "APPROVAL_REQUESTED",
          `Step ${nextStep.stepOrder} approval needed for "${step.request.title}"`,
          `/requests/${step.requestId}`
        );

        // Notify requester of progress
        await notificationService.notify({
          userId: step.request.requesterId,
          type: "APPROVAL_DECISION",
          message: `Step ${step.stepOrder} of your request "${step.request.title}" was approved by ${user.name}`,
          link: `/requests/${step.requestId}`,
        });
      } else {
        // Final approval step!
        // Final approval sets request to APPROVED and AUTO-CREATES a task.
        await tx.workRequest.update({
          where: { id: step.requestId },
          data: { status: RequestStatus.APPROVED },
        });

        const createdTask = await tx.task.create({
          data: {
            title: `Fulfill Request: ${step.request.title}`,
            description: `Auto-generated task from approved request #${step.request.id.slice(0, 8)}.\n\n${step.request.description}`,
            priority: step.request.priority,
            status: TaskStatus.TODO,
            dueDate: step.request.dueDate,
            requestId: step.request.id,
            assignedById: user.id,
            assigneeId: null,
          },
        });

        await auditService.log({
          actorId: user.id,
          action: "REQUEST_APPROVED",
          entityType: "WorkRequest",
          entityId: step.requestId,
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
          metadata: {
            autoCreated: true,
            requestId: step.requestId,
          },
        });

        // Notify requester of approval and task creation
        await notificationService.notify({
          userId: step.request.requesterId,
          type: "APPROVAL_DECISION",
          message: `Your request "${step.request.title}" has been approved! A fulfillment task has been created.`,
          link: `/requests/${step.requestId}`,
        });
      }

      return updatedStep;
    });
  }

  /**
   * POST /api/approvals/:stepId/reject
   * Comment REQUIRED on reject. Rejection ends flow and marks request Rejected.
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

      // Requesters cannot reject their own request (they should cancel instead)
      if (step.request.requesterId === user.id) {
        throw AppError.forbidden("Requesters cannot decide on their own requests");
      }

      // Check preceding steps
      const siblingSteps = step.request.approvalSteps || [];
      const precedingSteps = siblingSteps.filter((s) => s.stepOrder < step.stepOrder);
      const isPrecedingComplete = precedingSteps.every(
        (s) => s.status === ApprovalStatus.APPROVED
      );

      if (!isPrecedingComplete) {
        throw AppError.badRequest(
          "Cannot reject out-of-order step. Preceding approval steps must be approved first."
        );
      }

      if (!this.isUserEligibleForStep(step, user)) {
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
      const laterSteps = siblingSteps.filter((s) => s.stepOrder > step.stepOrder);
      if (laterSteps.length > 0) {
        await tx.approvalStep.updateMany({
          where: {
            requestId: step.requestId,
            stepOrder: { gt: step.stepOrder },
          },
          data: {
            status: ApprovalStatus.SKIPPED,
          },
        });
      }

      // 3. Mark request as REJECTED
      await tx.workRequest.update({
        where: { id: step.requestId },
        data: { status: RequestStatus.REJECTED },
      });

      await auditService.log({
        actorId: user.id,
        action: "APPROVAL_STEP_REJECTED",
        entityType: "ApprovalStep",
        entityId: stepId,
        metadata: {
          stepOrder: step.stepOrder,
          requestId: step.requestId,
          comment: comment.trim(),
        },
      });

      await auditService.log({
        actorId: user.id,
        action: "REQUEST_REJECTED",
        entityType: "WorkRequest",
        entityId: step.requestId,
        metadata: {
          rejectedAtStep: step.stepOrder,
          reason: comment.trim(),
        },
      });

      // Notify requester
      await notificationService.notify({
        userId: step.request.requesterId,
        type: "APPROVAL_DECISION",
        message: `Your request "${step.request.title}" was rejected by ${user.name}: "${comment.trim()}"`,
        link: `/requests/${step.requestId}`,
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

    await auditService.log({
      actorId: user.id,
      action: "APPROVAL_STEP_REASSIGNED",
      entityType: "ApprovalStep",
      entityId: stepId,
      metadata: {
        previousApproverId: step.approverId,
        newApproverId,
      },
    });

    await notificationService.notify({
      userId: newApproverId,
      type: "APPROVAL_REQUESTED",
      message: `You have been delegated to approve "${step.request.title}"`,
      link: `/requests/${step.requestId}`,
    });

    return updated;
  }
}

export const approvalService = new ApprovalService();
