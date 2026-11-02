import { Router } from "express";
import { Role } from "@prisma/client";
import { userController } from "./user.controller";
import { authenticate, authorize } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { passwordChangeRateLimiter } from "../../middleware/rateLimiter";
import {
  userIdParamSchema,
  updateRoleSchema,
  updateStatusSchema,
  getUsersQuerySchema,
  updateProfileSchema,
  changePasswordSchema,
} from "./user.schema";

export const userRouter = Router();

// All user routes require authentication
userRouter.use(authenticate);

// --- Self Profile & Password Routes (Any Authenticated Role) ---
userRouter.patch(
  "/me",
  validate({ body: updateProfileSchema }),
  (req, res, next) => userController.updateProfile(req, res, next)
);

userRouter.post(
  "/me/password",
  passwordChangeRateLimiter,
  validate({ body: changePasswordSchema }),
  (req, res, next) => userController.changePassword(req, res, next)
);

// --- Admin-Only User Management Routes ---
userRouter.get(
  "/",
  authorize(Role.ADMIN),
  validate({ query: getUsersQuerySchema }),
  (req, res, next) => userController.getUsers(req, res, next)
);

userRouter.patch(
  "/:id/role",
  authorize(Role.ADMIN),
  validate({ params: userIdParamSchema, body: updateRoleSchema }),
  (req, res, next) => userController.updateRole(req, res, next)
);

userRouter.patch(
  "/:id/status",
  authorize(Role.ADMIN),
  validate({ params: userIdParamSchema, body: updateStatusSchema }),
  (req, res, next) => userController.updateStatus(req, res, next)
);
