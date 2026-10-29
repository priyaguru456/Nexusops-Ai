import { Router } from "express";
import { Role } from "@prisma/client";
import { userController } from "./user.controller";
import { authenticate, authorize } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import {
  userIdParamSchema,
  updateRoleSchema,
  updateStatusSchema,
  getUsersQuerySchema,
} from "./user.schema";

export const userRouter = Router();

userRouter.use(authenticate);
userRouter.use(authorize(Role.ADMIN));

userRouter.get(
  "/",
  validate({ query: getUsersQuerySchema }),
  (req, res, next) => userController.getUsers(req, res, next)
);

userRouter.patch(
  "/:id/role",
  validate({ params: userIdParamSchema, body: updateRoleSchema }),
  (req, res, next) => userController.updateRole(req, res, next)
);

userRouter.patch(
  "/:id/status",
  validate({ params: userIdParamSchema, body: updateStatusSchema }),
  (req, res, next) => userController.updateStatus(req, res, next)
);
