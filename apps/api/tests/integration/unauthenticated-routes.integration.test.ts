import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app";

describe("Integration: Security - Every protected /api route without a token returns 401", () => {
  const protectedRoutes = [
    { method: "get" as const, path: "/api/users" },
    { method: "get" as const, path: "/api/requests" },
    { method: "post" as const, path: "/api/requests" },
    { method: "get" as const, path: "/api/tasks" },
    { method: "post" as const, path: "/api/tasks" },
    { method: "get" as const, path: "/api/comments" },
    { method: "post" as const, path: "/api/comments" },
    { method: "get" as const, path: "/api/approvals/pending" },
    { method: "get" as const, path: "/api/notifications" },
    { method: "get" as const, path: "/api/audit-logs" },
    { method: "get" as const, path: "/api/documents" },
    { method: "get" as const, path: "/api/ai/sessions" },
    { method: "post" as const, path: "/api/ai/chat" },
    { method: "get" as const, path: "/api/analytics" },
    { method: "get" as const, path: "/api/search?q=test" },
  ];

  it.each(protectedRoutes)(
    "$method.toUpperCase() $path returns 401 when no token is provided",
    async ({ method, path }) => {
      let reqBuilder;
      if (method === "get") reqBuilder = request(app).get(path);
      else if (method === "post") reqBuilder = request(app).post(path).send({});
      else throw new Error(`Unsupported method ${method}`);

      const res = await reqBuilder;
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Authentication token required|Unauthorized/i);
    }
  );
});
