import { describe, it, expect, vi, beforeEach } from "vitest";
import { Role, ExpenseCategory, ExpenseStatus } from "@prisma/client";
import { expenseService } from "../../src/modules/expenses/expense.service";
import { expenseRepository } from "../../src/modules/expenses/expense.repository";
import { approvalService } from "../../src/modules/approvals/approval.service";
import { auditService } from "../../src/modules/audit/audit.service";
import { notificationService } from "../../src/modules/notifications/notification.service";
import { storageService } from "../../src/lib/storage";
import { prisma } from "../../src/lib/prisma";
import { AppError } from "../../src/lib/errors";
import type { AuthenticatedUser } from "../../src/types/express";

vi.mock("../../src/lib/prisma", () => {
  const mockClient: any = {
    $transaction: vi.fn(async (cb: any) => cb(mockClient)),
    expenseClaim: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    expenseItem: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    approvalStep: {
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
    department: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
  };
  return { prisma: mockClient };
});

vi.mock("../../src/modules/approvals/approval.service", () => ({
  approvalService: {
    initializeApprovalStepsForEntity: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../src/modules/audit/audit.service", () => ({
  auditService: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../src/modules/notifications/notification.service", () => ({
  notificationService: {
    notify: vi.fn().mockResolvedValue(undefined),
    notifyMultiple: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../src/lib/storage", () => ({
  storageService: {
    save: vi.fn().mockResolvedValue({ storedFilename: "test-uuid.pdf", sizeBytes: 1024 }),
    exists: vi.fn().mockResolvedValue(true),
    getStream: vi.fn().mockResolvedValue({ pipe: vi.fn() }),
  },
}));

describe("ExpenseService Unit Tests", () => {
  const mockEmployee: AuthenticatedUser = {
    id: "user-emp-1",
    name: "John Employee",
    email: "john@company.com",
    role: Role.EMPLOYEE,
    departmentId: "dept-eng",
  };

  const mockManager: AuthenticatedUser = {
    id: "user-mgr-1",
    name: "Mary Manager",
    email: "mary@company.com",
    role: Role.MANAGER,
    departmentId: "dept-eng",
  };

  const mockAdmin: AuthenticatedUser = {
    id: "user-adm-1",
    name: "Adam Admin",
    email: "admin@company.com",
    role: Role.ADMIN,
    departmentId: "dept-finance",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createClaim", () => {
    it("should compute totalAmount from items and create draft claim", async () => {
      const mockCreated = {
        id: "claim-1",
        title: "Client Meeting Expenses",
        totalAmount: 250000, // ₹2,500.00
        status: ExpenseStatus.DRAFT,
        employeeId: mockEmployee.id,
      };

      vi.spyOn(expenseRepository, "createClaim").mockResolvedValue(mockCreated as any);

      const result = await expenseService.createClaim(mockEmployee, {
        title: "Client Meeting Expenses",
        items: [
          {
            category: ExpenseCategory.MEALS,
            amount: 150000,
            date: "2026-11-01",
            description: "Lunch with client",
          },
          {
            category: ExpenseCategory.TRAVEL,
            amount: 100000,
            date: "2026-11-01",
            description: "Taxi fare",
          },
        ],
      });

      expect(result.id).toBe("claim-1");
      expect(expenseRepository.createClaim).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Client Meeting Expenses",
          totalAmount: 250000,
          status: ExpenseStatus.DRAFT,
          employeeId: mockEmployee.id,
        })
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "EXPENSE_CLAIM_CREATED",
          entityId: "claim-1",
        })
      );
    });

    it("should submit immediately when submitImmediately is true", async () => {
      const mockCreated = {
        id: "claim-2",
        title: "Software Subscriptions",
        totalAmount: 500000,
        status: ExpenseStatus.DRAFT,
        employeeId: mockEmployee.id,
        items: [
          {
            id: "item-2",
            category: ExpenseCategory.SOFTWARE,
            amount: 500000,
            receiptUrl: "/api/expenses/receipts/test.pdf",
          },
        ],
      };

      vi.spyOn(expenseRepository, "createClaim").mockResolvedValue(mockCreated as any);
      vi.spyOn(expenseRepository, "findClaimById").mockResolvedValue(mockCreated as any);
      vi.spyOn(expenseRepository, "updateClaim").mockResolvedValue({
        ...mockCreated,
        status: ExpenseStatus.SUBMITTED,
      } as any);

      const result = await expenseService.createClaim(mockEmployee, {
        title: "Software Subscriptions",
        submitImmediately: true,
        items: [
          {
            category: ExpenseCategory.SOFTWARE,
            amount: 500000,
            date: "2026-11-02",
            receiptUrl: "/api/expenses/receipts/test.pdf",
          },
        ],
      });

      expect(approvalService.initializeApprovalStepsForEntity).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: "EXPENSE",
          entityId: "claim-2",
        }),
        expect.anything()
      );
    });
  });

  describe("submitClaim", () => {
    it("should transition draft claim to SUBMITTED and initialize approval workflow", async () => {
      const mockClaim = {
        id: "claim-10",
        title: "Office Supplies",
        totalAmount: 85000,
        status: ExpenseStatus.DRAFT,
        employeeId: mockEmployee.id,
        items: [{ id: "item-1", amount: 85000, category: ExpenseCategory.OFFICE }],
      };

      vi.spyOn(expenseRepository, "findClaimById").mockResolvedValue(mockClaim as any);
      vi.spyOn(expenseRepository, "updateClaim").mockResolvedValue({
        ...mockClaim,
        status: ExpenseStatus.SUBMITTED,
      } as any);

      const result = await expenseService.submitClaim(mockEmployee, "claim-10");

      expect(result.status).toBe(ExpenseStatus.SUBMITTED);
      expect(approvalService.initializeApprovalStepsForEntity).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: "EXPENSE",
          entityId: "claim-10",
        }),
        expect.anything()
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "EXPENSE_CLAIM_SUBMITTED",
        })
      );
    });

    it("should reject submission by an unauthorized user", async () => {
      const mockClaim = {
        id: "claim-10",
        title: "Office Supplies",
        totalAmount: 85000,
        status: ExpenseStatus.DRAFT,
        employeeId: "other-user",
      };

      vi.spyOn(expenseRepository, "findClaimById").mockResolvedValue(mockClaim as any);

      await expect(
        expenseService.submitClaim(mockEmployee, "claim-10")
      ).rejects.toThrow(AppError);
    });

    it("should reject submission of an already submitted or approved claim", async () => {
      const mockClaim = {
        id: "claim-11",
        title: "Flight Tickets",
        totalAmount: 3500000,
        status: ExpenseStatus.APPROVED,
        employeeId: mockEmployee.id,
      };

      vi.spyOn(expenseRepository, "findClaimById").mockResolvedValue(mockClaim as any);

      await expect(
        expenseService.submitClaim(mockEmployee, "claim-11")
      ).rejects.toThrow(/Cannot submit an expense claim that is already in/i);
    });

    it("should reject submission if claim has no items", async () => {
      const mockClaim = {
        id: "claim-empty",
        title: "Empty Claim",
        totalAmount: 0,
        status: ExpenseStatus.DRAFT,
        employeeId: mockEmployee.id,
        items: [],
      };
      vi.spyOn(expenseRepository, "findClaimById").mockResolvedValue(mockClaim as any);

      await expect(
        expenseService.submitClaim(mockEmployee, "claim-empty")
      ).rejects.toThrow(/must contain at least one item/i);
    });

    it("should reject submission if item above receipt threshold lacks receipt", async () => {
      const mockClaim = {
        id: "claim-missing-receipt",
        title: "High value claim without receipt",
        totalAmount: 150000,
        status: ExpenseStatus.DRAFT,
        employeeId: mockEmployee.id,
        items: [
          {
            id: "item-big",
            amount: 150000, // > 100,000 paise threshold
            category: ExpenseCategory.TRAVEL,
            receiptUrl: null,
            description: "Flight ticket",
          },
        ],
      };
      vi.spyOn(expenseRepository, "findClaimById").mockResolvedValue(mockClaim as any);

      await expect(
        expenseService.submitClaim(mockEmployee, "claim-missing-receipt")
      ).rejects.toThrow(/Receipt is required/i);
    });

    it("should allow submission if item below receipt threshold has no receipt", async () => {
      const mockClaim = {
        id: "claim-small-item",
        title: "Small tea expense",
        totalAmount: 50000, // ₹500 < ₹1,000 threshold
        status: ExpenseStatus.DRAFT,
        employeeId: mockEmployee.id,
        items: [
          {
            id: "item-small",
            amount: 50000,
            category: ExpenseCategory.MEALS,
            receiptUrl: null,
            description: "Tea and snacks",
          },
        ],
      };
      vi.spyOn(expenseRepository, "findClaimById").mockResolvedValue(mockClaim as any);
      vi.spyOn(expenseRepository, "updateClaim").mockResolvedValue({
        ...mockClaim,
        status: ExpenseStatus.SUBMITTED,
      } as any);

      const result = await expenseService.submitClaim(mockEmployee, "claim-small-item");
      expect(result.status).toBe(ExpenseStatus.SUBMITTED);
    });
  });

  describe("edit rules", () => {
    it("should prevent updating claim title or metadata when not in DRAFT status", async () => {
      const mockClaim = {
        id: "claim-sub",
        title: "Submitted claim",
        status: ExpenseStatus.SUBMITTED,
        employeeId: mockEmployee.id,
      };
      vi.spyOn(expenseRepository, "findClaimById").mockResolvedValue(mockClaim as any);

      await expect(
        expenseService.updateClaim(mockEmployee, "claim-sub", { title: "New title" })
      ).rejects.toThrow(/Only DRAFT expense claims can be edited/i);
    });

    it("should prevent adding items to non-DRAFT claim", async () => {
      const mockClaim = {
        id: "claim-app",
        status: ExpenseStatus.APPROVED,
        employeeId: mockEmployee.id,
      };
      vi.spyOn(expenseRepository, "findClaimById").mockResolvedValue(mockClaim as any);

      await expect(
        expenseService.addItem(mockEmployee, "claim-app", {
          category: ExpenseCategory.OFFICE,
          amount: 5000,
          date: "2026-11-03",
        })
      ).rejects.toThrow(/Only DRAFT expense claims can be edited/i);
    });

    it("should prevent updating items in non-DRAFT claim", async () => {
      const mockClaim = {
        id: "claim-paid",
        status: ExpenseStatus.PAID,
        employeeId: mockEmployee.id,
      };
      vi.spyOn(expenseRepository, "findClaimById").mockResolvedValue(mockClaim as any);

      await expect(
        expenseService.updateItem(mockEmployee, "claim-paid", "item-1", {
          amount: 6000,
        })
      ).rejects.toThrow(/Only DRAFT expense claims can be edited/i);
    });

    it("should prevent deleting items from non-DRAFT claim", async () => {
      const mockClaim = {
        id: "claim-sub",
        status: ExpenseStatus.SUBMITTED,
        employeeId: mockEmployee.id,
      };
      vi.spyOn(expenseRepository, "findClaimById").mockResolvedValue(mockClaim as any);

      await expect(
        expenseService.deleteItem(mockEmployee, "claim-sub", "item-1")
      ).rejects.toThrow(/Only DRAFT expense claims can be edited/i);
    });
  });

  describe("markAsPaid", () => {
    it("should mark an approved claim as PAID with payment reference", async () => {
      const mockClaim = {
        id: "claim-20",
        title: "Annual Conference",
        totalAmount: 1200000, // ₹12,000.00
        status: ExpenseStatus.APPROVED,
        employeeId: mockEmployee.id,
        employee: { id: mockEmployee.id, name: mockEmployee.name },
      };

      vi.spyOn(expenseRepository, "findClaimById").mockResolvedValue(mockClaim as any);
      vi.spyOn(expenseRepository, "findClaimByPaymentReference").mockResolvedValue(null);
      vi.spyOn(expenseRepository, "updateClaim").mockResolvedValue({
        ...mockClaim,
        status: ExpenseStatus.PAID,
        paymentReference: "UTR-2026-998811",
        paidAt: new Date(),
      } as any);

      const result = await expenseService.markAsPaid(
        mockAdmin,
        "claim-20",
        "UTR-2026-998811"
      );

      expect(result.status).toBe(ExpenseStatus.PAID);
      expect(result.paymentReference).toBe("UTR-2026-998811");
      expect(notificationService.notify).toHaveBeenCalledWith(
        mockEmployee.id,
        "EXPENSE_PAID",
        expect.stringContaining("Paid"),
        expect.stringContaining("UTR-2026-998811"),
        "/expenses/claim-20",
        "ExpenseClaim",
        "claim-20"
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "EXPENSE_PAID",
        })
      );
    });

    it("should forbid regular employees from marking claims as paid", async () => {
      await expect(
        expenseService.markAsPaid(mockEmployee, "claim-20", "UTR-123")
      ).rejects.toThrow(/Only Finance or Admin/i);
    });

    it("should reject marking as paid if status is not APPROVED", async () => {
      const mockClaim = {
        id: "claim-21",
        title: "Pending Claim",
        totalAmount: 50000,
        status: ExpenseStatus.SUBMITTED,
        employeeId: mockEmployee.id,
      };

      vi.spyOn(expenseRepository, "findClaimById").mockResolvedValue(mockClaim as any);

      await expect(
        expenseService.markAsPaid(mockAdmin, "claim-21", "UTR-12345")
      ).rejects.toThrow(/Only APPROVED claims can be/i);
    });

    it("should reject empty payment reference", async () => {
      const mockClaim = {
        id: "claim-22",
        status: ExpenseStatus.APPROVED,
        employeeId: mockEmployee.id,
      };

      vi.spyOn(expenseRepository, "findClaimById").mockResolvedValue(mockClaim as any);

      await expect(
        expenseService.markAsPaid(mockAdmin, "claim-22", "   ")
      ).rejects.toThrow(/Payment reference is mandatory/i);
    });

    it("should reject duplicate payment reference with 409 Conflict", async () => {
      const mockClaim = {
        id: "claim-23",
        title: "Conference claim",
        status: ExpenseStatus.APPROVED,
        employeeId: mockEmployee.id,
      };
      vi.spyOn(expenseRepository, "findClaimById").mockResolvedValue(mockClaim as any);
      vi.spyOn(expenseRepository, "findClaimByPaymentReference").mockResolvedValue({
        id: "claim-prior",
        paymentReference: "UTR-DUPLICATE-123",
      } as any);

      await expect(
        expenseService.markAsPaid(mockAdmin, "claim-23", "UTR-DUPLICATE-123")
      ).rejects.toThrow(/has already been used/i);
    });
  });

  describe("getSummary", () => {
    it("should return employee metrics (Total reimbursed this year, Pending payout, Draft claims)", async () => {
      vi.spyOn(expenseRepository, "getSummary").mockResolvedValue({
        totalReimbursedThisYear: 4500000, // ₹45,000.00
        pendingPayout: 1250000, // ₹12,500.00
        pendingReviewAmount: 500000,
        draftClaimsCount: 3,
        year: 2026,
      });

      const summary = await expenseService.getSummary(mockEmployee, 2026);

      expect(summary.employee.totalReimbursedThisYear).toBe(4500000);
      expect(summary.employee.pendingPayout).toBe(1250000);
      expect(summary.employee.draftClaimsCount).toBe(3);
    });

    it("should include finance queue summary when accessed by Admin or Manager", async () => {
      vi.spyOn(expenseRepository, "getSummary").mockResolvedValue({
        totalReimbursedThisYear: 0,
        pendingPayout: 0,
        pendingReviewAmount: 0,
        draftClaimsCount: 0,
        year: 2026,
      });

      vi.spyOn(expenseRepository, "getFinanceQueueSummary").mockResolvedValue({
        queueCount: 5,
        queueTotalAmount: 7800000, // ₹78,000.00
      });

      const summary = await expenseService.getSummary(mockAdmin, 2026);

      expect(summary.finance).toBeDefined();
      expect(summary.finance?.queueCount).toBe(5);
      expect(summary.finance?.queueTotalAmount).toBe(7800000);
    });
  });

  describe("listClaims", () => {
    it("should forbid employee from accessing finance tab queue", async () => {
      await expect(
        expenseService.listClaims(mockEmployee, { tab: "finance" })
      ).rejects.toThrow(/Finance view is restricted/i);
    });

    it("should return approved claims queue for admin on finance tab", async () => {
      vi.spyOn(expenseRepository, "listClaims").mockResolvedValue({
        items: [
          {
            id: "claim-fin-1",
            title: "Approved Travel",
            status: ExpenseStatus.APPROVED,
            totalAmount: 300000,
          },
        ] as any,
        total: 1,
      });

      const result = await expenseService.listClaims(mockAdmin, { tab: "finance" });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].status).toBe(ExpenseStatus.APPROVED);
    });
  });

  describe("uploadReceipt", () => {
    it("should reject disallowed extensions", async () => {
      const fakeFile: any = {
        originalname: "malicious.exe",
        mimetype: "application/x-msdownload",
        size: 1000,
        buffer: Buffer.from(""),
      };

      await expect(
        expenseService.uploadReceipt(fakeFile, mockEmployee)
      ).rejects.toThrow(/Invalid receipt file/i);
    });

    it("should accept valid PDF receipt under 5 MB", async () => {
      const fakePdf: any = {
        originalname: "receipt-hotel.pdf",
        mimetype: "application/pdf",
        size: 2 * 1024 * 1024,
        buffer: Buffer.from("pdf-data"),
      };

      const result = await expenseService.uploadReceipt(fakePdf, mockEmployee);

      expect(result.receiptUrl).toBe("/api/expenses/receipts/test-uuid.pdf");
      expect(result.originalFilename).toBe("receipt-hotel.pdf");
    });
  });

  describe("getReceiptFile access control", () => {
    it("should allow claim owner to view receipt", async () => {
      vi.spyOn(expenseRepository, "findItemByReceiptUrlContains").mockResolvedValue({
        id: "item-rec-1",
        claim: {
          id: "claim-rec-1",
          employeeId: mockEmployee.id,
        },
      } as any);

      const stream = await expenseService.getReceiptFile("test-receipt.pdf", mockEmployee);
      expect(stream).toBeDefined();
    });

    it("should allow Finance / Admin to view receipt", async () => {
      vi.spyOn(expenseRepository, "findItemByReceiptUrlContains").mockResolvedValue({
        id: "item-rec-2",
        claim: {
          id: "claim-rec-2",
          employeeId: "someone-else",
        },
      } as any);

      const stream = await expenseService.getReceiptFile("test-receipt.pdf", mockAdmin);
      expect(stream).toBeDefined();
    });

    it("should forbid unrelated employee from viewing receipt", async () => {
      const unrelatedEmployee: AuthenticatedUser = {
        id: "user-unrelated",
        name: "Unrelated User",
        email: "unrelated@company.com",
        role: Role.EMPLOYEE,
        departmentId: "dept-sales",
      };

      vi.spyOn(expenseRepository, "findItemByReceiptUrlContains").mockResolvedValue({
        id: "item-rec-3",
        claim: {
          employeeId: "someone-else",
          id: "claim-other",
        },
      } as any);
      vi.spyOn(prisma.approvalStep, "findMany").mockResolvedValue([]);

      await expect(
        expenseService.getReceiptFile("test-receipt.pdf", unrelatedEmployee)
      ).rejects.toThrow(/You do not have permission to access this receipt/i);
    });
  });
});
