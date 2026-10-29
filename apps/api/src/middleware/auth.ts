import type { Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import { AppError } from "../lib/errors";
import { verifyAccessToken } from "../lib/jwt";
import { userRepository } from "../modules/users/user.repository";

export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw AppError.unauthorized("Authentication token required");
    }

    const token = authHeader.split(" ")[1];
    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw AppError.unauthorized("Invalid or expired token");
    }

    const user = await userRepository.findById(payload.sub);
    if (!user) {
      throw AppError.unauthorized("User account no longer exists");
    }

    if (!user.isActive) {
      throw AppError.forbidden("Account is deactivated");
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

export const authorize = (...roles: Role[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(AppError.unauthorized());
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(AppError.forbidden("You do not have permission to perform this action"));
      return;
    }

    next();
  };
};
