import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import { z } from "zod";
import { AppError } from "../src/lib/errors";
import { notFound, errorHandler } from "../src/middleware/errorHandler";

const createTestApp = () => {
  const testApp = express();
  testApp.use(express.json());

  testApp.get("/test/custom-error", () => {
    throw AppError.badRequest("Invalid input parameters", { field: "name" });
  });

  testApp.get("/test/zod-error", () => {
    const schema = z.object({ email: z.string().email() });
    schema.parse({ email: "not-an-email" });
  });

  testApp.get("/test/unauthorized", () => {
    throw AppError.unauthorized();
  });

  testApp.use(notFound);
  testApp.use(errorHandler);

  return testApp;
};

describe("Centralized Error Handler & AppError", () => {
  const testApp = createTestApp();

  it("handles AppError with status code and details", async () => {
    const res = await request(testApp).get("/test/custom-error");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "Invalid input parameters",
      details: { field: "name" },
    });
  });

  it("handles AppError unauthorized with 401", async () => {
    const res = await request(testApp).get("/test/unauthorized");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Unauthorized");
  });

  it("formats Zod validation errors as 400 with field errors", async () => {
    const res = await request(testApp).get("/test/zod-error");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
    expect(res.body.details.fieldErrors.email).toBeDefined();
  });

  it("returns 404 for nonexistent routes via notFound middleware", async () => {
    const res = await request(testApp).get("/nonexistent-endpoint");
    expect(res.status).toBe(404);
    expect(res.body.error).toContain("Cannot GET /nonexistent-endpoint");
  });
});
