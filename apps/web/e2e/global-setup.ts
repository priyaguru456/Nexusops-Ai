import { PrismaClient, Role, RequestCategory } from "@prisma/client";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import path from "path";

dotenv.config();
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(__dirname, "../../api/.env") });
  dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
}

export default async function globalSetup() {
  const testDbUrl =
    process.env.DATABASE_URL_TEST ||
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/nexusops_ai_test?schema=public";

  // SAFETY GUARD:
  const dbName = (testDbUrl.split("/").pop() || "").split("?")[0].toLowerCase();
  if (!dbName.includes("test")) {
    throw new Error(
      `FATAL SAFETY GUARD: E2E global-setup refused to run on non-test DB: ${dbName}`
    );
  }

  console.log(`[E2E Global Setup] Seeding deterministic test database: ${dbName}`);

  const prisma = new PrismaClient({
    datasources: { db: { url: testDbUrl } },
  });

  try {
    // 1. Reset tables
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_prisma_migrations';
    `;
    for (const { tablename } of tables) {
      await prisma.$executeRawUnsafe(
        `TRUNCATE TABLE "${tablename}" RESTART IDENTITY CASCADE;`
      );
    }

    // 2. Default Organization & Department
    const defaultOrg = await prisma.organization.create({
      data: {
        id: "00000000-0000-4000-8000-000000000001",
        name: "NexusOps Default",
        slug: "default",
        isActive: true,
      },
    });

    const itDept = await prisma.department.create({
      data: {
        name: "Engineering",
        organizationId: defaultOrg.id,
      },
    });

    const passwordHash = await bcrypt.hash("Password123!", 10);

    // 3. Known users
    await prisma.user.create({
      data: {
        name: "Platform Super Admin",
        email: "superadmin@nexusops.com",
        passwordHash,
        role: Role.SUPER_ADMIN,
        organizationId: null,
        isActive: true,
      },
    });

    await prisma.user.create({
      data: {
        name: "Alice Admin",
        email: "admin@nexusops.com",
        passwordHash,
        role: Role.ADMIN,
        organizationId: defaultOrg.id,
        departmentId: itDept.id,
        isActive: true,
      },
    });

    const manager = await prisma.user.create({
      data: {
        name: "Bob Manager",
        email: "manager@nexusops.com",
        passwordHash,
        role: Role.MANAGER,
        organizationId: defaultOrg.id,
        departmentId: itDept.id,
        isActive: true,
      },
    });

    await prisma.user.create({
      data: {
        name: "Charlie Employee",
        email: "employee@nexusops.com",
        passwordHash,
        role: Role.EMPLOYEE,
        organizationId: defaultOrg.id,
        departmentId: itDept.id,
        managerId: manager.id,
        isActive: true,
      },
    });

    // 4. Seed approval flow
    await prisma.approvalFlow.create({
      data: {
        name: "Standard IT Request Flow",
        organizationId: defaultOrg.id,
        category: RequestCategory.IT,
        steps: {
          create: [{ stepOrder: 1, approverRole: Role.MANAGER }],
        },
      },
    });

    console.log("[E2E Global Setup] Test database seeded successfully.");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[E2E Global Setup] Note: DB setup skipped or failed: ${message}`);
  } finally {
    await prisma.$disconnect();
  }
}
