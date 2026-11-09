import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import { Role, ExpenseCategory, ExpenseStatus } from "@prisma/client";
import { expenseController } from "../../src/modules/expenses/expense.controller";
import { expenseService } from "../../src/modules/expenses/expense.service";
import {
  createExpenseClaimSchema,
  markAsPaidSchema,
  expenseIdParamSchema,
} from "../../src/modules/expenses/expense.schema";

vi.mock("../../src/modules/expenses/expense.service", () => ({
  expenseService: {
    createClaim: vi.fn(),
    listClaims: vi.fn(),
    getClaimById: vi.fn(),
    updateClaim: vi.fn(),
    deleteClaim: vi.fn(),
    addItem: vi.fn(),
    updateItem: vi.fn(),
    deleteItem: vi.fn(),
    submitClaim: vi.fn(),
    markAsPaid: vi.fn(),
    uploadReceipt: vi.fn(),
    getReceiptFile: vi.fn(),
    getSummary: vi.fn(),
  },
}));

const createMockResponse = () => {
  const res: Partial<Response> & {
    statusCode?: number;
    body?: any;
    headers: Record<string, string>;
  } = {
    headers: {},
  };
  res.status = (code: number) => {
    res.statusCode = code;
    return res as Response;
  };
  res.json = (data: any) => {
    res.body = data;
    return res as Response;
  };
  res.setHeader = (key: string, value: any) => {
    res.headers[key] = String(value);
    return res as Response;
  };
  return res as Response & { statusCode: number; body: any; headers: Record<string, string> };
};

