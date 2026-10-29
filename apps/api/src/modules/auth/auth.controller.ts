import type { Request, Response, NextFunction } from "express";
import { authService } from "./auth.service";
import { REFRESH_COOKIE_NAME, getRefreshCookieOptions } from "../../lib/jwt";
import { AppError } from "../../lib/errors";

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.register(req.body);
      res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getRefreshCookieOptions());
      res.status(201).json({
        user: result.user,
        accessToken: result.accessToken,
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.login(req.body, {
        ip: req.ip || req.socket.remoteAddress,
        userAgent: req.headers["user-agent"],
      });
      res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getRefreshCookieOptions());
      res.status(200).json({
        user: result.user,
        accessToken: result.accessToken,
      });
    } catch (error) {
      next(error);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
      const result = await authService.refresh(rawRefreshToken);
      res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getRefreshCookieOptions());
      res.status(200).json({
        accessToken: result.accessToken,
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
      const result = await authService.logout(rawRefreshToken);
      res.clearCookie(REFRESH_COOKIE_NAME, getRefreshCookieOptions());
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized();
      }
      const user = await authService.getMe(req.user.id);
      res.status(200).json({ user });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
