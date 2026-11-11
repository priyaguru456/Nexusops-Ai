import { prisma } from "../../lib/prisma";
import { Role, ApprovalStatus } from "@prisma/client";
import { env } from "../../config/env";
import { logger } from "../../lib/logger";
import { notificationService } from "../notifications/notification.service";
import { auditService } from "../audit/audit.service";
import { approvalHandlerRegistry } from "./handlers/approval-handler.registry";

export interface EscalationResult {
  checkedCount: number;
  escalatedCount: number;
  escalatedStepIds: string[];
}

export class ApprovalEscalationService {
  /**
   * Scans for active pending approval steps that have been pending longer than
   * ESCALATION_AFTER_HOURS and have not yet been escalated.
   *
   * Escalation action ("Next Level"):
   * 1. Sets escalatedAt timestamp in an atomic transaction (idempotent).
   * 2. Notifies all active ADMIN users ("Next level escalation").
   * 3. Sends a reminder notification to the eligible/assigned approver(s).
   * 4. Writes an APPROVAL_STEP_ESCALATED audit log entry.
   *
   * Note: Escalation NEVER auto-approves or alters the entity's status.
   */
  async checkAndEscalateOverdueApprovals(
    thresholdHours: number = env.ESCALATION_AFTER_HOURS
  ): Promise<EscalationResult> {
    const thresholdDate = new Date(Date.now() - thresholdHours * 60 * 60 * 1000);

    // Find candidate pending steps whose activatedAt is older than threshold
    // and have not yet been escalated.
    const overdueCandidates = await prisma.approvalStep.findMany({
      where: {
        status: ApprovalStatus.PENDING,
        escalatedAt: null,
        activatedAt: {
          not: null,
          lte: thresholdDate,
        },
      },
      include: {
        request: {
          include: {
            requester: {
              select: {
                id: true,
                name: true,
                departmentId: true,
              },
            },
            approvalSteps: {
              select: {
                id: true,
                stepOrder: true,
                status: true,
              },
            },
          },
        },
        approver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        activatedAt: "asc",
      },
    });

    const escalatedStepIds: string[] = [];

    for (const step of overdueCandidates) {
      const entityType = step.entityType || "REQUEST";
      const entityId = step.entityId || step.requestId || "";

      // Safety check: ensure all earlier steps are APPROVED
      let siblingSteps = step.request?.approvalSteps;
      if (!siblingSteps || siblingSteps.length === 0) {
        siblingSteps = await prisma.approvalStep.findMany({
          where: {
            entityType,
            entityId,
          },
          select: {
            id: true,
            stepOrder: true,
            status: true,
          },
          orderBy: { stepOrder: "asc" },
        });
      }

      const precedingSteps = siblingSteps.filter((s) => s.stepOrder < step.stepOrder);
      const isActuallyActive = precedingSteps.every(
        (s) => s.status === ApprovalStatus.APPROVED
      );

      // If an earlier step is not approved, this step is not active yet; skip
      if (!isActuallyActive) {
        continue;
      }

      const wasEscalated = await this.escalateSingleStep(step, thresholdHours);
      if (wasEscalated) {
        escalatedStepIds.push(step.id);
      }
    }

    logger.info(
      {
        thresholdHours,
        checkedCount: overdueCandidates.length,
        escalatedCount: escalatedStepIds.length,
      },
      "Overdue approval escalation check completed"
    );

    return {
      checkedCount: overdueCandidates.length,
      escalatedCount: escalatedStepIds.length,
      escalatedStepIds,
    };
  }

  /**
   * Escalates an individual step idempotently inside a database transaction.
   */
  private async escalateSingleStep(
    step: any,
    thresholdHours: number
  ): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      // 1. Atomic update with conditional where (idempotence guard)
      // If another worker or retry has already set escalatedAt, updateMany returns count 0
      const updateResult = await tx.approvalStep.updateMany({
        where: {
          id: step.id,
          escalatedAt: null,
          status: ApprovalStatus.PENDING,
        },
        data: {
          escalatedAt: new Date(),
        },
      });

