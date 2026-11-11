import { RequestCategory, Role, Prisma } from "@prisma/client";
import { approvalRepository } from "./approval.repository";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { assertSameTenant, resolveTenantId, tenantWhere } from "../../lib/tenant";
import { auditService } from "../audit/audit.service";
import type { AuthenticatedUser } from "../../types/express";
import type {
  CreateApprovalFlowInput,
  UpdateApprovalFlowInput,
  FlowQueryParams,
  ApprovalFlowStepInput,
} from "./approval-flow.schema";

export function checkIntervalOverlap(
  rangeA: { minAmount: number; maxAmount?: number | null },
  rangeB: { minAmount: number; maxAmount?: number | null }
): boolean {
  const minA = rangeA.minAmount;
  const maxA = rangeA.maxAmount !== null && rangeA.maxAmount !== undefined ? rangeA.maxAmount : Infinity;
  const minB = rangeB.minAmount;
  const maxB = rangeB.maxAmount !== null && rangeB.maxAmount !== undefined ? rangeB.maxAmount : Infinity;

  const overlapStart = Math.max(minA, minB);
  const overlapEnd = Math.min(maxA, maxB);

  return overlapStart <= overlapEnd;
}

export class ApprovalFlowService {
  /**
   * Validates that an amount range does not overlap with any active flows in the same category.
   */
  async assertNoRangeOverlap(
    category: RequestCategory,
    minAmount: number,
    maxAmount: number | null | undefined,
    excludeFlowId?: string,
    tx?: Prisma.TransactionClient,
    organizationId?: string
  ): Promise<void> {
    const existingActiveFlows = await approvalRepository.findActiveFlowsByCategory(
      category,
      excludeFlowId,
      tx,
      organizationId
    );

    for (const flow of existingActiveFlows) {
      const otherMin = Number(flow.minAmount);
      const otherMax = flow.maxAmount !== null && flow.maxAmount !== undefined ? Number(flow.maxAmount) : null;

      if (
        checkIntervalOverlap(
          { minAmount, maxAmount },
          { minAmount: otherMin, maxAmount: otherMax }
        )
      ) {
        throw AppError.badRequest(
          `Amount range [${minAmount}, ${maxAmount ?? "unlimited"}] overlaps with existing active flow "${flow.name}" [${otherMin}, ${otherMax ?? "unlimited"}] for category ${category}`
        );
      }
    }
  }

  /**
   * Validates flow steps:
   * - At least 1 step
   * - Unique stepOrder
   * - Each step must have approverRole or approverId
   * - If approverId is given, target user must exist and be active
   */
  async validateSteps(
    steps: ApprovalFlowStepInput[],
    tx?: Prisma.TransactionClient,
    organizationId?: string
  ): Promise<void> {
    if (!steps || steps.length === 0) {
      throw AppError.badRequest("An approval flow must have at least one step");
    }

    const stepOrders = steps.map((s) => s.stepOrder);
    if (new Set(stepOrders).size !== steps.length) {
      throw AppError.badRequest("Approval flow steps cannot have duplicate step orders");
    }

    const client = tx || prisma;

    for (const step of steps) {
      if (!step.approverRole && !step.approverId) {
        throw AppError.badRequest(
          `Step ${step.stepOrder} must specify an approver role or a specific approver ID`
        );
      }

      if (step.approverId) {
        const user = await client.user.findUnique({
          where: { id: step.approverId },
          select: { id: true, isActive: true, role: true, organizationId: true },
        });

        if (!user || (organizationId && user.organizationId !== organizationId)) {
          throw AppError.badRequest(
            `Approver user with ID "${step.approverId}" not found for step ${step.stepOrder}`
          );
        }

        if (!user.isActive) {
          throw AppError.badRequest(
            `Approver user with ID "${step.approverId}" is deactivated and cannot be assigned`
          );
        }
      }
    }
  }

  async getFlows(filters: FlowQueryParams, user?: AuthenticatedUser) {
    return approvalRepository.listFlows({
      ...filters,
      ...(user ? tenantWhere(user) : {}),
    });
  }

