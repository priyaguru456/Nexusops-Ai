import dotenv from "dotenv";
import path from "path";

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import {
  PrismaClient,
  Role,
  RequestCategory,
  Priority,
  RequestStatus,
  TaskStatus,
  ApprovalStatus,
  ChatRole,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function seedDemoData() {
  if (process.env.NODE_ENV === "production") {
    console.error("FATAL: seed:demo cannot run in a production environment!");
    process.exit(1);
  }

  console.log("Starting demo analytics dataset generation (spread over last 60 days)...");

  // 1. Ensure basic departments exist
  const deptIT = await prisma.department.upsert({
    where: { name: "IT" },
    update: {},
    create: { name: "IT" },
  });
  const deptHR = await prisma.department.upsert({
    where: { name: "HR" },
    update: {},
    create: { name: "HR" },
  });
  const deptFinance = await prisma.department.upsert({
    where: { name: "Finance" },
    update: {},
    create: { name: "Finance" },
  });

  const depts = [deptIT, deptHR, deptFinance];

  // 2. Ensure base users exist
  const passwordHash = await bcrypt.hash("Password@123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@nexusops.com" },
    update: {},
    create: {
      name: "Admin User",
      email: "admin@nexusops.com",
      passwordHash,
      role: Role.ADMIN,
      departmentId: deptIT.id,
    },
  });

  const mgrIT = await prisma.user.upsert({
    where: { email: "manager.it@nexusops.com" },
    update: {},
    create: {
      name: "IT Manager",
      email: "manager.it@nexusops.com",
      passwordHash,
      role: Role.MANAGER,
      departmentId: deptIT.id,
    },
  });

  const mgrHR = await prisma.user.upsert({
    where: { email: "manager.hr@nexusops.com" },
    update: {},
    create: {
      name: "HR Manager",
      email: "manager.hr@nexusops.com",
      passwordHash,
      role: Role.MANAGER,
      departmentId: deptHR.id,
    },
  });

  const empIT = await prisma.user.upsert({
    where: { email: "employee.it@nexusops.com" },
    update: {},
    create: {
      name: "IT Employee",
      email: "employee.it@nexusops.com",
      passwordHash,
      role: Role.EMPLOYEE,
      departmentId: deptIT.id,
    },
  });

  const empHR = await prisma.user.upsert({
    where: { email: "employee.hr@nexusops.com" },
    update: {},
    create: {
      name: "HR Employee",
      email: "employee.hr@nexusops.com",
      passwordHash,
      role: Role.EMPLOYEE,
      departmentId: deptHR.id,
    },
  });

  const empFin = await prisma.user.upsert({
    where: { email: "employee.fin@nexusops.com" },
    update: {},
    create: {
      name: "Finance Employee",
      email: "employee.fin@nexusops.com",
      passwordHash,
      role: Role.EMPLOYEE,
      departmentId: deptFinance.id,
    },
  });

  const employees = [empIT, empHR, empFin];
  const managers = [mgrIT, mgrHR];
  const approvers = [mgrIT, mgrHR, admin];

  // Clean previous demo seeded records to maintain idempotency
  await prisma.chatMessage.deleteMany({
    where: { session: { title: { startsWith: "[Demo]" } } },
  });
  await prisma.chatSession.deleteMany({
    where: { title: { startsWith: "[Demo]" } },
  });
  await prisma.task.deleteMany({
    where: { title: { startsWith: "[Demo]" } },
  });
  await prisma.approvalStep.deleteMany({
    where: { request: { title: { startsWith: "[Demo]" } } },
  });
  await prisma.workRequest.deleteMany({
    where: { title: { startsWith: "[Demo]" } },
  });

  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  // 3. Create ~60 WorkRequests spread over 60 days
  const categories: RequestCategory[] = [
    RequestCategory.IT,
    RequestCategory.HR,
    RequestCategory.FINANCE,
    RequestCategory.FACILITIES,
    RequestCategory.OTHER,
  ];

  const priorities: Priority[] = [
    Priority.LOW,
    Priority.MEDIUM,
    Priority.HIGH,
    Priority.URGENT,
  ];

  const statuses: RequestStatus[] = [
    RequestStatus.DRAFT,
    RequestStatus.SUBMITTED,
    RequestStatus.IN_REVIEW,
    RequestStatus.APPROVED,
    RequestStatus.REJECTED,
    RequestStatus.IN_PROGRESS,
    RequestStatus.COMPLETED,
    RequestStatus.CANCELLED,
  ];

  console.log("Generating 60 demo work requests...");
  const createdRequests = [];

  for (let i = 0; i < 60; i++) {
    const dayOffset = Math.floor((i / 60) * 58); // 0 to 58 days ago
    const createdAt = new Date(now - dayOffset * DAY_MS - (i % 12) * 3600000);
    const status = statuses[i % statuses.length];
    const category = categories[i % categories.length];
    const priority = priorities[i % priorities.length];
    const requester = employees[i % employees.length];

    let submittedAt: Date | null = null;
    let completedAt: Date | null = null;

    if (status !== RequestStatus.DRAFT) {
      submittedAt = new Date(createdAt.getTime() + 15 * 60 * 1000); // 15 mins after create
    }

    if (status === RequestStatus.COMPLETED) {
      completedAt = new Date(createdAt.getTime() + (24 + (i % 72)) * 3600000); // 1 to 4 days later
    }

    const wr = await prisma.workRequest.create({
      data: {
        title: `[Demo] ${category} Request #${1000 + i}`,
        description: `Simulated workplace request for ${category.toLowerCase()} resources.`,
        category,
        priority,
        status,
        amount: (i + 1) * 75.5,
        dueDate: new Date(createdAt.getTime() + 7 * DAY_MS),
        submittedAt,
        completedAt,
        createdAt,
        updatedAt: completedAt || createdAt,
        requesterId: requester.id,
      },
    });

    createdRequests.push(wr);

    // Create approval steps for submitted / in review / approved / rejected requests
    if (submittedAt) {
      const isApproved = status === RequestStatus.APPROVED || status === RequestStatus.COMPLETED;
      const isRejected = status === RequestStatus.REJECTED;

      const approver = approvers[i % approvers.length];
      const decidedAt = isApproved || isRejected
        ? new Date(submittedAt.getTime() + (2 + (i % 48)) * 3600000)
        : null;

      await prisma.approvalStep.create({
        data: {
          requestId: wr.id,
          stepOrder: 1,
          approverRole: approver.role,
          approverId: decidedAt ? approver.id : null,
          status: isApproved
            ? ApprovalStatus.APPROVED
            : isRejected
            ? ApprovalStatus.REJECTED
            : ApprovalStatus.PENDING,
          decidedAt,
          comment: decidedAt ? (isApproved ? "Approved per policy" : "Exceeds limits") : null,
          createdAt: submittedAt,
        },
      });
    }
  }

  // 4. Create ~50 Tasks (some overdue, some completed)
  console.log("Generating 50 demo tasks...");
  const taskStatuses = [
    TaskStatus.TODO,
    TaskStatus.IN_PROGRESS,
    TaskStatus.BLOCKED,
    TaskStatus.DONE,
  ];

  for (let i = 0; i < 50; i++) {
    const dayOffset = Math.floor((i / 50) * 55);
    const createdAt = new Date(now - dayOffset * DAY_MS);
    const status = taskStatuses[i % taskStatuses.length];
    const priority = priorities[i % priorities.length];
    const assignee = employees[i % employees.length];
    const linkedRequest = createdRequests[i % createdRequests.length];

    // Make some tasks overdue (due in the past, status != DONE)
    const isOverdue = i % 4 === 0 && status !== TaskStatus.DONE;
    const dueDate = isOverdue
      ? new Date(now - (1 + (i % 5)) * DAY_MS)
      : new Date(now + (2 + (i % 10)) * DAY_MS);

    const completedAt = status === TaskStatus.DONE
      ? new Date(createdAt.getTime() + 18 * 3600000)
      : null;

    await prisma.task.create({
      data: {
        title: `[Demo] Action Item for ${linkedRequest.category} #${i + 1}`,
        description: `Operational task generated for fulfillment.`,
        status,
        priority,
        dueDate,
        completedAt,
        createdAt,
        updatedAt: completedAt || createdAt,
        requestId: linkedRequest.id,
        assigneeId: assignee.id,
        assignedById: mgrIT.id,
      },
    });
  }

  // 5. Create ~40 ChatSessions with questions, citations, latency, feedback, and token counts
  console.log("Generating 40 demo AI chat sessions and messages...");
  // Check for any existing documents to cite
  const existingDocs = await prisma.document.findMany({ take: 5 });

  for (let i = 0; i < 40; i++) {
    const dayOffset = Math.floor((i / 40) * 50);
    const sessionCreatedAt = new Date(now - dayOffset * DAY_MS - (i % 6) * 3600000);
    const user = employees[i % employees.length];

    const session = await prisma.chatSession.create({
      data: {
        userId: user.id,
        title: `[Demo] Policy Inquiry #${i + 1}`,
        createdAt: sessionCreatedAt,
      },
    });

    // 1 User message
    await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: ChatRole.USER,
        content: `What is the protocol for expense report #${100 + i}?`,
        createdAt: sessionCreatedAt,
      },
    });

    // 1 Assistant response
    const isNotFound = i % 8 === 0; // ~12.5% not found rate
    const answerCreatedAt = new Date(sessionCreatedAt.getTime() + 1500);

    const inputTokens = isNotFound ? 80 : 350 + (i * 20);
    const outputTokens = isNotFound ? 15 : 120 + (i * 10);
    const latencyMs = isNotFound ? 280 : 850 + (i % 10) * 80;
    const feedback = i % 3 === 0 ? 1 : i % 7 === 0 ? -1 : null;

    let citations: any[] = [];
    if (!isNotFound && existingDocs.length > 0) {
      const doc = existingDocs[i % existingDocs.length];
      citations = [
        {
          documentId: doc.id,
          documentTitle: doc.title,
          pageNumber: (i % 15) + 1,
          snippet: "Reimbursements must be filed within 30 days of the incurred travel expense.",
        },
      ];
    }

    await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: ChatRole.ASSISTANT,
        content: isNotFound
          ? "I couldn't find this in the company documents."
          : `According to company guidelines [1], reports must be submitted on time.`,
        citations: citations as any,
        tokensUsed: inputTokens + outputTokens,
        inputTokens,
        outputTokens,
        latencyMs,
        notFound: isNotFound,
        feedback,
        createdAt: answerCreatedAt,
      },
    });
  }

  console.log("✓ Successfully seeded demo analytics dataset:");
  console.log("  - 60 Work Requests");
  console.log("  - 50 Tasks");
  console.log("  - 40 Approval Steps");
  console.log("  - 80 Chat Messages across 40 Chat Sessions");
}

seedDemoData()
  .catch((e) => {
    console.error("Error during seed:demo execution:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
