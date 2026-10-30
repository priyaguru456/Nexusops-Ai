import rateLimit from "express-rate-limit";
import { AppError } from "../lib/errors";
import { env } from "../config/env";

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const email = typeof req.body?.email === "string" ? req.body.email.toLowerCase().trim() : "";
    return `${ip}_${email}`;
  },
  skip: (req) => {
    if (env.NODE_ENV === "test" && req.headers["x-test-rate-limit"] !== "true") {
      return true;
    }
    return false;
  },
  handler: (_req, _res, next) => {
    next(new AppError("Too many login attempts. Please try again after 15 minutes.", 429));
  },
});

export const aiChatRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 30, // 30 requests per 15 minutes per user
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => {
    // Rate limit per authenticated user ID, fallback to IP
    const user = (req as any).user;
    if (user?.id) {
      return `user_${user.id}`;
    }
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    return `ip_${ip}`;
  },
  skip: (req) => {
    if (env.NODE_ENV === "test" && req.headers["x-test-rate-limit"] !== "true") {
      return true;
    }
    return false;
  },
  handler: (_req, _res, next) => {
    next(new AppError("Too many AI requests. Please try again after 15 minutes.", 429));
  },
});