  async getFlowById(id: string, user?: AuthenticatedUser) {
    const flow = await approvalRepository.findFlowById(id);
    if (!flow) {
      throw AppError.notFound(`Approval flow not found with ID ${id}`);
    }
    if (user) {
      assertSameTenant(flow.organizationId, user, `Approval flow not found with ID ${id}`);
    }
    return flow;
  }

  async createFlow(data: CreateApprovalFlowInput, user: AuthenticatedUser) {
    const organizationId = resolveTenantId(user);
    await this.validateSteps(data.steps, undefined, organizationId);

    const isActive = data.isActive ?? true;
    if (isActive) {
      await this.assertNoRangeOverlap(
        data.category,
        data.minAmount,
        data.maxAmount,
        undefined,
        undefined,
        organizationId
      );
    }

    const created = await approvalRepository.createFlow({
      name: data.name,
      category: data.category,
      minAmount: data.minAmount,
      maxAmount: data.maxAmount,
      isActive,
      organizationId,
      steps: data.steps,
    });

    await auditService.log({
      actorId: user.id,
      organizationId,
      action: "APPROVAL_FLOW_CREATED",
      entityType: "ApprovalFlow",
      entityId: created.id,
      metadata: {
        name: created.name,
        category: created.category,
        minAmount: created.minAmount,
        maxAmount: created.maxAmount,
        isActive: created.isActive,
        stepCount: created.steps.length,
      },
    });

    return created;
  }

  async updateFlow(
    id: string,
    data: UpdateApprovalFlowInput,
    user: AuthenticatedUser
  ) {
    const existing = await approvalRepository.findFlowById(id);
    if (!existing) {
      throw AppError.notFound(`Approval flow not found with ID ${id}`);
    }
    assertSameTenant(existing.organizationId, user, `Approval flow not found with ID ${id}`);

    if (data.steps) {
      await this.validateSteps(data.steps, undefined, existing.organizationId);
    }

    const targetCategory = data.category ?? existing.category;
    const targetMin = data.minAmount !== undefined ? data.minAmount : Number(existing.minAmount);
    const targetMax =
      data.maxAmount !== undefined
        ? data.maxAmount
        : existing.maxAmount !== null
        ? Number(existing.maxAmount)
        : null;
    const targetIsActive = data.isActive !== undefined ? data.isActive : existing.isActive;

    if (targetMax !== null && targetMax < targetMin) {
      throw AppError.badRequest("maxAmount must be greater than or equal to minAmount");
    }

    if (targetIsActive) {
      await this.assertNoRangeOverlap(
        targetCategory,
        targetMin,
        targetMax,
        id,
        undefined,
        existing.organizationId
      );
    }

    const updated = await approvalRepository.updateFlow(id, {
      name: data.name,
      category: data.category,
      minAmount: data.minAmount,
      maxAmount: data.maxAmount,
      isActive: data.isActive,
      steps: data.steps,
    });

    await auditService.log({
      actorId: user.id,
      organizationId: existing.organizationId,
      action: "APPROVAL_FLOW_UPDATED",
      entityType: "ApprovalFlow",
      entityId: id,
      metadata: {
        updatedFields: Object.keys(data),
      },
    });

    return updated;
  }

  async deleteFlow(id: string, user: AuthenticatedUser) {
    const existing = await approvalRepository.findFlowById(id);
    if (!existing) {
      throw AppError.notFound(`Approval flow not found with ID ${id}`);
    }
    assertSameTenant(existing.organizationId, user, `Approval flow not found with ID ${id}`);

    const inUseCount = await approvalRepository.countRequestsUsingFlow(id);
    if (inUseCount > 0) {
      throw AppError.conflict(
        `Approval flow "${existing.name}" is in use by ${inUseCount} request(s) and cannot be deleted. Deactivate it instead.`
      );
    }

    await approvalRepository.deleteFlow(id);

    await auditService.log({
      actorId: user.id,
      organizationId: existing.organizationId,
      action: "APPROVAL_FLOW_DELETED",
      entityType: "ApprovalFlow",
      entityId: id,
      metadata: {
        name: existing.name,
        category: existing.category,
      },
    });

    return {
      success: true,
      message: `Approval flow "${existing.name}" deleted successfully`,
    };
  }
}

export const approvalFlowService = new ApprovalFlowService();
