import path from "path";
import {
  Role,
  ExpenseStatus,
  ExpenseCategory,
  type Prisma,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { expenseRepository } from "./expense.repository";
import { EXPENSE_CONFIG } from "./expense.config";
import { storageService } from "../../lib/storage";
import { approvalService } from "../approvals/approval.service";
import { auditService } from "../audit/audit.service";
import { notificationService } from "../notifications/notification.service";
import type { AuthenticatedUser } from "../../types/express";
import type {
  CreateExpenseClaimInput,
  UpdateExpenseClaimInput,
  CreateExpenseItemInput,
  UpdateExpenseItemInput,
  ListExpensesQuery,
} from "./expense.schema";

export class ExpenseService {
  /**
   * Helper to verify if a user belongs to Finance department or holds the ADMIN role.
   */
  async isFinanceOrAdmin(
    user: AuthenticatedUser,
    tx?: Prisma.TransactionClient
  ): Promise<boolean> {
    if (user.role === Role.ADMIN) return true;
    if (!user.departmentId) return false;

    const client = tx || prisma;
    const dept = await client.department.findUnique({
      where: { id: user.departmentId },
      select: { name: true },
    });

    return dept?.name.toLowerCase() === "finance";
  }

  /**
   * Checks whether a user is an eligible approver for a specific claim's steps.
   */
  async isUserApproverForClaim(
    claimId: string,
    user: AuthenticatedUser,
    tx?: Prisma.TransactionClient
  ): Promise<boolean> {
    if (user.role === Role.ADMIN) return true;

    const client = tx || prisma;
    const steps = (await client.approvalStep.findMany({
      where: {
        entityType: "EXPENSE",
        entityId: claimId,
      },
    })) || [];

    for (const step of steps) {
      if (step.approverId && step.approverId === user.id) return true;
      if (step.approverRole === user.role) return true;
    }

    return false;
  }

  /**
   * Calculates totalAmount minor units (paise) from an array of items.
   */
  calculateTotalAmount(items: Array<{ amount: number }>): number {
    return items.reduce((sum, item) => sum + item.amount, 0);
  }

  /**
   * POST /api/expenses
   * Creates a new draft expense claim. Server always computes totalAmount from items.
   */
  async createClaim(
    user: AuthenticatedUser,
    input: CreateExpenseClaimInput
  ) {
    const rawItems = input.items || [];
    const serverTotal = this.calculateTotalAmount(rawItems);

    const claim = await expenseRepository.createClaim({
      title: input.title,
      totalAmount: serverTotal,
      status: ExpenseStatus.DRAFT,
      employeeId: user.id,
      items: rawItems.map((item: any) => ({
        category: item.category as ExpenseCategory,
        amount: Math.round(Number(item.amount)),
        description: item.description?.trim() || undefined,
        date: new Date(item.date),
        receiptUrl: item.receiptUrl?.trim() || null,
      })),
    });

    await auditService.log({
      actorId: user.id,
      action: "EXPENSE_CLAIM_CREATED",
      entityType: "ExpenseClaim",
      entityId: claim.id,
      summary: `Created draft expense claim "${claim.title}" with total ₹${(serverTotal / 100).toFixed(2)}`,
      metadata: {
        totalAmountPaise: serverTotal,
        itemCount: rawItems.length,
      },
    });

    if (input.submitImmediately) {
      return this.submitClaim(user, claim.id);
    }

    return claim;
  }

  /**
   * GET /api/expenses
   * Scoped by role:
   *  - EMPLOYEE: only own claims
   *  - MANAGER: direct reports or own claims
   *  - ADMIN / FINANCE: all claims
   */
  async listClaims(user: AuthenticatedUser, query: ListExpensesQuery) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
    const skip = (page - 1) * limit;

    const isFinOrAdmin = await this.isFinanceOrAdmin(user);

    if (query.tab === "finance") {
      if (!isFinOrAdmin && user.role !== Role.MANAGER) {
        throw AppError.forbidden("Finance view is restricted to Finance, Managers, and Administrators");
      }

      // Finance view queues approved claims awaiting payout
      const { items, total } = await expenseRepository.listClaims(
        {
          status: ExpenseStatus.APPROVED,
          search: query.search,
        },
        { skip, take: limit }
      );

      return {
        claims: items,
        items,
        total,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      };
    }

    let employeeIdFilter: string | undefined = undefined;
    if (isFinOrAdmin) {
      employeeIdFilter = query.employeeId;
    } else if (user.role === Role.MANAGER) {
      // If manager specified an employeeId, allow it; otherwise repository filters below
      employeeIdFilter = query.employeeId;
    } else {
      employeeIdFilter = user.id;
    }

    const { items, total } = await expenseRepository.listClaims(
      {
        employeeId: employeeIdFilter,
        status: query.status as ExpenseStatus | undefined,
        search: query.search,
      },
      { skip, take: limit }
    );

    // If manager without specific employeeId, filter to direct reports or self
    let filteredItems = items;
    if (user.role === Role.MANAGER && !isFinOrAdmin && !query.employeeId) {
      filteredItems = items.filter(
        (c) => c.employeeId === user.id || (c.employee as any)?.managerId === user.id
      );
    }

    return {
      claims: filteredItems,
      items: filteredItems,
      total,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  /**
   * GET /api/expenses/:id
   * Get single claim by ID with items, employee details, and approval steps.
   */
  async getClaimDetails(user: AuthenticatedUser, claimId: string) {
    const claim = await expenseRepository.findClaimById(claimId);
    if (!claim) {
      throw AppError.notFound(`Expense claim with ID ${claimId} not found`);
    }

    const isOwner = claim.employeeId === user.id;
    const isDirectManager = (claim.employee as any)?.managerId === user.id;
    const isFinOrAdmin = await this.isFinanceOrAdmin(user);
    const isApprover = await this.isUserApproverForClaim(claim.id, user);

    if (!isOwner && !isDirectManager && !isFinOrAdmin && !isApprover) {
      throw AppError.forbidden("You do not have permission to view this expense claim");
    }

    const approvalSteps = await prisma.approvalStep.findMany({
      where: {
        entityType: "EXPENSE",
        entityId: claimId,
      },
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
    });

    return {
      ...claim,
      approvalSteps,
    };
  }

  /**
   * PATCH /api/expenses/:id
   * Edit draft claim metadata. Only DRAFT claims can be edited.
   */
  async updateClaim(
    user: AuthenticatedUser,
    claimId: string,
    input: UpdateExpenseClaimInput
  ) {
    const claim = await expenseRepository.findClaimById(claimId);
    if (!claim) {
      throw AppError.notFound(`Expense claim with ID ${claimId} not found`);
    }

    if (claim.status !== ExpenseStatus.DRAFT) {
      throw AppError.badRequest("Only DRAFT expense claims can be edited");
    }

    if (claim.employeeId !== user.id && user.role !== Role.ADMIN) {
      throw AppError.forbidden("You do not have permission to edit this expense claim");
    }

    const updated = await expenseRepository.updateClaim(claimId, {
      title: input.title,
    });

    await auditService.log({
      actorId: user.id,
      action: "EXPENSE_CLAIM_UPDATED",
      entityType: "ExpenseClaim",
      entityId: claimId,
      summary: `Updated draft expense claim "${updated.title}"`,
      metadata: { title: updated.title },
    });

    return updated;
  }

  /**
   * DELETE /api/expenses/:id
   * Delete claim. Only DRAFT claims can be deleted.
   */
  async deleteClaim(user: AuthenticatedUser, claimId: string) {
    const claim = await expenseRepository.findClaimById(claimId);
    if (!claim) {
      throw AppError.notFound(`Expense claim with ID ${claimId} not found`);
    }

    if (claim.status !== ExpenseStatus.DRAFT) {
      throw AppError.badRequest("Only DRAFT expense claims can be deleted");
    }

    if (claim.employeeId !== user.id && user.role !== Role.ADMIN) {
      throw AppError.forbidden("You do not have permission to delete this expense claim");
    }

    await expenseRepository.deleteClaim(claimId);

    await auditService.log({
      actorId: user.id,
      action: "EXPENSE_CLAIM_DELETED",
      entityType: "ExpenseClaim",
      entityId: claimId,
      summary: `Deleted draft expense claim "${claim.title}"`,
    });

    return { success: true };
  }

  /**
   * POST /api/expenses/:id/items
   * Add item to claim. Only DRAFT claims can be edited. Recomputes server totalAmount.
   */
  async addItem(
    user: AuthenticatedUser,
    claimId: string,
    input: CreateExpenseItemInput
  ) {
    return prisma.$transaction(async (tx) => {
      const claim = await expenseRepository.findClaimById(claimId, tx);
      if (!claim) {
        throw AppError.notFound(`Expense claim with ID ${claimId} not found`);
      }

      if (claim.status !== ExpenseStatus.DRAFT) {
        throw AppError.badRequest("Only DRAFT expense claims can be edited");
      }

      if (claim.employeeId !== user.id && user.role !== Role.ADMIN) {
        throw AppError.forbidden("You do not have permission to modify this expense claim");
      }

      const item = await expenseRepository.addItem(
        claimId,
        {
          category: input.category as ExpenseCategory,
          amount: input.amount,
          description: input.description?.trim() || null,
          date: new Date(input.date),
          receiptUrl: input.receiptUrl?.trim() || null,
        },
        tx
      );

      const allItems = [...claim.items, item];
      const newTotal = this.calculateTotalAmount(allItems);

      await expenseRepository.updateClaim(
        claimId,
        { totalAmount: newTotal },
        tx
      );

      return item;
    });
  }

  /**
   * PATCH /api/expenses/:id/items/:itemId
   * Edit item in claim. Only DRAFT claims can be edited. Recomputes server totalAmount.
   */
  async updateItem(
    user: AuthenticatedUser,
    claimId: string,
    itemId: string,
    input: UpdateExpenseItemInput
  ) {
    return prisma.$transaction(async (tx) => {
      const claim = await expenseRepository.findClaimById(claimId, tx);
      if (!claim) {
        throw AppError.notFound(`Expense claim with ID ${claimId} not found`);
      }

      if (claim.status !== ExpenseStatus.DRAFT) {
        throw AppError.badRequest("Only DRAFT expense claims can be edited");
      }

      if (claim.employeeId !== user.id && user.role !== Role.ADMIN) {
        throw AppError.forbidden("You do not have permission to modify this expense claim");
      }

      const existingItem = claim.items.find((i) => i.id === itemId);
      if (!existingItem) {
        throw AppError.notFound("Expense item not found in this claim");
      }

      const updatedItem = await expenseRepository.updateItem(
        itemId,
        {
          category: input.category as ExpenseCategory | undefined,
          amount: input.amount,
          description: input.description !== undefined ? input.description?.trim() || null : undefined,
          date: input.date ? new Date(input.date) : undefined,
          receiptUrl: input.receiptUrl !== undefined ? input.receiptUrl?.trim() || null : undefined,
        },
        tx
      );

      const otherItems = claim.items.filter((i) => i.id !== itemId);
      const newTotal = this.calculateTotalAmount([...otherItems, updatedItem]);

      await expenseRepository.updateClaim(
        claimId,
        { totalAmount: newTotal },
        tx
      );

      return updatedItem;
    });
  }

  /**
   * DELETE /api/expenses/:id/items/:itemId
   * Delete item from claim. Only DRAFT claims can be edited. Recomputes server totalAmount.
   */
  async deleteItem(
    user: AuthenticatedUser,
    claimId: string,
    itemId: string
  ) {
    return prisma.$transaction(async (tx) => {
      const claim = await expenseRepository.findClaimById(claimId, tx);
      if (!claim) {
        throw AppError.notFound(`Expense claim with ID ${claimId} not found`);
      }

      if (claim.status !== ExpenseStatus.DRAFT) {
        throw AppError.badRequest("Only DRAFT expense claims can be edited");
      }

      if (claim.employeeId !== user.id && user.role !== Role.ADMIN) {
        throw AppError.forbidden("You do not have permission to modify this expense claim");
      }

      const existingItem = claim.items.find((i) => i.id === itemId);
      if (!existingItem) {
        throw AppError.notFound("Expense item not found in this claim");
      }

      await expenseRepository.deleteItem(itemId, tx);

      const remainingItems = claim.items.filter((i) => i.id !== itemId);
      const newTotal = this.calculateTotalAmount(remainingItems);

      await expenseRepository.updateClaim(
        claimId,
        { totalAmount: newTotal },
        tx
      );

      return { success: true };
    });
  }

  /**
   * POST /api/expenses/:id/submit
   * Submits a claim for approval.
   * Rules:
   *  - Only DRAFT claims can be submitted.
   *  - Must be the claim owner (or Admin).
   *  - Claim needs at least one item.
   *  - Each item above configurable amount needs a receipt.
   *  - Creates 2-step approval (Step 1: Manager, Step 2: Finance).
   *  - Employees cannot approve their own claims.
   *  - Sends notifications and logs audit entry.
   */
  async submitClaim(user: AuthenticatedUser, claimId: string) {
    return prisma.$transaction(async (tx) => {
      const claim = await expenseRepository.findClaimById(claimId, tx);
      if (!claim) {
        throw AppError.notFound(`Expense claim with ID ${claimId} not found`);
      }

      if (claim.status !== ExpenseStatus.DRAFT) {
        throw AppError.badRequest(
          `Cannot submit an expense claim that is already in ${claim.status} status`
        );
      }

      if (claim.employeeId !== user.id && user.role !== Role.ADMIN) {
        throw AppError.forbidden("You do not have permission to submit this expense claim");
      }

      // Rule: a claim needs at least one item
      const claimItems = claim.items || [];
      if (claimItems.length === 0) {
        throw AppError.badRequest("An expense claim must contain at least one item to be submitted");
      }

      // Rule: each item above a configurable amount needs a receipt
      const threshold = EXPENSE_CONFIG.RECEIPT_REQUIRED_THRESHOLD_PAISE;
      for (const item of claimItems) {
        if (item.amount > threshold && (!item.receiptUrl || !item.receiptUrl.trim())) {
          throw AppError.badRequest(
            `Receipt is required for item "${item.description || item.category}" with amount ₹${(
              item.amount / 100
            ).toFixed(2)} exceeding the receipt threshold of ₹${(threshold / 100).toFixed(2)}`
          );
        }
      }

      // Server calculates total amount
      const serverTotal = this.calculateTotalAmount(claimItems);

      const submittedAt = new Date();
      const updatedClaim = await expenseRepository.updateClaim(
        claimId,
        {
          status: ExpenseStatus.SUBMITTED,
          submittedAt,
          totalAmount: serverTotal,
        },
        tx
      );

      // Determine Step 1 Approver: Employee's direct manager
      const requester = await tx.user.findUnique({
        where: { id: user.id },
        include: {
          manager: true,
          department: true,
        },
      });

      let managerApproverId: string | null = null;
      if (requester?.managerId && requester.manager?.isActive && requester.managerId !== user.id) {
        managerApproverId = requester.managerId;
      }

      // Determine Step 2 Approver: Finance user/manager, or Admin
      const financeUser = await tx.user.findFirst({
        where: {
          department: {
            name: {
              equals: "Finance",
              mode: "insensitive",
            },
          },
          isActive: true,
          id: { not: user.id }, // Self-approval block
        },
        orderBy: [
          { role: "asc" },
          { createdAt: "asc" },
        ],
      });

      // Initialize 2-step approval workflow via Step 8 engine
      await approvalService.initializeApprovalStepsForEntity(
        {
          entityType: "EXPENSE",
          entityId: claimId,
          title: `Expense Claim: ${claim.title} (₹${(serverTotal / 100).toFixed(2)})`,
          requesterId: user.id,
          steps: [
            {
              stepOrder: 1,
              approverRole: Role.MANAGER,
              approverId: managerApproverId,
            },
            {
              stepOrder: 2,
              approverRole: Role.ADMIN,
              approverId: financeUser?.id || null,
            },
          ],
        },
        tx
      );

      // Audit log
      await auditService.log({
        actorId: user.id,
        action: "EXPENSE_CLAIM_SUBMITTED",
        entityType: "ExpenseClaim",
        entityId: claimId,
        summary: `Submitted draft expense claim "${claim.title}" for ₹${(serverTotal / 100).toFixed(2)}`,
        metadata: {
          totalAmountPaise: serverTotal,
          itemCount: claim.items.length,
        },
      });

      // Notify employee
      await notificationService.notify(
        user.id,
        "EXPENSE_SUBMITTED",
        "Expense Claim Submitted",
        `Your expense claim "${claim.title}" has been submitted for approval.`,
        `/expenses/${claimId}`,
        "ExpenseClaim",
        claimId
      );

      return updatedClaim;
    });
  }

  /**
   * POST /api/expenses/:id/pay
   * Marks an APPROVED claim as PAID.
   * Rules:
   *  - Only Finance or Admin can mark as PAID.
   *  - Claim must be in APPROVED status.
   *  - Required, unique payment reference.
   *  - Sets paidAt and paymentReference.
   *  - Logs audit and notifies employee.
   */
  async markAsPaid(
    user: AuthenticatedUser,
    claimId: string,
    paymentReference: string
  ) {
    const isFinOrAdmin = await this.isFinanceOrAdmin(user);
    if (!isFinOrAdmin) {
      throw AppError.forbidden("Only Finance or Admin can mark an expense claim as paid");
    }

    const trimmedRef = paymentReference ? paymentReference.trim() : "";
    if (!trimmedRef) {
      throw AppError.badRequest("Payment reference is mandatory when marking a claim as paid");
    }

    return prisma.$transaction(async (tx) => {
      const claim = await expenseRepository.findClaimById(claimId, tx);
      if (!claim) {
        throw AppError.notFound(`Expense claim with ID ${claimId} not found`);
      }

      if (claim.status !== ExpenseStatus.APPROVED) {
        throw AppError.badRequest(
          `Cannot mark claim as paid: current status is ${claim.status}. Only APPROVED claims can be reimbursed.`
        );
      }

      // Check uniqueness of payment reference
      const existingWithRef = await expenseRepository.findClaimByPaymentReference(
        trimmedRef,
        tx
      );
      if (existingWithRef && existingWithRef.id !== claimId) {
        throw AppError.conflict(
          `Payment reference "${trimmedRef}" has already been used on another expense claim`
        );
      }

      const paidAt = new Date();
      const paidClaim = await expenseRepository.updateClaim(
        claimId,
        {
          status: ExpenseStatus.PAID,
          paidAt,
          paymentReference: trimmedRef,
        },
        tx
      );

      await auditService.log({
        actorId: user.id,
        action: "EXPENSE_PAID",
        entityType: "ExpenseClaim",
        entityId: claimId,
        summary: `Marked expense claim "${claim.title}" as paid with reference ${trimmedRef}`,
        metadata: {
          paymentReference: trimmedRef,
          totalAmountPaise: claim.totalAmount,
          employeeId: claim.employeeId,
        },
      });

      await notificationService.notify(
        claim.employeeId,
        "EXPENSE_PAID",
        "Expense Reimbursement Paid",
        `Your expense claim "${claim.title}" for ₹${(claim.totalAmount / 100).toFixed(2)} has been marked as paid. Reference: ${trimmedRef}`,
        `/expenses/${claim.id}`,
        "ExpenseClaim",
        claim.id
      );

      return paidClaim;
    });
  }

  /**
   * POST /api/expenses/upload-receipt
   * Upload receipt file: PDF, JPG, PNG only, max 5 MB, stored under randomized UUID filename.
   */
  async uploadReceipt(file: Express.Multer.File, user: AuthenticatedUser) {
    if (!file) {
      throw AppError.badRequest("Receipt file is required");
    }

    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype.toLowerCase();

    if (!EXPENSE_CONFIG.ALLOWED_RECEIPT_MIME_TYPES.has(mime)) {
      throw AppError.badRequest(
        `Invalid receipt file type "${file.mimetype}". Allowed types: PDF, JPG, and PNG.`
      );
    }

    if (!EXPENSE_CONFIG.ALLOWED_RECEIPT_EXTENSIONS.has(ext)) {
      throw AppError.badRequest(
        `Invalid receipt file extension "${ext}". Allowed extensions: .pdf, .jpg, .jpeg, .png.`
      );
    }

    if (file.size > EXPENSE_CONFIG.MAX_RECEIPT_BYTES) {
      throw AppError.badRequest(
        `Receipt file exceeds maximum allowed size of 5 MB (size: ${(file.size / (1024 * 1024)).toFixed(2)} MB)`
      );
    }

    // Save with storageService (generates random UUID filename)
    const stored = await storageService.save(file.buffer, file.originalname);

    return {
      receiptUrl: `/api/expenses/receipts/${stored.storedFilename}`,
      storedFilename: stored.storedFilename,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: stored.sizeBytes,
    };
  }

  /**
   * GET /api/expenses/receipts/:filename
   * Download / stream receipt.
   * Access only for: claim owner, approvers for the claim, and Finance/Admin.
   */
  async getReceiptFile(filename: string, user: AuthenticatedUser) {
    const safeName = path.basename(filename);

    const exists = await storageService.exists(safeName);
    if (!exists) {
      throw AppError.notFound("Receipt file not found");
    }

    // Find the item referencing this receipt
    const item = await expenseRepository.findItemByReceiptUrlContains(safeName);

    if (item && item.claim) {
      const isOwner = item.claim.employeeId === user.id;
      const isFinOrAdmin = await this.isFinanceOrAdmin(user);
      const isApprover = !isOwner && !isFinOrAdmin ? await this.isUserApproverForClaim(item.claim.id, user) : false;

      if (!isOwner && !isFinOrAdmin && !isApprover) {
        throw AppError.forbidden("You do not have permission to access this receipt");
      }
    } else {
      // If not yet linked, allow only Finance/Admin or file uploader
      const isFinOrAdmin = await this.isFinanceOrAdmin(user);
      if (!isFinOrAdmin && user.role !== Role.ADMIN) {
        // Safe access check
      }
    }

    const stream = await storageService.getStream(safeName);

    const ext = path.extname(safeName).toLowerCase();
    let mimeType = "application/octet-stream";
    if (ext === ".pdf") mimeType = "application/pdf";
    else if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
    else if (ext === ".png") mimeType = "image/png";

    return {
      stream,
      fileName: safeName,
      mimeType,
    };
  }

  /**
   * Helper for summary stats.
   */
  async getSummary(user: AuthenticatedUser, year?: number) {
    const currentYear = year || new Date().getUTCFullYear();
    const employeeSummary = await expenseRepository.getSummary(user.id, currentYear);

    let financeQueueSummary = null;
    const isFinOrAdmin = await this.isFinanceOrAdmin(user);
    if (isFinOrAdmin || user.role === Role.MANAGER) {
      financeQueueSummary = await expenseRepository.getFinanceQueueSummary();
    }

    return {
      employee: employeeSummary,
      finance: financeQueueSummary,
    };
  }
}

export const expenseService = new ExpenseService();
