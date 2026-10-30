import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { Role, TaskStatus, Priority } from "@prisma/client";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { signAccessToken } from "../src/lib/jwt";

vi.mock("../src/lib/prisma", () => {
  return {
    prisma: {
      user: {
        findUnique: vi.fn(),
      },
      task: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      notification: {
        create: vi.fn().mockResolvedValue({}),
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    },
  };
});

describe("Tasks Module Integration Tests", () => {
  const adminUser = {
    id: "a0000000-0000-4000-8000-000000000001",
    name: "Admin User",
    email: "admin@nexusops.com",
    role: Role.ADMIN,
    isActive: true,
    departmentId: null,
    managerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

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

  const adminToken = signAccessToken({
    sub: adminUser.id,
    email: adminUser.email,
    role: adminUser.role,
  });

  const managerToken = signAccessToken({
    sub: managerUser.id,
    email: managerUser.email,
    role: managerUser.role,
  });

  const employee1Token = signAccessToken({
    sub: employee1.id,
    email: employee1.email,
    role: employee1.role,
  });

  const mockTaskBase = {
    id: "f0000000-0000-4000-8000-000000000001",
    title: "Set up CI pipeline for monorepo",
    description: "Configure GitHub Actions workflow",
    status: TaskStatus.TODO,
    priority: Priority.HIGH,
    dueDate: null,
    requestId: null,
    assigneeId: employee1.id,
    assignedById: managerUser.id,
    createdAt: new Date(),
    updatedAt: new Date(),
    assignee: {
      id: employee1.id,
      name: employee1.name,
      email: employee1.email,
      role: employee1.role,
      departmentId: "dept-eng",
    },
    assignedBy: {
      id: managerUser.id,
      name: managerUser.name,
      email: managerUser.email,
      role: managerUser.role,
    },
    request: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(prisma.user.findUnique).mockImplementation(
      async ({ where }: { where: { id?: string; email?: string } }) => {
        if (where.id === adminUser.id || where.email === adminUser.email) return adminUser;
        if (where.id === managerUser.id || where.email === managerUser.email) return managerUser;
        if (where.id === employee1.id || where.email === employee1.email) return employee1;
        if (where.id === employee2.id || where.email === employee2.email) return employee2;
        return null;
      }
    );
  });

  describe("POST /api/tasks & Permission Checks", () => {
    it("allows manager to create a task and assign it", async () => {
      vi.mocked(prisma.task.create).mockResolvedValue(mockTaskBase);

      const res = await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({
          title: "Set up CI pipeline for monorepo",
          priority: "HIGH",
          assigneeId: employee1.id,
        });

      expect(res.status).toBe(201);
      expect(res.body.task.title).toBe("Set up CI pipeline for monorepo");
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "TASK_CREATED",
            entityType: "Task",
            actorId: managerUser.id,
          }),
        })
      );
    });

    it("prevents an employee from assigning tasks upon creation", async () => {
      const res = await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${employee1Token}`)
        .send({
          title: "Try to assign task",
          assigneeId: employee2.id,
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("Only managers and admins can assign");
    });
  });

  describe("PATCH /api/tasks/:id/assign", () => {
    it("blocks an employee with 403 Forbidden when trying to assign a task", async () => {
      const res = await request(app)
        .patch(`/api/tasks/${mockTaskBase.id}/assign`)
        .set("Authorization", `Bearer ${employee1Token}`)
        .send({ assigneeId: employee2.id });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("permission");
    });

    it("allows manager to assign a task and writes audit log", async () => {
      vi.mocked(prisma.task.findUnique).mockResolvedValue(mockTaskBase);
      vi.mocked(prisma.task.update).mockResolvedValue({
        ...mockTaskBase,
        assigneeId: employee2.id,
      });

      const res = await request(app)
        .patch(`/api/tasks/${mockTaskBase.id}/assign`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ assigneeId: employee2.id });

      expect(res.status).toBe(200);
      expect(res.body.task.assigneeId).toBe(employee2.id);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "TASK_ASSIGNED",
            entityType: "Task",
            actorId: managerUser.id,
          }),
        })
      );
    });
  });

  describe("Task Lifecycle & Status Transitions", () => {
    it("transitions TODO -> IN_PROGRESS -> BLOCKED -> DONE", async () => {
      // Step 1: TODO -> IN_PROGRESS
      vi.mocked(prisma.task.findUnique).mockResolvedValue(mockTaskBase); // status: TODO
      vi.mocked(prisma.task.update).mockResolvedValue({
        ...mockTaskBase,
        status: TaskStatus.IN_PROGRESS,
      });

      const res1 = await request(app)
        .patch(`/api/tasks/${mockTaskBase.id}`)
        .set("Authorization", `Bearer ${employee1Token}`)
        .send({ status: TaskStatus.IN_PROGRESS });

      expect(res1.status).toBe(200);
      expect(res1.body.task.status).toBe(TaskStatus.IN_PROGRESS);

      // Step 2: IN_PROGRESS -> BLOCKED
      vi.mocked(prisma.task.findUnique).mockResolvedValue({
        ...mockTaskBase,
        status: TaskStatus.IN_PROGRESS,
      });
      vi.mocked(prisma.task.update).mockResolvedValue({
        ...mockTaskBase,
        status: TaskStatus.BLOCKED,
      });

      const res2 = await request(app)
        .patch(`/api/tasks/${mockTaskBase.id}`)
        .set("Authorization", `Bearer ${employee1Token}`)
        .send({ status: TaskStatus.BLOCKED });

      expect(res2.status).toBe(200);
      expect(res2.body.task.status).toBe(TaskStatus.BLOCKED);

      // Step 3: BLOCKED -> DONE
      vi.mocked(prisma.task.findUnique).mockResolvedValue({
        ...mockTaskBase,
        status: TaskStatus.BLOCKED,
      });
      vi.mocked(prisma.task.update).mockResolvedValue({
        ...mockTaskBase,
        status: TaskStatus.DONE,
      });

      const res3 = await request(app)
        .patch(`/api/tasks/${mockTaskBase.id}`)
        .set("Authorization", `Bearer ${employee1Token}`)
        .send({ status: TaskStatus.DONE });

      expect(res3.status).toBe(200);
      expect(res3.body.task.status).toBe(TaskStatus.DONE);
    });

    it("rejects illegal status transition with 409 Conflict (TODO directly to DONE)", async () => {
      vi.mocked(prisma.task.findUnique).mockResolvedValue(mockTaskBase); // status: TODO

      const res = await request(app)
        .patch(`/api/tasks/${mockTaskBase.id}`)
        .set("Authorization", `Bearer ${employee1Token}`)
        .send({ status: TaskStatus.DONE });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain("Illegal status transition");
    });
  });

  describe("GET /api/tasks Visibility", () => {
    it("employee visibility filter only includes assigned or owned tasks", async () => {
      vi.mocked(prisma.task.count).mockResolvedValue(1);
      vi.mocked(prisma.task.findMany).mockResolvedValue([mockTaskBase]);

      const res = await request(app)
        .get("/api/tasks")
        .set("Authorization", `Bearer ${employee1Token}`);

      expect(res.status).toBe(200);
      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              {
                OR: [
                  { assigneeId: employee1.id },
                  { request: { requesterId: employee1.id } },
                ],
              },
            ],
          },
        })
      );
    });
  });
});
