import type { Request, Response, NextFunction } from "express";
import { userService } from "./user.service";
import { AppError } from "../../lib/errors";

export class UserController {
  async getUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await userService.getUsers(req.query, req.user);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async updateRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }
      const targetUserId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const updatedUser = await userService.updateRole(
        req.user.id,
        targetUserId,
        req.body.role,
        req.user
      );
      res.status(200).json({ user: updatedUser });
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }
      const targetUserId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const updatedUser = await userService.updateStatus(
        req.user.id,
        targetUserId,
        req.body.isActive,
        req.user
      );
      res.status(200).json({ user: updatedUser });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/users/me (or /api/auth/me)
   * Self profile update (strict name only).
   */
  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }
      const updatedUser = await userService.updateProfile(req.user.id, req.body.name);
      res.status(200).json({ user: updatedUser });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/users/me/password
   * Self password change.
   */
  async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }
      const result = await userService.changePassword(
        req.user.id,
        req.body.currentPassword,
        req.body.newPassword
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const userController = new UserController();
