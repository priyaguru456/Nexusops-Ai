import { beforeEach, afterEach, beforeAll } from "vitest";
import { prisma } from "../../src/lib/prisma";
import { resetRateLimiters } from "../../src/middleware/rateLimiter";
import { setLLMProvider, MockLLMProvider } from "../../src/lib/llm";
import { setEmbeddingsProvider, MockEmbeddingsProvider } from "../../src/lib/embeddings";

// 1. Guard against external LLM and Embeddings API calls
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
      ? input.href
      : (input as any)?.url || "";

  if (url.includes("api.anthropic.com") || url.includes("api.openai.com")) {
    throw new Error(
      `CRITICAL TEST FAILURE: External AI call blocked to: ${url}. All external calls must be mocked!`
    );
  }
  return originalFetch(input, init);
};

// 2. Database safety guard
export function assertTestDatabaseSafety() {
  const testUrl = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL || "";
  const devUrl = process.env.DEV_DATABASE_URL || "";

  const dbName = (testUrl.split("/").pop() || "").split("?")[0].toLowerCase();
  if (!dbName.includes("test")) {
    throw new Error(
      `FATAL SAFETY GUARD VIOLATION: Database name '${dbName}' does not contain 'test'. Tests will not run against non-test databases!`
    );
  }

  if (devUrl && testUrl === devUrl) {
    throw new Error(
      `FATAL SAFETY GUARD VIOLATION: DATABASE_URL_TEST is identical to dev DATABASE_URL. Tests aborted to prevent data loss!`
    );
  }
}

// 3. Table truncation helper between tests
let dbReachableCache: boolean | null = null;
async function isDatabaseReachable(): Promise<boolean> {
  if (dbReachableCache !== null) return dbReachableCache;
  const net = await import("net");
  dbReachableCache = await new Promise<boolean>((resolve) => {
    const s = new net.Socket();
    s.setTimeout(400);
    s.on("connect", () => {
      s.destroy();
      resolve(true);
    });
    s.on("timeout", () => {
      s.destroy();
      resolve(false);
    });
    s.on("error", () => {
      s.destroy();
      resolve(false);
    });
    const dbUrl =
      process.env.DATABASE_URL_TEST ||
      process.env.DATABASE_URL ||
      "postgresql://postgres:postgres@127.0.0.1:5432/nexusops_ai_test";
    let dbHost = "127.0.0.1";
    let dbPort = 5432;
    try {
      const parsed = new URL(dbUrl);
      dbHost = parsed.hostname === "localhost" ? "127.0.0.1" : parsed.hostname || "127.0.0.1";
      dbPort = Number(parsed.port) || 5432;
    } catch {
      // fallback to defaults
    }
    s.connect(dbPort, dbHost);
  });
  return dbReachableCache;
}

export async function truncateAllTables() {
  try {
    if (!(await isDatabaseReachable())) return;
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_prisma_migrations';
    `;
    if (!tables || tables.length === 0) return;

    for (const { tablename } of tables) {
      await prisma.$executeRawUnsafe(
        `TRUNCATE TABLE "${tablename}" RESTART IDENTITY CASCADE;`
      );
    }

    await prisma.organization.upsert({
      where: { slug: "default" },
      update: { isActive: true },
      create: {
        id: "00000000-0000-4000-8000-000000000001",
        name: "NexusOps Default",
        slug: "default",
        isActive: true,
      },
    });
  } catch (err) {
    // If database is not connected or in unit test mode, gracefully ignore
  }
}

// Global beforeAll
beforeAll(async () => {
  assertTestDatabaseSafety();
  // Ensure default mock providers
  setLLMProvider(new MockLLMProvider());
  setEmbeddingsProvider(new MockEmbeddingsProvider());
});

// Per-test hooks
beforeEach(async () => {
  resetRateLimiters();
});

afterEach(async () => {
  // If running against real DB, clean up between tests
  await truncateAllTables();
});
