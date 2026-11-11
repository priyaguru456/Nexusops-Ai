import { execSync } from "child_process";
import dotenv from "dotenv";
import path from "path";

export default async function globalSetup() {
  dotenv.config();
  if (!process.env.DATABASE_URL) {
    dotenv.config({ path: path.resolve(__dirname, "../../.env") });
    dotenv.config({ path: "apps/api/.env" });
  }

  const devDbUrl = process.env.DATABASE_URL || "";
  const testDbUrl =
    process.env.DATABASE_URL_TEST ||
    devDbUrl.replace(/\/[^/?]+(\?|$)/, "/nexusops_ai_test$1") ||
    "postgresql://postgres:postgres@localhost:5432/nexusops_ai_test?schema=public";

  // DATABASE SAFETY GUARD:
  // Must throw if the database name does not contain "test" or if DATABASE_URL_TEST equals DATABASE_URL
  const parsedDbName = (testDbUrl.split("/").pop() || "").split("?")[0].toLowerCase();

  if (!parsedDbName.includes("test")) {
    throw new Error(
      `FATAL SAFETY GUARD VIOLATION: Test database name '${parsedDbName}' in DATABASE_URL_TEST must contain 'test'. Aborting to protect data!`
    );
  }

  if (devDbUrl && testDbUrl === devDbUrl) {
    throw new Error(
      `FATAL SAFETY GUARD VIOLATION: DATABASE_URL_TEST cannot be identical to dev DATABASE_URL (${devDbUrl}). Aborting to protect dev data!`
    );
  }

  process.env.DATABASE_URL = testDbUrl;
  process.env.DATABASE_URL_TEST = testDbUrl;
  process.env.NODE_ENV = "test";
  process.env.LLM_PROVIDER = "mock";
  process.env.EMBEDDINGS_PROVIDER = "mock";

  console.log(`[GlobalSetup] Verified test database safety: ${parsedDbName}`);

  let dbHost = "127.0.0.1";
  let dbPort = 5432;
  try {
    const parsed = new URL(testDbUrl);
    dbHost = parsed.hostname === "localhost" ? "127.0.0.1" : parsed.hostname || "127.0.0.1";
    dbPort = Number(parsed.port) || 5432;
  } catch {
    // fallback to defaults
  }

  // Quick TCP probe to check if database port is open before calling prisma
  const isPortOpen = await new Promise<boolean>((resolve) => {
    const net = require("net");
    const socket = new net.Socket();
    socket.setTimeout(800);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(dbPort, dbHost);
  });

  const isUnitTestOnly = process.env.npm_lifecycle_event === "test:unit" || process.env.SKIP_DB_MIGRATIONS === "true";
  if (!isPortOpen || isUnitTestOnly) {
    console.log(
      `[GlobalSetup] ${isUnitTestOnly ? "Unit tests requested: skipping database migration." : `Database is not reachable on ${dbHost}:${dbPort}: skipping migration.`}`
    );
    return;
  }

  console.log(`[GlobalSetup] Running prisma migrate deploy against test database...`);

  try {
    const prismaCmd = process.platform === "win32" ? "npx.cmd prisma migrate deploy" : "npx prisma migrate deploy";
    execSync(prismaCmd, {
      stdio: "pipe",
      timeout: 12000,
      env: { ...process.env, DATABASE_URL: testDbUrl },
      cwd: path.resolve(__dirname, "../.."),
    });
    console.log(`[GlobalSetup] Migrations deployed successfully to test database.`);
  } catch (err: any) {
    console.warn(
      `[GlobalSetup] Note: prisma migrate deploy skipped or timed out: ${err.message}`
    );
  }
}
