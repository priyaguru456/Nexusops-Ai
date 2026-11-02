import { describe, it, expect } from "vitest";
import { z } from "zod";
import { AppError } from "../src/lib/errors";
import { notFound, errorHandler } from "../src/middleware/errorHandler";
import type { Request, Response, NextFunction } from "express";

const createMockResponse = () => {
  const res: Partial<Response> & { statusCode?: number; body?: unknown } = {};
  res.status = (code: number) => {
    res.statusCode = code;
    return res as Response;
  };
  res.json = (data: unknown) => {
    res.body = data;
    return res as Response;
  };
  return res as Response & { statusCode: number; body: Record<string, unknown> };
};

describe("Centralized Error Handler & AppError", () => {
  it("handles AppError with status code and details", () => {
    const err = AppError.badRequest("Invalid input parameters", { field: "name" });
    const res = createMockResponse();
    const req = {} as Request;
    const next = (() => {}) as NextFunction;

    errorHandler(err, req, res, next);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      error: "Invalid input parameters",
      details: { field: "name" },
    });
  });

  it("handles AppError unauthorized with 401", () => {
    const err = AppError.unauthorized();
    const res = createMockResponse();
    const req = {} as Request;
    const next = (() => {}) as NextFunction;

    errorHandler(err, req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe("Unauthorized");
  });

  it("formats Zod validation errors as 400 with field errors", () => {
    let zodErr: unknown;
    try {
      const schema = z.object({ email: z.string().email() });
      schema.parse({ email: "not-an-email" });
    } catch (e) {
      zodErr = e;
    }

    const res = createMockResponse();
    const req = {} as Request;
    const next = (() => {}) as NextFunction;

    errorHandler(zodErr, req, res, next);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("Validation failed");
    expect((res.body.details as { fieldErrors: Record<string, unknown> }).fieldErrors.email).toBeDefined();
  });

  it("returns 404 for nonexistent routes via notFound middleware", () => {
    const req = { method: "GET", originalUrl: "/nonexistent-endpoint" } as Request;
    const res = createMockResponse();
    let forwardErr: unknown;
    const next = ((err: unknown) => {
      forwardErr = err;
    }) as NextFunction;

    notFound(req, res, next);
    errorHandler(forwardErr, req, res, next);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toContain("Cannot GET /nonexistent-endpoint");
  });
});
