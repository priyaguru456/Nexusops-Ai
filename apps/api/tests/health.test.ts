import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";

vi.mock("../src/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns status 200 and body.database === 'connected' when DB is reachable", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ "?column?": 1 }]);

    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: "ok",
      service: "nexusops-api",
      database: "connected",
    });
    expect(res.body.timestamp).toBeDefined();
  });

  it("returns status 503 and body.database === 'disconnected' when DB query fails", async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error("Connection refused"));

    const res = await request(app).get("/api/health");

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({
      status: "error",
      service: "nexusops-api",
      database: "disconnected",
      error: "Connection refused",
    });
  });
});
