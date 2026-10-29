import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { Role, RequestStatus, Priority, RequestCategory } from "@prisma/client";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { signAccessToken } from "../src/lib/jwt";

vi.mock("../src/lib/prisma", () => {
  return {
    prisma: {
      user: {
        findUnique: vi.fn(),
      },
      workRequest: {
        findUnique: vi.fn(),
      },
      task: {
        findUnique: vi.fn(),
      },
      comment: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
    },
  };
});

describe("Comments Module Integration Tests", () => {
  const managerUser = {
    id: "b0000000-0000-4000-8000-000000000001",
    name: "Eng Manager",
    email: "manager@nexusops.com",
    role: Role.MANAGER,
    isActive: true,
    departmentId: "dept-eng",
    managerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const employee1 = {
    id: "c0000000-0000-4000-8000-000000000001",
    name: "Eng Employee",
    email: "emp1@nexusops.com",
    role: Role.EMPLOYEE,
    isActive: true,
    departmentId: "dept-eng",
    managerId: managerUser.id,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const employee2 = {
    id: "d0000000-0000-4000-8000-000000000002",
    name: "HR Employee",
    email: "emp2@nexusops.com",
    role: Role.EMPLOYEE,
    isActive: true,
    departmentId: "dept-hr",
    managerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const employee1Token = signAccessToken({
    sub: employee1.id,
    email: employee1.email,
    role: employee1.role,
  });

  const employee2Token = signAccessToken({
    sub: employee2.id,
    email: employee2.email,
    role: employee2.role,
  });

  const mockRequest = {
    id: "e0000000-0000-4000-8000-000000000001",
    title: "Need new developer laptop",
    description: "MacBook Pro",
    category: RequestCategory.IT,
    priority: Priority.HIGH,
    status: RequestStatus.DRAFT,
    amount: null,
    dueDate: null,
    requesterId: employee1.id,
    createdAt: new Date(),
    updatedAt: new Date(),
    requester: {
      id: employee1.id,
      name: employee1.name,
      email: employee1.email,
      role: employee1.role,
      departmentId: "dept-eng",
      department: { id: "dept-eng", name: "Engineering" },
    },
    attachments: [],
    tasks: [],
    approvalSteps: [],
  };

  const mockComment = {
    id: "10000000-0000-4000-8000-000000000001",
    entityType: "request",
    entityId: mockRequest.id,
    body: "Please approve this as soon as possible.",
    userId: employee1.id,
    createdAt: new Date(),
    user: {
      id: employee1.id,
      name: employee1.name,
      email: employee1.email,
      role: employee1.role,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(prisma.user.findUnique).mockImplementation(
      async ({ where }: { where: { id?: string; email?: string } }) => {
        if (where.id === managerUser.id || where.email === managerUser.email) return managerUser;
        if (where.id === employee1.id || where.email === employee1.email) return employee1;
        if (where.id === employee2.id || where.email === employee2.email) return employee2;
        return null;
      }
    );
  });

  describe("POST /api/comments", () => {
    it("successfully posts a comment on an owned request with audit log", async () => {
      vi.mocked(prisma.workRequest.findUnique).mockResolvedValue(mockRequest);
      vi.mocked(prisma.comment.create).mockResolvedValue(mockComment);

      const res = await request(app)
        .post("/api/comments")
        .set("Authorization", `Bearer ${employee1Token}`)
        .send({
          entityType: "request",
          entityId: mockRequest.id,
          body: "Please approve this as soon as possible.",
        });

      expect(res.status).toBe(201);
      expect(res.body.comment.body).toBe(mockComment.body);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "COMMENT_CREATED",
            entityType: "Comment",
            actorId: employee1.id,
          }),
        })
      );
    });

    it("rejects comment creation if user does not have permission to view target entity", async () => {
      vi.mocked(prisma.workRequest.findUnique).mockResolvedValue(mockRequest); // owned by employee1 in dept-eng

      const res = await request(app)
        .post("/api/comments")
        .set("Authorization", `Bearer ${employee2Token}`) // employee2 is in dept-hr
        .send({
          entityType: "request",
          entityId: mockRequest.id,
          body: "Trying to comment without permission",
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("permission");
    });
  });

  describe("GET /api/comments", () => {
    it("returns list of comments for an entity", async () => {
      vi.mocked(prisma.workRequest.findUnique).mockResolvedValue(mockRequest);
      vi.mocked(prisma.comment.findMany).mockResolvedValue([mockComment]);

      const res = await request(app)
        .get("/api/comments")
        .set("Authorization", `Bearer ${employee1Token}`)
        .query({
          entityType: "request",
          entityId: mockRequest.id,
        });

      expect(res.status).toBe(200);
      expect(res.body.comments).toHaveLength(1);
      expect(res.body.comments[0].body).toBe(mockComment.body);
    });
  });
});