describe("Expense Controller & Routes Unit Tests", () => {
  const mockEmployeeUser = {
    id: "emp-101",
    name: "Alex Employee",
    email: "alex@company.com",
    role: Role.EMPLOYEE,
    departmentId: "dept-eng",
  };

  const mockAdminUser = {
    id: "adm-101",
    name: "Admin Alice",
    email: "admin@company.com",
    role: Role.ADMIN,
    departmentId: "dept-finance",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Validation Schemas", () => {
    it("should validate valid create expense claim payload", () => {
      const valid = createExpenseClaimSchema.safeParse({
        title: "Team Lunch & Travel",
        items: [
          {
            category: ExpenseCategory.MEALS,
            amount: 250000,
            date: "2026-11-04",
            description: "Quarterly team meal",
          },
        ],
      });
      expect(valid.success).toBe(true);
    });

    it("should reject create payload with negative or non-integer paise", () => {
      const invalid = createExpenseClaimSchema.safeParse({
        title: "Invalid Amount",
        items: [
          {
            category: ExpenseCategory.MEALS,
            amount: -500,
            date: "2026-11-04",
          },
        ],
      });
      expect(invalid.success).toBe(false);
    });

    it("should validate markAsPaid schema with valid reference", () => {
      const valid = markAsPaidSchema.safeParse({
        paymentReference: "UTR-AXIS-998822",
      });
      expect(valid.success).toBe(true);
    });

    it("should reject markAsPaid schema with empty or whitespace-only reference", () => {
      const invalid = markAsPaidSchema.safeParse({
        paymentReference: "   ",
      });
      expect(invalid.success).toBe(false);
    });

    it("should validate expenseIdParamSchema", () => {
      expect(expenseIdParamSchema.safeParse({ id: "claim-123" }).success).toBe(true);
      expect(expenseIdParamSchema.safeParse({ id: "   " }).success).toBe(false);
    });
  });

  describe("Controller Actions", () => {
    describe("create", () => {
      it("should return 201 with created expense claim", async () => {
        const mockResult = {
          id: "claim-test-1",
          title: "Conference Travel",
          totalAmount: 180000,
          status: ExpenseStatus.DRAFT,
          employeeId: mockEmployeeUser.id,
        };

        vi.mocked(expenseService.createClaim).mockResolvedValue(mockResult as any);

        const req = {
          user: mockEmployeeUser,
          body: {
            title: "Conference Travel",
            items: [
              {
                category: ExpenseCategory.TRAVEL,
                amount: 180000,
                date: "2026-11-04",
                description: "Train ticket",
              },
            ],
          },
        } as unknown as Request;

        const res = createMockResponse();

        await expenseController.create(req, res);

        expect(res.statusCode).toBe(201);
        expect(res.body.id).toBe("claim-test-1");
        expect(res.body.totalAmount).toBe(180000);
      });
    });

    describe("submit", () => {
      it("should submit claim and return updated claim", async () => {
        const mockSubmitted = {
          id: "claim-test-2",
          title: "Office Furniture",
          totalAmount: 45000,
          status: ExpenseStatus.SUBMITTED,
        };

        vi.mocked(expenseService.submitClaim).mockResolvedValue(mockSubmitted as any);

        const req = {
          user: mockEmployeeUser,
          params: { id: "claim-test-2" },
        } as unknown as Request;

        const res = createMockResponse();

        await expenseController.submit(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe(ExpenseStatus.SUBMITTED);
      });
    });

    describe("pay", () => {
      it("should mark claim as paid with payment reference", async () => {
        const mockPaid = {
          id: "claim-test-3",
          status: ExpenseStatus.PAID,
          paymentReference: "UTR-BANK-778899",
          paidAt: new Date(),
        };

        vi.mocked(expenseService.markAsPaid).mockResolvedValue(mockPaid as any);

        const req = {
          user: mockAdminUser,
          params: { id: "claim-test-3" },
          body: { paymentReference: "UTR-BANK-778899" },
        } as unknown as Request;

        const res = createMockResponse();

        await expenseController.pay(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe(ExpenseStatus.PAID);
        expect(res.body.paymentReference).toBe("UTR-BANK-778899");
        expect(expenseService.markAsPaid).toHaveBeenCalledWith(
          mockAdminUser,
          "claim-test-3",
          "UTR-BANK-778899"
        );
      });
    });

    describe("uploadReceipt", () => {
      it("should throw 400 when no file is uploaded", async () => {
        const req = {
          user: mockEmployeeUser,
          file: undefined,
        } as unknown as Request;

        const res = createMockResponse();

        await expect(expenseController.uploadReceipt(req, res)).rejects.toThrow(
          /No receipt file was provided/i
        );
      });

      it("should return 201 with receiptUrl on valid upload", async () => {
        vi.mocked(expenseService.uploadReceipt).mockResolvedValue({
          receiptUrl: "/api/expenses/receipts/random-uuid.pdf",
          originalFilename: "receipt.pdf",
          sizeBytes: 2048,
          mimeType: "application/pdf",
        });

        const req = {
          user: mockEmployeeUser,
          file: {
            originalname: "receipt.pdf",
            mimetype: "application/pdf",
            size: 2048,
            buffer: Buffer.from("pdf-data"),
          },
        } as unknown as Request;

        const res = createMockResponse();

        await expenseController.uploadReceipt(req, res);

        expect(res.statusCode).toBe(201);
        expect(res.body.receiptUrl).toBe("/api/expenses/receipts/random-uuid.pdf");
      });
    });

    describe("getReceiptFile", () => {
      it("should stream receipt file with correct headers", async () => {
        const mockStream = {
          pipe: vi.fn(),
        };

        vi.mocked(expenseService.getReceiptFile).mockResolvedValue({
          stream: mockStream as any,
          mimeType: "application/pdf",
          fileName: "test.pdf",
        });

        const req = {
          user: mockEmployeeUser,
          params: { filename: "test.pdf" },
        } as unknown as Request;

        const res = createMockResponse();

        await expenseController.getReceiptFile(req, res);

        expect(res.headers["Content-Type"]).toBe("application/pdf");
        expect(res.headers["Content-Disposition"]).toContain("test.pdf");
        expect(mockStream.pipe).toHaveBeenCalledWith(res);
      });
    });

    describe("getSummary", () => {
      it("should return expense summary metrics", async () => {
        vi.mocked(expenseService.getSummary).mockResolvedValue({
          employee: {
            totalReimbursedThisYear: 1000000,
            pendingPayout: 250000,
            pendingReviewAmount: 150000,
            draftClaimsCount: 1,
            year: 2026,
          },
          finance: {
            queueCount: 3,
            queueTotalAmount: 4500000,
          },
        });

        const req = {
          user: mockAdminUser,
          query: { year: "2026" },
        } as unknown as Request;

        const res = createMockResponse();

        await expenseController.getSummary(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.body.employee.totalReimbursedThisYear).toBe(1000000);
        expect(res.body.finance.queueCount).toBe(3);
      });
    });
  });
});
