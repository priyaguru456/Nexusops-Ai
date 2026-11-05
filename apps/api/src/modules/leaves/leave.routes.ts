import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate, authorize } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { leaveController } from "./leave.controller";
import {
  applyLeaveSchema,
  cancelLeaveSchema,
  leaveIdParamSchema,
  listLeavesQuerySchema,
  leaveBalanceQuerySchema,
  addHolidaySchema,
} from "./leave.schema";

export const leaveRouter = Router();

// All leave endpoints require authentication
leaveRouter.use(authenticate);

// 1. Leave Balance
leaveRouter.get(
  "/balance",
  validate({ query: leaveBalanceQuerySchema }),
  leaveController.getBalance
);

// 2. Company Holidays
leaveRouter.get("/holidays", leaveController.listHolidays);
leaveRouter.post(
  "/holidays",
  authorize(Role.ADMIN),
  validate({ body: addHolidaySchema }),
  leaveController.addHoliday
);

// 3. List Leave Requests (Scoped by Role)
leaveRouter.get(
  "/",
  validate({ query: listLeavesQuerySchema }),
  leaveController.list
);

// 4. Submit New Leave Request
leaveRouter.post(
  "/",
  validate({ body: applyLeaveSchema }),
  leaveController.apply
);

// 5. Individual Leave Actions
leaveRouter.get(
  "/:id",
  validate({ params: leaveIdParamSchema }),
  leaveController.getById
);

leaveRouter.post(
  "/:id/approve",
  authorize(Role.MANAGER, Role.ADMIN),
  validate({ params: leaveIdParamSchema }),
  leaveController.approve
);

leaveRouter.post(
  "/:id/reject",
  authorize(Role.MANAGER, Role.ADMIN),
  validate({ params: leaveIdParamSchema }),
  leaveController.reject
);

leaveRouter.post(
  "/:id/cancel",
  validate({ params: leaveIdParamSchema, body: cancelLeaveSchema }),
  leaveController.cancel
);
