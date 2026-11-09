import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { handleReceiptUpload } from "./expense.upload";
import { expenseController } from "./expense.controller";
import {
  createExpenseClaimSchema,
  updateExpenseClaimSchema,
  createExpenseItemInputSchema,
  updateExpenseItemInputSchema,
  markAsPaidSchema,
  expenseIdParamSchema,
  claimItemIdParamSchema,
  listExpensesQuerySchema,
} from "./expense.schema";

export const expenseRouter = Router();

// All expense endpoints require authentication
expenseRouter.use(authenticate);

// 1. Employee / Finance Summary Cards
expenseRouter.get("/summary", expenseController.getSummary);

// 2. Receipt upload & streaming
expenseRouter.post(
  "/upload-receipt",
  handleReceiptUpload,
  expenseController.uploadReceipt
);

expenseRouter.get(
  "/receipts/:filename",
  expenseController.getReceiptFile
);

// 3. List Expenses (Scoped by Role & tab)
expenseRouter.get(
  "/",
  validate({ query: listExpensesQuerySchema }),
  expenseController.list
);

// 4. Create New Expense Report
expenseRouter.post(
  "/",
  validate({ body: createExpenseClaimSchema }),
  expenseController.create
);

// 5. Individual Expense Actions
expenseRouter.get(
  "/:id",
  validate({ params: expenseIdParamSchema }),
  expenseController.getById
);

expenseRouter.patch(
  "/:id",
  validate({ params: expenseIdParamSchema, body: updateExpenseClaimSchema }),
  expenseController.update
);

expenseRouter.delete(
  "/:id",
  validate({ params: expenseIdParamSchema }),
  expenseController.delete
);

// 6. Expense Items Management
expenseRouter.post(
  "/:id/items",
  validate({ params: expenseIdParamSchema, body: createExpenseItemInputSchema }),
  expenseController.addItem
);

expenseRouter.patch(
  "/:id/items/:itemId",
  validate({ params: claimItemIdParamSchema, body: updateExpenseItemInputSchema }),
  expenseController.updateItem
);

expenseRouter.delete(
  "/:id/items/:itemId",
  validate({ params: claimItemIdParamSchema }),
  expenseController.deleteItem
);

// 7. Submit Claim for Approval
expenseRouter.post(
  "/:id/submit",
  validate({ params: expenseIdParamSchema }),
  expenseController.submit
);

// 8. Finance Queue Action: Mark as Paid (Finance or Admin only)
expenseRouter.post(
  "/:id/pay",
  validate({
    params: expenseIdParamSchema,
    body: markAsPaidSchema,
  }),
  expenseController.pay
);
