import fs from "fs";
import { describe, it, expect } from "vitest";
import { loadOpenApiSpec, resolveOpenApiSpecPath } from "../../src/lib/openapi";

describe("OpenAPI & Swagger Specification", () => {
  it("resolves docs/openapi.yaml on disk and loads a valid OpenAPI 3.0.3 document", () => {
    const specPath = resolveOpenApiSpecPath();
    expect(fs.existsSync(specPath)).toBe(true);

    const spec = loadOpenApiSpec(true) as {
      openapi: string;
      info: { title: string; version: string };
      paths: Record<string, unknown>;
      components: {
        securitySchemes: Record<string, unknown>;
        schemas: { Role?: { enum?: string[] } };
      };
    };

    expect(spec.openapi).toMatch(/^3\.0\./);
    expect(spec.info.title).toContain("NexusOps AI");
    expect(spec.components.securitySchemes).toHaveProperty("bearerAuth");
    expect(spec.components.securitySchemes).toHaveProperty("refreshCookie");
    expect(spec.components.schemas.Role?.enum).toEqual([
      "EMPLOYEE",
      "MANAGER",
      "ADMIN",
      "SUPER_ADMIN",
    ]);
  });

  it("documents core auth recovery, multi-tenancy, workflow, document, and AI endpoints", () => {
    const spec = loadOpenApiSpec() as {
      paths: Record<string, Record<string, unknown>>;
    };

    const requiredPaths = [
      "/health",
      "/auth/login",
      "/auth/register",
      "/auth/forgot-password",
      "/auth/reset-password",
      "/organizations",
      "/organizations/{id}",
      "/requests",
      "/tasks",
      "/approvals/pending",
      "/documents",
      "/ai/chat",
      "/analytics/overview",
      "/audit-logs",
    ];

    for (const p of requiredPaths) {
      expect(spec.paths, `Missing OpenAPI path: ${p}`).toHaveProperty(p);
    }

    expect(spec.paths["/auth/forgot-password"]).toHaveProperty("post");
    expect(spec.paths["/auth/reset-password"]).toHaveProperty("post");
    expect(spec.paths["/organizations"]).toHaveProperty("get");
    expect(spec.paths["/organizations"]).toHaveProperty("post");
    expect(spec.paths["/organizations/{id}"]).toHaveProperty("patch");
  });

  it("mounts /api/docs.json and /api/docs routes inside the Express app", async () => {
    const { app } = await import("../../src/app");
    const stack = (
      app as unknown as {
        router?: {
          stack?: Array<{
            route?: { path?: string };
            regexp?: RegExp;
            match?: (path: string) => boolean;
          }>;
        };
      }
    ).router?.stack;

    expect(Array.isArray(stack)).toBe(true);
    const hasDocsJson = stack?.some((layer) => layer.route?.path === "/api/docs.json");
    const hasDocsUi = stack?.some((layer) =>
      typeof layer.match === "function"
        ? layer.match("/api/docs")
        : Boolean(layer.regexp?.test("/api/docs"))
    );

    expect(hasDocsJson).toBe(true);
    expect(hasDocsUi).toBe(true);
  });
});
