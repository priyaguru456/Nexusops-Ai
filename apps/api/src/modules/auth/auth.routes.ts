import { Router } from "express";
import { authController } from "./auth.controller";
import { validate } from "../../middleware/validate";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "./auth.schema";
import { authenticate } from "../../middleware/auth";
import {
  loginRateLimiter,
  passwordChangeRateLimiter,
  forgotPasswordRateLimiter,
} from "../../middleware/rateLimiter";

import { userController } from "../users/user.controller";
import { updateProfileSchema, changePasswordSchema } from "../users/user.schema";

export const authRouter = Router();

authRouter.post("/register", validate({ body: registerSchema }), (req, res, next) =>
  authController.register(req, res, next)
);

authRouter.post("/login", loginRateLimiter, validate({ body: loginSchema }), (req, res, next) =>
  authController.login(req, res, next)
);

authRouter.post("/refresh", (req, res, next) => authController.refresh(req, res, next));

authRouter.post("/logout", (req, res, next) => authController.logout(req, res, next));

authRouter.post(
  "/forgot-password",
  forgotPasswordRateLimiter,
  validate({ body: forgotPasswordSchema }),
  (req, res, next) => authController.forgotPassword(req, res, next)
);

authRouter.post(
  "/reset-password",
  validate({ body: resetPasswordSchema }),
  (req, res, next) => authController.resetPassword(req, res, next)
);

authRouter.get("/me", authenticate, (req, res, next) => authController.getMe(req, res, next));

authRouter.patch(
  "/me",
  authenticate,
  validate({ body: updateProfileSchema }),
  (req, res, next) => userController.updateProfile(req, res, next)
);

authRouter.post(
  "/change-password",
  authenticate,
  passwordChangeRateLimiter,
  validate({ body: changePasswordSchema }),
  (req, res, next) => userController.changePassword(req, res, next)
);
