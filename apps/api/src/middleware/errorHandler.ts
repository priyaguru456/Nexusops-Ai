import type { Request, Response, NextFunction } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { logger } from "../lib/logger";
import { env } from "../config/env";
import { AppError } from "../lib/errors";

export const notFound = (req: Request, _res: Response, next: NextFunction): void => {
  next(AppError.notFound(`Cannot ${req.method} ${req.originalUrl}`));
};

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(err, `AppError: ${err.message}`);
    }
    res.status(err.statusCode).json({
      error: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    });
    return;
  }

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({
        error: `File size exceeds the limit of ${env.MAX_UPLOAD_MB}MB`,
      });
      return;
    }
    res.status(400).json({
      error: `File upload error: ${err.message}`,
    });
    return;
  }

  if (err instanceof ZodError) {
    const formatted = err.flatten();
    res.status(400).json({
      error: "Validation failed",
      details: {
        fieldErrors: formatted.fieldErrors,
        formErrors: formatted.formErrors,
      },
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      const target = Array.isArray(err.meta?.target)
        ? (err.meta?.target as string[]).join(", ")
        : String(err.meta?.target ?? "unique field");
      res.status(409).json({
        error: `A record with this ${target} already exists`,
      });
      return;
    }

    if (err.code === "P2025") {
      res.status(404).json({
        error: "Requested record was not found",
      });
      return;
    }

    if (err.code === "P2003") {
      res.status(400).json({
        error: "Foreign key reference violation",
      });
      return;
    }

    logger.error(err, `Prisma error [${err.code}]`);
    res.status(400).json({
      error: "Database operation failed",
      code: err.code,
    });
    return;
  }

  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({
      error: "Malformed JSON payload in request body",
    });
    return;
  }

  const standardError = err instanceof Error ? err : new Error(String(err));
  logger.error(standardError, "Unhandled internal error");

  const isProduction = env.NODE_ENV === "production";
  res.status(500).json({
    error: isProduction ? "Internal server error" : standardError.message,
    ...(!isProduction && standardError.stack ? { stack: standardError.stack } : {}),
  });
};
