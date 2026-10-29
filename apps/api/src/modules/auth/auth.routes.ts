import { Router } from "express";
import { authController } from "./auth.controller";
import { validate } from "../../middleware/validate";
import { registerSchema, loginSchema } from "./auth.schema";
import { authenticate } from "../../middleware/auth";
import { loginRateLimiter } from "../../middleware/rateLimiter";

export const authRouter = Router();

authRouter.post("/register", validate({ body: registerSchema }), (req, res, next) =>
  authController.register(req, res, next)
);

authRouter.post("/login", loginRateLimiter, validate({ body: loginSchema }), (req, res, next) =>
  authController.login(req, res, next)
);

authRouter.post("/refresh", (req, res, next) => authController.refresh(req, res, next));

authRouter.post("/logout", (req, res, next) => authController.logout(req, res, next));

authRouter.get("/me", authenticate, (req, res, next) => authController.getMe(req, res, next));
