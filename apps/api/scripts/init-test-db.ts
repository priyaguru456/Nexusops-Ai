import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";
import dotenv from "dotenv";
import path from "path";

dotenv.config();
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(__dirname, "../../.env") });
  dotenv.config({ path: "apps/api/.env" });
}

async function main() {
  const mainUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/nexusops_ai?schema=public";
  const testDbName = "nexusops_ai_test";

  console.log(`Ensuring test database '${testDbName}' exists...`);

  // Connect to default DB to create test DB
  const adminClient = new PrismaClient({
    datasources: { db: { url: mainUrl } },
  });

  try {
    const existing = await adminClient.$queryRawUnsafe<Array<{ datname: string }>>(
      `SELECT datname FROM pg_database WHERE datname = '${testDbName}';`
    );

    if (!existing || existing.length === 0) {
      await adminClient.$executeRawUnsafe(`CREATE DATABASE "${testDbName}";`);
      console.log(`Database '${testDbName}' created successfully.`);
    } else {
      console.log(`Database '${testDbName}' already exists.`);
    }
  } catch (err: any) {
    console.warn(`Note when checking database: ${err.message}`);
  } finally {
    await adminClient.$disconnect();
  }

  // Connect to test DB to ensure pgvector is enabled
  const testUrl =
    process.env.DATABASE_URL_TEST ||
    mainUrl.replace(/\/[^/?]+(\?|$)/, `/${testDbName}$1`);

  const testClient = new PrismaClient({
    datasources: { db: { url: testUrl } },
  });

  try {
    await testClient.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector;`);
    console.log(`Extension 'vector' enabled on '${testDbName}'.`);
  } catch (err: any) {
    console.warn(`Warning creating vector extension: ${err.message}`);
  } finally {
    await testClient.$disconnect();
  }

  console.log("Running prisma migrate deploy on test database...");
  try {
    execSync("npx prisma migrate deploy", {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: testUrl },
    });
    console.log("Test database schema migrated successfully.");
  } catch (err: any) {
    console.error("Migration failed:", err.message);
    throw err;
  }
}

main().catch((err) => {
  console.error("Failed to initialize test database:", err);
  process.exit(1);
});
