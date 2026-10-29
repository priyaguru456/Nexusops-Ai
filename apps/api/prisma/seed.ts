import dotenv from "dotenv";
import path from "path";

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import bcrypt from "bcryptjs";
import { PrismaClient, Role, RequestCategory } from "@prisma/client";
import { env } from "../src/config/env";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // 1. Seed 3 Departments
  const itDept = await prisma.department.upsert({
    where: { name: "IT" },
    update: {},
    create: { name: "IT" },
  });

  const hrDept = await prisma.department.upsert({
    where: { name: "HR" },
    update: {},
    create: { name: "HR" },
  });

  const financeDept = await prisma.department.upsert({
    where: { name: "Finance" },
    update: {},
    create: { name: "Finance" },
  });

  console.log("✓ Departments seeded: IT, HR, Finance");

  // 2. Demo user credentials (Password: Password@123)
  const rounds = env.BCRYPT_ROUNDS || 10;
  const passwordHash = await bcrypt.hash("Password@123", rounds);

  // 1 Admin
  const admin = await prisma.user.upsert({
    where: { email: "admin@nexusops.com" },
    update: {
      name: "Admin User",
      role: Role.ADMIN,
      departmentId: itDept.id,
      isActive: true,
      passwordHash,
    },
    create: {
      name: "Admin User",
      email: "admin@nexusops.com",
      passwordHash,
      role: Role.ADMIN,
      departmentId: itDept.id,
      isActive: true,
    },
  });

  // 2 Managers
  const managerIT = await prisma.user.upsert({
    where: { email: "manager.it@nexusops.com" },
    update: {
      name: "IT Manager",
      role: Role.MANAGER,
      departmentId: itDept.id,
      isActive: true,
      passwordHash,
    },
    create: {
      name: "IT Manager",
      email: "manager.it@nexusops.com",
      passwordHash,
      role: Role.MANAGER,
      departmentId: itDept.id,
      isActive: true,
    },
  });

  const managerHR = await prisma.user.upsert({
    where: { email: "manager.hr@nexusops.com" },
    update: {
      name: "HR Manager",
      role: Role.MANAGER,
      departmentId: hrDept.id,
      isActive: true,
      passwordHash,
    },
    create: {
      name: "HR Manager",
      email: "manager.hr@nexusops.com",
      passwordHash,
      role: Role.MANAGER,
      departmentId: hrDept.id,
      isActive: true,
    },
  });

  // Backward compatibility alias for single manager@nexusops.com
  await prisma.user.upsert({
    where: { email: "manager@nexusops.com" },
    update: {
      name: "Main Manager",
      role: Role.MANAGER,
      departmentId: itDept.id,
      isActive: true,
      passwordHash,
    },
    create: {
      name: "Main Manager",
      email: "manager@nexusops.com",
      passwordHash,
      role: Role.MANAGER,
      departmentId: itDept.id,
      isActive: true,
    },
  });

  // 5 Employees
  const employeeData = [
    {
      name: "Alex Morgan",
      email: "employee.it1@nexusops.com",
      departmentId: itDept.id,
      managerId: managerIT.id,
    },
    {
      name: "Brian Lee",
      email: "employee.it2@nexusops.com",
      departmentId: itDept.id,
      managerId: managerIT.id,
    },
    {
      name: "Chloe Davis",
      email: "employee.hr1@nexusops.com",
      departmentId: hrDept.id,
      managerId: managerHR.id,
    },
    {
      name: "David Patel",
      email: "employee.fin1@nexusops.com",
      departmentId: financeDept.id,
      managerId: managerIT.id,
    },
    {
      name: "Elena Garcia",
      email: "employee.fin2@nexusops.com",
      departmentId: financeDept.id,
      managerId: managerHR.id,
    },
  ];

  for (const emp of employeeData) {
    await prisma.user.upsert({
      where: { email: emp.email },
      update: {
        name: emp.name,
        role: Role.EMPLOYEE,
        departmentId: emp.departmentId,
        managerId: emp.managerId,
        isActive: true,
        passwordHash,
      },
      create: {
        name: emp.name,
        email: emp.email,
        passwordHash,
        role: Role.EMPLOYEE,
        departmentId: emp.departmentId,
        managerId: emp.managerId,
        isActive: true,
      },
    });
  }

  // Backward compatibility alias for employee@nexusops.com
  await prisma.user.upsert({
    where: { email: "employee@nexusops.com" },
    update: {
      name: "Demo Employee",
      role: Role.EMPLOYEE,
      departmentId: itDept.id,
      managerId: managerIT.id,
      isActive: true,
      passwordHash,
    },
    create: {
      name: "Demo Employee",
      email: "employee@nexusops.com",
      passwordHash,
      role: Role.EMPLOYEE,
      departmentId: itDept.id,
      managerId: managerIT.id,
      isActive: true,
    },
  });

  console.log("✓ Users seeded: 1 Admin, 2 Managers, 5 Employees (Password: Password@123)");

  // 3. Default Approval Flows: IT, HR, Finance, Facilities
  const flows = [
    {
      name: "IT Request Approval Flow",
      category: RequestCategory.IT,
      minAmount: null,
      steps: [{ stepOrder: 1, approverRole: Role.MANAGER }],
    },
    {
      name: "HR Request Approval Flow",
      category: RequestCategory.HR,
      minAmount: null,
      steps: [{ stepOrder: 1, approverRole: Role.MANAGER }],
    },
    {
      name: "Finance & Purchase Approval Flow",
      category: RequestCategory.FINANCE,
      minAmount: 1000,
      steps: [
        { stepOrder: 1, approverRole: Role.MANAGER },
        { stepOrder: 2, approverRole: Role.ADMIN },
      ],
    },
    {
      name: "Facilities Request Approval Flow",
      category: RequestCategory.FACILITIES,
      minAmount: null,
      steps: [{ stepOrder: 1, approverRole: Role.MANAGER }],
    },
  ];

  for (const flowData of flows) {
    const existing = await prisma.approvalFlow.findFirst({
      where: { category: flowData.category },
      include: { steps: true },
    });

    if (existing) {
      await prisma.approvalFlowStep.deleteMany({
        where: { flowId: existing.id },
      });
      await prisma.approvalFlow.update({
        where: { id: existing.id },
        data: {
          name: flowData.name,
          minAmount: flowData.minAmount,
          steps: {
            create: flowData.steps,
          },
        },
      });
    } else {
      await prisma.approvalFlow.create({
        data: {
          name: flowData.name,
          category: flowData.category,
          minAmount: flowData.minAmount,
          steps: {
            create: flowData.steps,
          },
        },
      });
    }
  }

  console.log("✓ Approval Flows seeded: IT, HR, Finance, Facilities");
  console.log("Database seed completed successfully.");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
