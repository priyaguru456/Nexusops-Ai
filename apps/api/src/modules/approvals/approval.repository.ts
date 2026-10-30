import { prisma } from "../../lib/prisma";
import { Prisma, RequestCategory, Role, ApprovalStatus, RequestStatus } from "@prisma/client";

export class ApprovalRepository {
  async findApprovalFlow(category: RequestCategory, amount?: number | null) {
    const flows = await prisma.approvalFlow.findMany({
      where: { category },
      include: {
        steps: {
          orderBy: { stepOrder: "asc" },
        },
      },
    });

    if (flows.length === 0) return null;

    if (amount !== undefined && amount !== null) {
      // Find matching threshold flow
      const amountFlows = flows
        .filter((f) => f.minAmount !== null && Number(f.minAmount) <= amount)
        .sort((a, b) => Number(b.minAmount) - Number(a.minAmount));

      if (amountFlows.length > 0) {
        return amountFlows[0];
      }
    }

    // Default flow with no minAmount
    const defaultFlow = flows.find((f) => f.minAmount === null);
    return defaultFlow || flows[0];
  }

  async createApprovalSteps(
    requestId: string,
    steps: Array<{ stepOrder: number; approverRole: Role }>,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    const records = steps.map((s) => ({
      requestId,
      stepOrder: s.stepOrder,
      approverRole: s.approverRole,
      status: ApprovalStatus.PENDING,
    }));

    return client.approvalStep.createMany({
      data: records,
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
        request: {
          status: {
            in: [RequestStatus.SUBMITTED, RequestStatus.IN_REVIEW],
          },
        },
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