      if (updateResult.count === 0) {
        // Already escalated by another thread or process; do not send duplicate notifications
        return false;
      }

      const entityType = step.entityType || "REQUEST";
      const entityId = step.entityId || step.requestId || "";
      const handler = approvalHandlerRegistry.get(entityType);
      const entityDetails = await handler.getEntityDetails(entityId, tx);

      const itemTitle =
        entityDetails?.title || step.request?.title || `Approval #${step.id.slice(0, 8)}`;
      const link = entityDetails?.link || handler.getLink(entityId);
      const entityTypeName = handler.getEntityTypeName();
      const requesterId = entityDetails?.requesterId ?? step.request?.requesterId ?? "";
      const departmentId =
        entityDetails?.requester?.departmentId ?? step.request?.requester?.departmentId ?? null;

      // 2. Identify active admins for next-level escalation within the step's organization
      const activeAdmins = await tx.user.findMany({
        where: {
          role: Role.ADMIN,
          isActive: true,
          ...(step.organizationId ? { organizationId: step.organizationId } : {}),
        },
        select: { id: true },
      });

      const adminUserIds = activeAdmins
        .map((a) => a.id)
        .filter((id) => id !== requesterId);

      // 3. Identify current approvers for reminder within the step's organization
      let approverUserIds: string[] = [];
      if (step.approverId) {
        approverUserIds = [step.approverId];
      } else {
        const eligibleApprovers = await tx.user.findMany({
          where: {
            role: step.approverRole,
            isActive: true,
            ...(step.organizationId ? { organizationId: step.organizationId } : {}),
            ...(departmentId ? { departmentId } : {}),
          },
          select: { id: true },
        });

        approverUserIds = eligibleApprovers
          .map((u) => u.id)
          .filter((id) => id !== requesterId);
      }

      // 4. Send Next-Level Escalation notification to Admins
      if (adminUserIds.length > 0) {
        await notificationService.notifyMultiple(
          adminUserIds,
          "APPROVAL_ESCALATED",
          "Approval Overdue Escalation",
          `ESCALATION: Step ${step.stepOrder} for ${entityTypeName === "WorkRequest" ? "request" : entityTypeName.toLowerCase()} "${itemTitle}" is overdue (pending > ${thresholdHours}h). Admin attention required.`,
          link,
          entityTypeName,
          entityId
        );
      }

      // 5. Send reminder notification to assigned/eligible approvers (excluding admins who already got escalation)
      const reminderTargetIds = approverUserIds.filter(
        (id) => !adminUserIds.includes(id)
      );

      if (reminderTargetIds.length > 0) {
        await notificationService.notifyMultiple(
          reminderTargetIds,
          "APPROVAL_REMINDER",
          "Approval Reminder",
          `REMINDER: Step ${step.stepOrder} for ${entityTypeName === "WorkRequest" ? "request" : entityTypeName.toLowerCase()} "${itemTitle}" has been pending for over ${thresholdHours} hours and requires your decision.`,
          link,
          entityTypeName,
          entityId
        );
      }

      // 6. Record audit log entry
      await auditService.log({
        actorId: "SYSTEM",
        action: "APPROVAL_STEP_ESCALATED",
        entityType: "ApprovalStep",
        entityId: step.id,
        metadata: {
          entityType,
          entityId,
          requestId: step.requestId,
          stepOrder: step.stepOrder,
          thresholdHours,
          activatedAt: step.activatedAt,
          escalatedAt: new Date(),
          notifiedAdminCount: adminUserIds.length,
          notifiedApproverCount: reminderTargetIds.length,
        },
      });

      logger.warn(
        {
          stepId: step.id,
          entityType,
          entityId,
          requestId: step.requestId,
          stepOrder: step.stepOrder,
          thresholdHours,
        },
        "Approval step escalated to next level"
      );

      return true;
    });
  }
}

export const approvalEscalationService = new ApprovalEscalationService();
