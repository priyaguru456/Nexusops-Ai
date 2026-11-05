import { prisma } from "../../lib/prisma";
import { Prisma, RequestCategory, Role, ApprovalStatus, RequestStatus } from "@prisma/client";

export class ApprovalRepository {
  /**
   * Finds the active approval flow matching a request's category and amount range.
   * If amount is null, looks for an active flow covering 0 (minAmount = 0).
   * Returns null if no active flow matches (indicating fallback).
   */
  async findMatchingFlow(
    category: RequestCategory,
    amount?: number | null,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    const flows = await client.approvalFlow.findMany({
      where: {
        category,
        isActive: true,
      },
      include: {
        steps: {
          include: {
            approver: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
              },
            },
          },
          orderBy: { stepOrder: "asc" },
        },
      },
    });

    if (flows.length === 0) return null;

    const amountVal = amount !== undefined && amount !== null ? Number(amount) : null;

    const matching = flows.filter((f) => {
      const min = Number(f.minAmount);
      const max = f.maxAmount !== null && f.maxAmount !== undefined ? Number(f.maxAmount) : null;

      if (amountVal !== null) {
        if (amountVal < min) return false;
        if (max !== null && amountVal > max) return false;
        return true;
      } else {
        // Request with no amount matches flow starting at 0 that covers 0
        return min === 0;
      }
    });

    if (matching.length === 0) return null;

    // Pick most specific flow (highest minAmount) if multiple match
    matching.sort((a, b) => Number(b.minAmount) - Number(a.minAmount));
    return matching[0];
  }

  /**
   * Backward-compatible alias for existing callers.
   */
  async findApprovalFlow(category: RequestCategory, amount?: number | null) {
    return this.findMatchingFlow(category, amount);
  }

  async listFlows(
    filters?: { category?: RequestCategory; isActive?: boolean },
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    return client.approvalFlow.findMany({
      where: {
        ...(filters?.category ? { category: filters.category } : {}),
        ...(filters?.isActive !== undefined ? { isActive: filters.isActive } : {}),
      },
      include: {
        steps: {
          include: {
            approver: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
              },
            },
          },
          orderBy: { stepOrder: "asc" },
        },
        _count: {
          select: { requests: true },
        },
      },
      orderBy: [
        { category: "asc" },
        { minAmount: "asc" },
        { createdAt: "desc" },
      ],
    });
  }

  async findFlowById(id: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.approvalFlow.findUnique({
      where: { id },
      include: {
        steps: {
          include: {
            approver: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
              },
            },
          },
          orderBy: { stepOrder: "asc" },
        },
        _count: {
          select: { requests: true },
        },
      },
    });
  }

  async countRequestsUsingFlow(flowId: string, tx?: Prisma.TransactionClient): Promise<number> {
    const client = tx || prisma;
    return client.workRequest.count({
      where: { flowId },
    });
  }

  async findActiveFlowsByCategory(
    category: RequestCategory,
    excludeFlowId?: string,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    return client.approvalFlow.findMany({
      where: {
        category,
        isActive: true,
        ...(excludeFlowId ? { id: { not: excludeFlowId } } : {}),
      },
      select: {
        id: true,
        name: true,
        category: true,
        minAmount: true,
        maxAmount: true,
      },
    });
  }

  async createFlow(
    data: {
      name: string;
      category: RequestCategory;
      minAmount: number;
      maxAmount?: number | null;
      isActive?: boolean;
      steps: Array<{
        stepOrder: number;
        approverRole?: Role | null;
        approverId?: string | null;
      }>;
    },
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    return client.approvalFlow.create({
      data: {
        name: data.name,
        category: data.category,
        minAmount: new Prisma.Decimal(data.minAmount),
        maxAmount:
          data.maxAmount !== null && data.maxAmount !== undefined
            ? new Prisma.Decimal(data.maxAmount)
            : null,
        isActive: data.isActive ?? true,
        steps: {
          create: data.steps.map((s) => ({
            stepOrder: s.stepOrder,
            approverRole: s.approverRole ?? null,
            approverId: s.approverId ?? null,
          })),
        },
      },
      include: {
        steps: {
          include: {
            approver: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
          orderBy: { stepOrder: "asc" },
        },
        _count: {
          select: { requests: true },
        },
      },
    });
  }

  async updateFlow(
    id: string,
    data: {
      name?: string;
      category?: RequestCategory;
      minAmount?: number;
      maxAmount?: number | null;
      isActive?: boolean;
      steps?: Array<{
        stepOrder: number;
        approverRole?: Role | null;
        approverId?: string | null;
      }>;
    },
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;

    const executeUpdate = async (innerTx: Prisma.TransactionClient) => {
      if (data.steps) {
        await innerTx.approvalFlowStep.deleteMany({
          where: { flowId: id },
        });
      }

      return innerTx.approvalFlow.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.category !== undefined ? { category: data.category } : {}),
          ...(data.minAmount !== undefined
            ? { minAmount: new Prisma.Decimal(data.minAmount) }
            : {}),
          ...(data.maxAmount !== undefined
            ? {
                maxAmount:
                  data.maxAmount !== null
                    ? new Prisma.Decimal(data.maxAmount)
                    : null,
              }
            : {}),
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
          ...(data.steps
            ? {
                steps: {
                  create: data.steps.map((s) => ({
                    stepOrder: s.stepOrder,
                    approverRole: s.approverRole ?? null,
                    approverId: s.approverId ?? null,
                  })),
                },
              }
            : {}),
        },
        include: {
          steps: {
            include: {
              approver: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                },
              },
            },
            orderBy: { stepOrder: "asc" },
          },
          _count: {
            select: { requests: true },
          },
        },
      });
    };

    if (tx) {
      return executeUpdate(tx);
    }
    return prisma.$transaction(async (innerTx) => executeUpdate(innerTx));
  }

  async deleteFlow(id: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.approvalFlow.delete({
      where: { id },
    });
  }

  async createApprovalSteps(
    paramsOrRequestId:
      | string
      | {
          entityType?: string;
          entityId: string;
          requestId?: string | null;
          steps: Array<{ stepOrder: number; approverRole: Role; approverId?: string | null }>;
        },
    stepsParam?: Array<{ stepOrder: number; approverRole: Role; approverId?: string | null }>,
    tx?: Prisma.TransactionClient
  ) {
    let entityType = "REQUEST";
    let entityId: string;
    let requestId: string | null = null;
    let steps: Array<{ stepOrder: number; approverRole: Role; approverId?: string | null }>;
    let client: Prisma.TransactionClient;

    if (typeof paramsOrRequestId === "string") {
      entityId = paramsOrRequestId;
      requestId = paramsOrRequestId;
      entityType = "REQUEST";
      steps = stepsParam || [];
      client = tx || prisma;
    } else {
      entityType = paramsOrRequestId.entityType || "REQUEST";
      entityId = paramsOrRequestId.entityId;
      requestId =
        paramsOrRequestId.requestId !== undefined
          ? paramsOrRequestId.requestId
          : entityType === "REQUEST"
          ? entityId
          : null;
      steps = paramsOrRequestId.steps;
      client = (stepsParam as unknown as Prisma.TransactionClient) || tx || prisma;
    }

    const records = steps.map((s) => ({
      entityType,
      entityId,
      requestId,
      stepOrder: s.stepOrder,
      approverRole: s.approverRole,
      approverId: s.approverId ?? null,
      status: ApprovalStatus.PENDING,
      activatedAt: s.stepOrder === 1 ? new Date() : null,
    }));

    return client.approvalStep.createMany({
      data: records,
    });
  }

  async findSiblingSteps(
    entityType: string,
    entityId: string,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    return client.approvalStep.findMany({
      where: {
        entityType,
        entityId,
      },
      orderBy: { stepOrder: "asc" },
    });
  }

  async findStepById(stepId: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.approvalStep.findUnique({
      where: { id: stepId },
      include: {
        request: {
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
        },
        approver: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });
  }

  async findActivePendingCandidateSteps(tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.approvalStep.findMany({
      where: {
        status: ApprovalStatus.PENDING,
        OR: [
          {
            entityType: "REQUEST",
            request: {
              status: {
                in: [RequestStatus.SUBMITTED, RequestStatus.IN_REVIEW],
              },
            },
          },
          {
            entityType: { not: "REQUEST" },
          },
        ],
      },
      include: {
        request: {
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
        },
        approver: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async updateStep(
    stepId: string,
    data: Prisma.ApprovalStepUncheckedUpdateInput,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    return client.approvalStep.update({
      where: { id: stepId },
      data,
      include: {
        request: true,
        approver: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });
  }
}

export const approvalRepository = new ApprovalRepository();
