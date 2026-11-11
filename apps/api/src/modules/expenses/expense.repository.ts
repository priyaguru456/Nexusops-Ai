import {
  type Prisma,
  ExpenseStatus,
  ExpenseCategory,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { DEFAULT_ORGANIZATION_ID } from "../../lib/tenant";

export interface CreateClaimRepoData {
  organizationId?: string;
  title: string;
  totalAmount: number; // in integer paise
  status: ExpenseStatus;
  employeeId: string;
  submittedAt?: Date | null;
  items: Array<{
    category: ExpenseCategory;
    amount: number; // in integer paise
    description?: string | null;
    date: Date;
    receiptUrl?: string | null;
  }>;
}

export interface ListClaimsFilters {
  organizationId?: string;
  employeeId?: string;
  status?: ExpenseStatus;
  statuses?: ExpenseStatus[];
  search?: string;
}

export class ExpenseRepository {
  async createClaim(data: CreateClaimRepoData, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.expenseClaim.create({
      data: {
        organizationId: data.organizationId ?? DEFAULT_ORGANIZATION_ID,
        title: data.title,
        totalAmount: data.totalAmount,
        status: data.status,
        employeeId: data.employeeId,
        submittedAt: data.submittedAt,
        items: {
          create: data.items.map((item) => ({
            category: item.category,
            amount: item.amount,
            description: item.description,
            date: item.date,
            receiptUrl: item.receiptUrl,
          })),
        },
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            department: { select: { id: true, name: true } },
          },
        },
        items: true,
      },
    });
  }

  async findClaimById(id: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.expenseClaim.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            department: { select: { id: true, name: true } },
          },
        },
        items: {
          orderBy: { date: "desc" },
        },
      },
    });
  }

  async updateClaim(
    id: string,
    data: Prisma.ExpenseClaimUpdateInput,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    return client.expenseClaim.update({
      where: { id },
      data,
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            department: { select: { id: true, name: true } },
          },
        },
        items: true,
      },
    });
  }

  async deleteClaim(id: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.expenseClaim.delete({
      where: { id },
    });
  }

  async listClaims(
    filters: ListClaimsFilters,
    pagination: { skip: number; take: number },
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    const where: Prisma.ExpenseClaimWhereInput = {};

    if (filters.organizationId) {
      where.organizationId = filters.organizationId;
    }

    if (filters.employeeId) {
      where.employeeId = filters.employeeId;
    }

    if (filters.status) {
      where.status = filters.status;
    } else if (filters.statuses && filters.statuses.length > 0) {
      where.status = { in: filters.statuses };
    }

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: "insensitive" } },
        { paymentReference: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      client.expenseClaim.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: "desc" },
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              department: { select: { id: true, name: true } },
            },
          },
          items: true,
        },
      }),
      client.expenseClaim.count({ where }),
    ]);

    return { items, total };
  }

  async getSummary(employeeId: string, currentYear: number, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    const yearStart = new Date(Date.UTC(currentYear, 0, 1));
    const yearEnd = new Date(Date.UTC(currentYear + 1, 0, 1));

    // 1. Total reimbursed this year (PAID status where paidAt or createdAt is in current year)
    const paidClaims = await client.expenseClaim.findMany({
      where: {
        employeeId,
        status: ExpenseStatus.PAID,
        paidAt: {
          gte: yearStart,
          lt: yearEnd,
        },
      },
      select: { totalAmount: true },
    });

    const totalReimbursedThisYear = paidClaims.reduce(
      (sum, claim) => sum + claim.totalAmount,
      0
    );

    // 2. Pending payout (APPROVED status awaiting payment + SUBMITTED awaiting approval)
    const pendingApprovedClaims = await client.expenseClaim.findMany({
      where: {
        employeeId,
        status: ExpenseStatus.APPROVED,
      },
      select: { totalAmount: true },
    });

    const pendingPayout = pendingApprovedClaims.reduce(
      (sum, claim) => sum + claim.totalAmount,
      0
    );

    // Also calculate claims under review (submitted)
    const submittedClaims = await client.expenseClaim.findMany({
      where: {
        employeeId,
        status: ExpenseStatus.SUBMITTED,
      },
      select: { totalAmount: true },
    });

    const pendingReviewAmount = submittedClaims.reduce(
      (sum, claim) => sum + claim.totalAmount,
      0
    );

    // 3. Draft claims count
    const draftClaimsCount = await client.expenseClaim.count({
      where: {
        employeeId,
        status: ExpenseStatus.DRAFT,
      },
    });

    return {
      totalReimbursedThisYear,
      pendingPayout,
      pendingReviewAmount,
      draftClaimsCount,
      year: currentYear,
    };
  }

  async getFinanceQueueSummary(tx?: Prisma.TransactionClient, organizationId?: string) {
    const client = tx || prisma;
    const approvedClaims = await client.expenseClaim.findMany({
      where: {
        status: ExpenseStatus.APPROVED,
        ...(organizationId ? { organizationId } : {}),
      },
      select: { totalAmount: true },
    });

    const queueCount = approvedClaims.length;
    const queueTotalAmount = approvedClaims.reduce(
      (sum, claim) => sum + claim.totalAmount,
      0
    );

    return { queueCount, queueTotalAmount };
  }

  async addItem(
    claimId: string,
    data: {
      category: ExpenseCategory;
      amount: number;
      description?: string | null;
      date: Date;
      receiptUrl?: string | null;
    },
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    return client.expenseItem.create({
      data: {
        claimId,
        category: data.category,
        amount: data.amount,
        description: data.description || null,
        date: data.date,
        receiptUrl: data.receiptUrl || null,
      },
    });
  }

  async updateItem(
    itemId: string,
    data: Prisma.ExpenseItemUpdateInput,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    return client.expenseItem.update({
      where: { id: itemId },
      data,
    });
  }

  async deleteItem(itemId: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.expenseItem.delete({
      where: { id: itemId },
    });
  }

  async findClaimByPaymentReference(
    paymentReference: string,
    tx?: Prisma.TransactionClient,
    organizationId: string = DEFAULT_ORGANIZATION_ID
  ) {
    const client = tx || prisma;
    return client.expenseClaim.findUnique({
      where: {
        organizationId_paymentReference: {
          organizationId,
          paymentReference,
        },
      },
    });
  }

  async findItemByReceiptUrlContains(
    filename: string,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    return client.expenseItem.findFirst({
      where: {
        receiptUrl: {
          contains: filename,
        },
      },
      include: {
        claim: {
          include: {
            employee: true,
          },
        },
      },
    });
  }
}

export const expenseRepository = new ExpenseRepository();
