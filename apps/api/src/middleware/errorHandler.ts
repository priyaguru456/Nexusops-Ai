import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";
import { env } from "../config/env";

export const notFound = (_req: Request, res: Response, _next: NextFunction): void => {
  res.status(404).json({ error: "Route not found" });
};

export const errorHandler = (
  err: Error & { status?: number },
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  logger.error(err);
  const status = err.status || 500;
  const message =
    env.NODE_ENV === "production" && status === 500
      ? "Internal server error"
      : err.message;

  res.status(status).json({ error: message });
};
