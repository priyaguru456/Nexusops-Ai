import { z } from "zod";
import { ExpenseCategory, ExpenseStatus } from "@prisma/client";

export const expenseCategoryEnum = z.nativeEnum(ExpenseCategory, {
  message: "Category must be TRAVEL, MEALS, SOFTWARE, OFFICE, or OTHER",
});

export const expenseStatusEnum = z.nativeEnum(ExpenseStatus);

export const expenseItemInputSchema = z.object({
  category: expenseCategoryEnum,
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  description: z.string().trim().max(500, "Description must not exceed 500 characters").optional().nullable(),
  date: z
    .string()
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Invalid date format"))
    .or(z.date()),
  receiptUrl: z.string().trim().optional().nullable(),
});

export const createExpenseItemInputSchema = expenseItemInputSchema;

export const updateExpenseItemInputSchema = z.object({
  category: expenseCategoryEnum.optional(),
  amount: z.coerce.number().positive("Amount must be greater than 0").optional(),
  description: z.string().trim().max(500, "Description must not exceed 500 characters").optional().nullable(),
  date: z
    .string()
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Invalid date format"))
    .or(z.date())
    .optional(),
  receiptUrl: z.string().trim().optional().nullable(),
});

export const createExpenseClaimSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters")
    .max(150, "Title must not exceed 150 characters"),
  items: z.array(expenseItemInputSchema).optional().default([]),
  submitImmediately: z.boolean().optional().default(false),
});

export const updateExpenseClaimSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters")
    .max(150, "Title must not exceed 150 characters")
    .optional(),
  items: z.array(expenseItemInputSchema).optional(),
});

export const markAsPaidSchema = z.object({
  paymentReference: z
    .string()
    .trim()
    .min(2, "Payment reference is required and must be at least 2 characters")
    .max(100, "Payment reference must not exceed 100 characters"),
});

export const payExpenseClaimSchema = markAsPaidSchema;

export const expenseIdParamSchema = z.object({
  id: z.string().trim().min(1, "Expense Claim ID is required"),
});

export const claimIdParamSchema = expenseIdParamSchema;

export const claimItemIdParamSchema = z.object({
  id: z.string().trim().min(1, "Expense Claim ID is required"),
  itemId: z.string().trim().min(1, "Expense Item ID is required"),
});

export const listExpensesQuerySchema = z.object({
  status: expenseStatusEnum.optional(),
  tab: z.enum(["my", "finance"]).optional().default("my"),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().optional(),
  employeeId: z.string().trim().optional(),
  sortBy: z.enum(["createdAt", "totalAmount", "status", "submittedAt", "paidAt"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

export type CreateExpenseClaimInput = z.infer<typeof createExpenseClaimSchema>;
export type UpdateExpenseClaimInput = z.infer<typeof updateExpenseClaimSchema>;
export type CreateExpenseItemInput = z.infer<typeof createExpenseItemInputSchema>;
export type UpdateExpenseItemInput = z.infer<typeof updateExpenseItemInputSchema>;
export type PayExpenseClaimInput = z.infer<typeof payExpenseClaimSchema>;
export type ListExpensesQuery = z.infer<typeof listExpensesQuerySchema>;
