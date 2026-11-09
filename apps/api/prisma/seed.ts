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

  // 3. Default Approval Flows: IT, HR, Finance (tiered), Facilities
  const flows = [
    {
      name: "IT Standard Approval Flow",
      category: RequestCategory.IT,
      minAmount: 0,
      maxAmount: null,
      isActive: true,
      steps: [{ stepOrder: 1, approverRole: Role.MANAGER }],
    },
    {
      name: "HR Standard Approval Flow",
      category: RequestCategory.HR,
      minAmount: 0,
      maxAmount: null,
      isActive: true,
      steps: [{ stepOrder: 1, approverRole: Role.MANAGER }],
    },
    {
      name: "Finance Standard Approval Flow (Up to 1000)",
      category: RequestCategory.FINANCE,
      minAmount: 0,
      maxAmount: 1000,
      isActive: true,
      steps: [{ stepOrder: 1, approverRole: Role.MANAGER }],
    },
    {
      name: "Finance High-Value Approval Flow (> 1000)",
      category: RequestCategory.FINANCE,
      minAmount: 1000.01,
      maxAmount: null,
      isActive: true,
      steps: [
        { stepOrder: 1, approverRole: Role.MANAGER },
        { stepOrder: 2, approverRole: Role.ADMIN },
      ],
    },
    {
      name: "Facilities Standard Approval Flow",
      category: RequestCategory.FACILITIES,
      minAmount: 0,
      maxAmount: null,
      isActive: true,
      steps: [{ stepOrder: 1, approverRole: Role.MANAGER }],
    },
  ];

  for (const flowData of flows) {
    const existing = await prisma.approvalFlow.findFirst({
      where: { name: flowData.name },
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
          category: flowData.category,
          minAmount: flowData.minAmount,
          maxAmount: flowData.maxAmount,
          isActive: flowData.isActive,
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
          maxAmount: flowData.maxAmount,
          isActive: flowData.isActive,
          steps: {
            create: flowData.steps,
          },
        },
      });
    }
  }

  console.log("✓ Approval Flows seeded: IT, HR, Finance, Facilities");

  // 5. Seed sample Audit Logs for testing
  const auditCount = await prisma.auditLog.count();
  if (auditCount === 0) {
    const sampleAuditLogs = [
      {
        actorId: admin.id,
        action: "USER_LOGIN",
        entityType: "User",
        entityId: admin.id,
        summary: "User admin@nexusops.com logged in",
        ipAddress: "127.0.0.1",
        metadata: { method: "credentials", userAgent: "Mozilla/5.0" },
        createdAt: new Date(Date.now() - 3600000 * 24),
      },
      {
        actorId: admin.id,
        action: "ROLE_CHANGE",
        entityType: "User",
        entityId: managerIT.id,
        summary: "Updated user role to MANAGER",
        ipAddress: "127.0.0.1",
        metadata: { previousRole: "EMPLOYEE", newRole: "MANAGER" },
        createdAt: new Date(Date.now() - 3600000 * 12),
      },
      {
        actorId: managerIT.id,
        action: "REQUEST_CREATED",
        entityType: "WorkRequest",
        entityId: "req-seed-1",
        summary: 'Created request "High-performance Workstation Setup"',
        ipAddress: "192.168.1.50",
        metadata: { title: "High-performance Workstation Setup", category: "IT", priority: "HIGH" },
        createdAt: new Date(Date.now() - 3600000 * 6),
      },
      {
        actorId: admin.id,
        action: "REQUEST_APPROVED",
        entityType: "WorkRequest",
        entityId: "req-seed-1",
        summary: 'Approved request "High-performance Workstation Setup"',
        ipAddress: "127.0.0.1",
        metadata: { finalStepOrder: 1, autoTaskId: "task-seed-1" },
        createdAt: new Date(Date.now() - 3600000 * 2),
      },
    ];

    for (const log of sampleAuditLogs) {
      await prisma.auditLog.create({
        data: log,
      });
    }
    console.log("✓ Sample Audit Logs seeded");
  }

  // 7. Seed Announcements
  try {
    await prisma.announcement.upsert({
      where: { id: "announcement-seed-1" },
      update: {},
      create: {
        id: "announcement-seed-1",
        title: "All-Hands Operations Briefing: Q4 Strategic Roadmaps",
        content: `### Welcome to NexusOps Q4 All-Hands\n\nPlease join executive leadership this Thursday at **3:00 PM IST**.\n\n- **Agenda:** Platform scaling, AI assistance, and department operational efficiency.\n- **Location:** Virtual Boardroom (Google Meet)\n\n> Please submit questions to your departmental manager by Wednesday evening.`,
        priority: "URGENT",
        isPinned: true,
        authorId: admin.id,
        createdAt: new Date(Date.now() - 3600000 * 24),
      },
    });

    await prisma.announcement.upsert({
      where: { id: "announcement-seed-2" },
      update: {},
      create: {
        id: "announcement-seed-2",
        title: "Scheduled Maintenance: Core Database Infrastructure",
        content: `The IT Department will perform scheduled routine database maintenance this Saturday between **01:00 AM and 03:00 AM IST**.\n\nSystems may experience brief read-only modes during failover testing.`,
        priority: "NORMAL",
        isPinned: true,
        targetDepartmentId: itDept.id,
        authorId: managerIT.id,
        createdAt: new Date(Date.now() - 3600000 * 12),
      },
    });

    await prisma.announcement.upsert({
      where: { id: "announcement-seed-3" },
      update: {},
      create: {
        id: "announcement-seed-3",
        title: "New Annual Wellness & Leave Policy Updates",
        content: `HR has updated the employee benefits guide for the upcoming fiscal calendar. Review the full documentation under the **Knowledge Base** tab.`,
        priority: "NORMAL",
        isPinned: false,
        targetDepartmentId: null, // Everyone
        authorId: managerHR.id,
        createdAt: new Date(Date.now() - 3600000 * 6),
      },
    });

    await prisma.announcementRead.upsert({
      where: {
        announcementId_userId: {
          announcementId: "announcement-seed-1",
          userId: admin.id,
        },
      },
      update: {},
      create: {
        announcementId: "announcement-seed-1",
        userId: admin.id,
        readAt: new Date(),
      },
    });

    console.log("✓ Sample Announcements seeded");
  } catch (err) {
    console.warn("Announcement seed skipped:", err);
  }

  // 17. Seed Assets and Asset Assignments
  try {
    const demoEmployee = await prisma.user.findUnique({
      where: { email: "employee@nexusops.com" },
    });

    const now = new Date();
    const daysFromNow = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    // 1. Assigned Laptop (MacBook Pro)
    const asset1 = await prisma.asset.upsert({
      where: { id: "asset-seed-1" },
      update: {},
      create: {
        id: "asset-seed-1",
        name: "MacBook Pro 16-inch M3 Pro",
        type: "LAPTOP",
        serialNumber: "MBP16-2024-001",
        status: "ASSIGNED",
        purchaseDate: daysFromNow(-180),
        warrantyExpiresAt: daysFromNow(365),
        notes: "Engineering grade primary workstation. Configured with 36GB RAM / 1TB SSD.",
      },
    });

    // 2. Assigned Monitor (Dell UltraSharp - Expiring soon <= 30 days)
    const asset2 = await prisma.asset.upsert({
      where: { id: "asset-seed-2" },
      update: {},
      create: {
        id: "asset-seed-2",
        name: "Dell UltraSharp 27-inch 4K (U2723QE)",
        type: "MONITOR",
        serialNumber: "DELL-4K-99214",
        status: "ASSIGNED",
        purchaseDate: daysFromNow(-345),
        warrantyExpiresAt: daysFromNow(20), // Expiring in 20 days!
        notes: "IPS Black USB-C Hub Monitor with 90W power delivery.",
      },
    });

    // 3. Available Laptop
    await prisma.asset.upsert({
      where: { id: "asset-seed-3" },
      update: {},
      create: {
        id: "asset-seed-3",
        name: "Lenovo ThinkPad X1 Carbon Gen 11",
        type: "LAPTOP",
        serialNumber: "LEN-X1C-44012",
        status: "AVAILABLE",
        purchaseDate: daysFromNow(-60),
        warrantyExpiresAt: daysFromNow(730),
        notes: "Intel Core i7, 32GB RAM, 512GB SSD. Ready for deployment.",
      },
    });

    // 4. Available Phone
    await prisma.asset.upsert({
      where: { id: "asset-seed-4" },
      update: {},
      create: {
        id: "asset-seed-4",
        name: "Apple iPhone 15 Pro (256GB Black Titanium)",
        type: "PHONE",
        serialNumber: "IPH15P-88129",
        status: "AVAILABLE",
        purchaseDate: daysFromNow(-90),
        warrantyExpiresAt: daysFromNow(275),
        notes: "Executive testing and mobile security device.",
      },
    });

    // 5. Available License (Expiring in 10 days)
    await prisma.asset.upsert({
      where: { id: "asset-seed-5" },
      update: {},
      create: {
        id: "asset-seed-5",
        name: "JetBrains All Products Pack Enterprise License",
        type: "LICENSE",
        serialNumber: "JB-APP-2026-NEXUS",
        status: "AVAILABLE",
        purchaseDate: daysFromNow(-355),
        warrantyExpiresAt: daysFromNow(10), // Expiring in 10 days
        notes: "Corporate floating seat subscription.",
      },
    });

    // 6. In Repair Accessory (Expired Warranty)
    await prisma.asset.upsert({
      where: { id: "asset-seed-6" },
      update: {},
      create: {
        id: "asset-seed-6",
        name: "Logitech MX Master 3S Wireless Mouse",
        type: "ACCESSORY",
        serialNumber: "LOGI-MX3S-5512",
        status: "IN_REPAIR",
        purchaseDate: daysFromNow(-450),
        warrantyExpiresAt: daysFromNow(-90), // Expired 90 days ago
        notes: "Scroll wheel replacement in progress at vendor service center.",
      },
    });

    // 7. Retired Asset
    await prisma.asset.upsert({
      where: { id: "asset-seed-7" },
      update: {},
      create: {
        id: "asset-seed-7",
        name: "Dell Latitude 5420 (Legacy)",
        type: "LAPTOP",
        serialNumber: "DELL-LAT-2019-88",
        status: "RETIRED",
        purchaseDate: daysFromNow(-1200),
        warrantyExpiresAt: daysFromNow(-400),
        notes: "Decommissioned after standard 4-year lifecycle refresh. Storage wiped.",
      },
    });

    // 8. Available Accessory
    await prisma.asset.upsert({
      where: { id: "asset-seed-8" },
      update: {},
      create: {
        id: "asset-seed-8",
        name: "Apple Magic Keyboard with Touch ID and Numeric Keypad",
        type: "ACCESSORY",
        serialNumber: "APL-KB-7712",
        status: "AVAILABLE",
        purchaseDate: daysFromNow(-30),
        warrantyExpiresAt: daysFromNow(335),
        notes: "Space Gray colorway with USB-C to Lightning cable.",
      },
    });

    // Assignments for employee
    if (demoEmployee) {
      await prisma.assetAssignment.upsert({
        where: { id: "assignment-seed-1" },
        update: {},
        create: {
          id: "assignment-seed-1",
          assetId: asset1.id,
          userId: demoEmployee.id,
          assignedById: admin.id,
          assignedAt: daysFromNow(-120),
          returnedAt: null, // Active assignment
          notes: "Issued during new hire developer onboarding.",
        },
      });

      await prisma.assetAssignment.upsert({
        where: { id: "assignment-seed-2" },
        update: {},
        create: {
          id: "assignment-seed-2",
          assetId: asset2.id,
          userId: demoEmployee.id,
          assignedById: admin.id,
          assignedAt: daysFromNow(-90),
          returnedAt: null, // Active assignment
          notes: "Ergonomic dual-display setup request.",
        },
      });

      // Historical completed assignment (returned)
      await prisma.assetAssignment.upsert({
        where: { id: "assignment-seed-3" },
        update: {},
        create: {
          id: "assignment-seed-3",
          assetId: "asset-seed-3", // ThinkPad
          userId: demoEmployee.id,
          assignedById: admin.id,
          assignedAt: daysFromNow(-200),
          returnedAt: daysFromNow(-125), // Returned in the past
          notes: "Temporary loaner while MacBook was on order.",
        },
      });
    }

    console.log("✓ Assets & Asset Assignments seeded successfully");
  } catch (err) {
    console.warn("Asset seed skipped:", err);
  }

  // 18. Seed Policy Documents & Acknowledgements
  try {
    const demoEmployee = await prisma.user.findUnique({
      where: { email: "employee@nexusops.com" },
    });

    const policy1 = await prisma.document.upsert({
      where: { id: "policy-seed-1" },
      update: {},
      create: {
        id: "policy-seed-1",
        title: "Enterprise Information Security & Data Protection Policy",
        fileName: "info-security-policy-v1.pdf",
        filePath: "policies/info-security-policy-v1.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1048576,
        category: "SECURITY",
        isPolicy: true,
        isMandatory: true,
        version: 1,
        status: "READY",
        visibility: "ALL",
        departmentId: itDept.id,
        targetDepartmentId: null, // Company-wide
        uploadedById: admin.id,
      },
    });

    const policy2 = await prisma.document.upsert({
      where: { id: "policy-seed-2" },
      update: {},
      create: {
        id: "policy-seed-2",
        title: "Employee Travel & Expense Reimbursement Policy",
        fileName: "travel-expense-policy-v1.pdf",
        filePath: "policies/travel-expense-policy-v1.pdf",
        mimeType: "application/pdf",
        sizeBytes: 524288,
        category: "TRAVEL",
        isPolicy: true,
        isMandatory: false,
        version: 1,
        status: "READY",
        visibility: "ALL",
        departmentId: financeDept.id,
        targetDepartmentId: null, // Company-wide
        uploadedById: admin.id,
      },
    });

    const policy3 = await prisma.document.upsert({
      where: { id: "policy-seed-3" },
      update: {},
      create: {
        id: "policy-seed-3",
        title: "IT Infrastructure & Acceptable Use Policy",
        fileName: "it-acceptable-use-v1.pdf",
        filePath: "policies/it-acceptable-use-v1.pdf",
        mimeType: "application/pdf",
        sizeBytes: 819200,
        category: "SECURITY",
        isPolicy: true,
        isMandatory: true,
        version: 1,
        status: "READY",
        visibility: "ALL",
        departmentId: itDept.id,
        targetDepartmentId: itDept.id, // IT Department specific
        uploadedById: admin.id,
      },
    });

    const policy4 = await prisma.document.upsert({
      where: { id: "policy-seed-4" },
      update: {},
      create: {
        id: "policy-seed-4",
        title: "Workplace Ethics & Code of Professional Conduct",
        fileName: "code-of-conduct-v1.pdf",
        filePath: "policies/code-of-conduct-v1.pdf",
        mimeType: "application/pdf",
        sizeBytes: 655360,
        category: "HR",
        isPolicy: true,
        isMandatory: true,
        version: 1,
        status: "READY",
        visibility: "ALL",
        departmentId: hrDept.id,
        targetDepartmentId: null,
        uploadedById: admin.id,
      },
    });

    if (demoEmployee) {
      await prisma.acknowledgement.upsert({
        where: {
          documentId_userId_version: {
            documentId: policy1.id,
            userId: demoEmployee.id,
            version: 1,
          },
        },
        update: {},
        create: {
          documentId: policy1.id,
          userId: demoEmployee.id,
          version: 1,
          acknowledgedAt: new Date(Date.now() - 3600000 * 48),
        },
      });
    }

    await prisma.acknowledgement.upsert({
      where: {
        documentId_userId_version: {
          documentId: policy1.id,
          userId: admin.id,
          version: 1,
        },
      },
      update: {},
      create: {
        documentId: policy1.id,
        userId: admin.id,
        version: 1,
        acknowledgedAt: new Date(Date.now() - 3600000 * 24),
      },
    });

    console.log("✓ Sample Policies & Acknowledgements seeded successfully");
  } catch (err) {
    console.warn("Policy seed skipped:", err);
  }

  // 13. Seed Holidays & Initial Leave Balances
  try {
    const currentYear = new Date().getFullYear();

    const sampleHolidays = [
      { name: "New Year's Day", date: new Date(Date.UTC(currentYear, 0, 1)) },
      { name: "Republic Day", date: new Date(Date.UTC(currentYear, 0, 26)) },
      { name: "Independence Day", date: new Date(Date.UTC(currentYear, 7, 15)) },
      { name: "Gandhi Jayanti", date: new Date(Date.UTC(currentYear, 9, 2)) },
      { name: "Christmas Day", date: new Date(Date.UTC(currentYear, 11, 25)) },
    ];

    for (const h of sampleHolidays) {
      await prisma.holiday.upsert({
        where: { date: h.date },
        update: { name: h.name },
        create: { name: h.name, date: h.date },
      });
    }

    const allUsers = [admin, managerIT, managerHR, employee1, employee2, employee3, demoEmployee].filter(Boolean);
    for (const u of allUsers) {
      if (u?.id) {
        await prisma.leaveBalance.upsert({
          where: {
            userId_year: {
              userId: u.id,
              year: currentYear,
            },
          },
          update: {},
          create: {
            userId: u.id,
            year: currentYear,
            casualDays: 12,
            sickDays: 12,
            annualDays: 15,
            usedCasual: 0,
            usedSick: 0,
            usedAnnual: 0,
          },
        });
      }
    }
    console.log("✓ Sample Holidays & Leave Balances seeded successfully");
  } catch (err) {
    console.warn("Leave seed skipped:", err);
  }

  // Seed Sample Weekly Digest Schedule for Admin
  try {
    if (admin?.id) {
      const schedule = await prisma.digestSchedule.upsert({
        where: { id: "sched-weekly-analytics-admin" },
        update: {
          recipients: ["admin@nexusops.com", "operations-lead@nexusops.com"],
          dayOfWeek: 1, // Monday
          hour: 9,      // 09:00 AM IST
          timezone: "Asia/Kolkata",
          isActive: true,
          createdBy: admin.id,
        },
        create: {
          id: "sched-weekly-analytics-admin",
          recipients: ["admin@nexusops.com", "operations-lead@nexusops.com"],
          frequency: "WEEKLY",
          dayOfWeek: 1, // Monday
          hour: 9,      // 09:00 AM IST
          timezone: "Asia/Kolkata",
          isActive: true,
          createdBy: admin.id,
        },
      });

      await prisma.digestDelivery.upsert({
        where: { id: "delivery-sample-past-1" },
        update: {},
        create: {
          id: "delivery-sample-past-1",
          scheduleId: schedule.id,
          sentAt: new Date(Date.now() - 7 * 24 * 3600 * 1000),
          status: "SUCCESS",
          recipientCount: 2,
        },
      });
      console.log("✓ Sample DigestSchedule and DigestDelivery seeded successfully");
    }
  } catch (err) {
    console.warn("Digest seed skipped:", err);
  }

  // Seed Default CSAT Satisfaction Survey
  try {
    const existingDefaultSurvey = await prisma.survey.findFirst({
      where: { title: "Request Fulfillment CSAT" },
    });

    if (!existingDefaultSurvey) {
      await prisma.survey.create({
        data: {
          id: "default-csat-survey",
          title: "Request Fulfillment CSAT",
          isActive: true,
          targetRole: null,
          questions: [
            {
              id: "csat_rating",
              question: "How satisfied are you with this fulfillment?",
              type: "rating",
              min: 1,
              max: 5,
              required: true,
            },
            {
              id: "csat_comment",
              question: "Any comments or suggestions?",
              type: "text",
              required: false,
            },
          ],
        },
      });
      console.log("✓ Default CSAT Satisfaction Survey seeded successfully");
    }
  } catch (err) {
    console.warn("Survey seed skipped:", err);
  }

  // Seed Sample Expense Claims & Items
  try {
    const alexUser = await prisma.user.findUnique({ where: { email: "employee.it1@nexusops.com" } });
    const brianUser = await prisma.user.findUnique({ where: { email: "employee.it2@nexusops.com" } });

    if (alexUser) {
      // 1. Draft Claim
      const existingDraft = await prisma.expenseClaim.findFirst({
        where: { employeeId: alexUser.id, title: "Client Onsite Travel - Bengaluru" },
      });
      if (!existingDraft) {
        await prisma.expenseClaim.create({
          data: {
            title: "Client Onsite Travel - Bengaluru",
            totalAmount: 435000, // ₹4,350.00
            status: "DRAFT",
            employeeId: alexUser.id,
            items: {
              create: [
                {
                  category: "TRAVEL",
                  amount: 350000, // ₹3,500.00
                  receiptUrl: "/api/expenses/receipts/sample-flight-ticket.pdf",
                  description: "Flight to Bengaluru client office",
                  date: new Date(),
                },
                {
                  category: "MEALS",
                  amount: 85000, // ₹850.00
                  receiptUrl: null,
                  description: "Team working dinner",
                  date: new Date(),
                },
              ],
            },
          },
        });
      }

      // 2. Paid Claim
      const existingPaid = await prisma.expenseClaim.findFirst({
        where: { paymentReference: "PAY-2026-NEXUS-001" },
      });
      if (!existingPaid) {
        await prisma.expenseClaim.create({
          data: {
            title: "Conference Registration & Travel",
            totalAmount: 1500000, // ₹15,000.00
            status: "PAID",
            employeeId: alexUser.id,
            paymentReference: "PAY-2026-NEXUS-001",
            submittedAt: new Date(Date.now() - 72 * 3600 * 1000),
            paidAt: new Date(Date.now() - 12 * 3600 * 1000),
            items: {
              create: [
                {
                  category: "OTHER",
                  amount: 1500000,
                  receiptUrl: "/api/expenses/receipts/sample-conf-pass.pdf",
                  description: "DevOps Days India 2026 Registration Ticket",
                  date: new Date(Date.now() - 80 * 3600 * 1000),
                },
              ],
            },
          },
        });
      }
    }

    if (brianUser) {
      // 3. Approved Claim waiting for Finance payment
      const existingApproved = await prisma.expenseClaim.findFirst({
        where: { employeeId: brianUser.id, title: "Ergonomic Office Equipment" },
      });
      if (!existingApproved) {
        await prisma.expenseClaim.create({
          data: {
            title: "Ergonomic Office Equipment",
            totalAmount: 650000, // ₹6,500.00
            status: "APPROVED",
            employeeId: brianUser.id,
            submittedAt: new Date(Date.now() - 48 * 3600 * 1000),
            items: {
              create: [
                {
                  category: "OFFICE",
                  amount: 650000,
                  receiptUrl: "/api/expenses/receipts/sample-chair-invoice.pdf",
                  description: "Ergonomic Mesh Chair for Work From Home",
                  date: new Date(Date.now() - 50 * 3600 * 1000),
                },
              ],
            },
          },
        });
      }
    }
    console.log("✓ Sample Expense Claims and Items seeded successfully");
  } catch (err) {
    console.warn("Expense seed skipped:", err);
  }

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
