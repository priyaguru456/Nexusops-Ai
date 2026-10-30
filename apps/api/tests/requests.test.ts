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
        findMany: vi.fn().mockResolvedValue([]),
      },
      workRequest: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
      },
      requestAttachment: {
        create: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      approvalFlow: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      approvalStep: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
        findMany: vi.fn().mockResolvedValue([]),
      },
      notification: {
        create: vi.fn().mockResolvedValue({}),
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    },
  };
});

describe("Requests Module Integration Tests", () => {
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

  const employee2Token = signAccessToken({
    sub: employee2.id,
    email: employee2.email,
    role: employee2.role,
  });

  const mockRequestBase = {
    id: "e0000000-0000-4000-8000-000000000001",
    title: "Need new developer laptop",
    description: "MacBook Pro 16 inch M3 Max for build performance",
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
      departmentId: employee1.departmentId,
      department: { id: "dept-eng", name: "Engineering" },
    },
    attachments: [],
    tasks: [],
    approvalSteps: [],
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

  describe("POST /api/requests", () => {
    it("successfully creates a draft request with audit log", async () => {
      vi.mocked(prisma.workRequest.create).mockResolvedValue(mockRequestBase);

      const res = await request(app)
        .post("/api/requests")
        .set("Authorization", `Bearer ${employee1Token}`)
        .send({
          title: "Need new developer laptop",
          description: "MacBook Pro 16 inch M3 Max for build performance",
          category: "IT",
          priority: "HIGH",
        });

      expect(res.status).toBe(201);
      expect(res.body.request.title).toBe("Need new developer laptop");
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "REQUEST_CREATED",
            entityType: "WorkRequest",
            actorId: employee1.id,
          }),
        })
      );
    });

    it("allows uploading valid attachments via multipart form-data", async () => {
      vi.mocked(prisma.workRequest.create).mockResolvedValue({
        ...mockRequestBase,
        attachments: [
          {
            id: "att-1",
            fileName: "specs.pdf",
            filePath: "12345-specs.pdf",
            createdAt: new Date(),
          },
        ],
      });

      const res = await request(app)
        .post("/api/requests")
        .set("Authorization", `Bearer ${employee1Token}`)
        .field("title", "Need new developer laptop")
        .field("description", "MacBook Pro 16 inch M3 Max for build performance")
        .field("category", "IT")
        .attach("attachments", Buffer.from("%PDF-1.4 test file"), "specs.pdf");

      expect(res.status).toBe(201);
      expect(res.body.request.attachments).toHaveLength(1);
    });

    it("rejects unauthorized file extensions with 400 Bad Request", async () => {
      const res = await request(app)
        .post("/api/requests")
        .set("Authorization", `Bearer ${employee1Token}`)
        .field("title", "Need new developer laptop")
        .field("description", "MacBook Pro 16 inch M3 Max for build performance")
        .field("category", "IT")
        .attach("attachments", Buffer.from("malicious binary"), "payload.exe");

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Invalid file type");
    });
  });

  describe("GET /api/requests (Visibility & Filters)", () => {
    it("enforces visibility: Employee query is constrained to requesterId", async () => {
      vi.mocked(prisma.workRequest.count).mockResolvedValue(1);
      vi.mocked(prisma.workRequest.findMany).mockResolvedValue([mockRequestBase]);

      const res = await request(app)
        .get("/api/requests")
        .set("Authorization", `Bearer ${employee1Token}`);

      expect(res.status).toBe(200);
      expect(prisma.workRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { requesterId: employee1.id },
            ],
          },
        })
      );
    });

    it("enforces visibility: Manager query includes own requests + department requests", async () => {
      vi.mocked(prisma.workRequest.count).mockResolvedValue(1);
      vi.mocked(prisma.workRequest.findMany).mockResolvedValue([mockRequestBase]);

      const res = await request(app)
        .get("/api/requests")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(prisma.workRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              {
                OR: [
                  { requesterId: managerUser.id },
                  { requester: { departmentId: "dept-eng" } },
                ],
              },
            ],
          },
        })
      );
    });

    it("enforces visibility: Admin query has no department restriction", async () => {
      vi.mocked(prisma.workRequest.count).mockResolvedValue(1);
      vi.mocked(prisma.workRequest.findMany).mockResolvedValue([mockRequestBase]);

      const res = await request(app)
        .get("/api/requests")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(prisma.workRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [{}],
          },
        })
      );
    });
  });

  describe("GET /api/requests/:id", () => {
    it("allows the requester to view their request", async () => {
      vi.mocked(prisma.workRequest.findUnique).mockResolvedValue(mockRequestBase);

      const res = await request(app)
        .get(`/api/requests/${mockRequestBase.id}`)
        .set("Authorization", `Bearer ${employee1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.request.id).toBe(mockRequestBase.id);
    });

    it("allows a manager in the same department to view the request", async () => {
      vi.mocked(prisma.workRequest.findUnique).mockResolvedValue(mockRequestBase);

      const res = await request(app)
        .get(`/api/requests/${mockRequestBase.id}`)
        .set("Authorization", `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.request.id).toBe(mockRequestBase.id);
    });

    it("denies access with 403 Forbidden to an employee from another department", async () => {
      vi.mocked(prisma.workRequest.findUnique).mockResolvedValue(mockRequestBase);

      const res = await request(app)
        .get(`/api/requests/${mockRequestBase.id}`)
        .set("Authorization", `Bearer ${employee2Token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("permission");
    });
  });

  describe("PATCH /api/requests/:id", () => {
    it("allows requester to edit a request while in DRAFT status", async () => {
      vi.mocked(prisma.workRequest.findUnique).mockResolvedValue(mockRequestBase);
      vi.mocked(prisma.workRequest.update).mockResolvedValue({
        ...mockRequestBase,
        title: "Updated Title for Laptop",
      });

      const res = await request(app)
        .patch(`/api/requests/${mockRequestBase.id}`)
        .set("Authorization", `Bearer ${employee1Token}`)
        .send({ title: "Updated Title for Laptop" });

      expect(res.status).toBe(200);
      expect(res.body.request.title).toBe("Updated Title for Laptop");
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "REQUEST_UPDATED",
            entityType: "WorkRequest",
            actorId: employee1.id,
          }),
        })
      );
    });

    it("denies non-requester from editing with 403 Forbidden", async () => {
      vi.mocked(prisma.workRequest.findUnique).mockResolvedValue(mockRequestBase);

      const res = await request(app)
        .patch(`/api/requests/${mockRequestBase.id}`)
        .set("Authorization", `Bearer ${employee2Token}`)
        .send({ title: "Unauthorized Edit" });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("Only the requester");
    });

    it("rejects edit with 409 Conflict if request is not in DRAFT status", async () => {
      vi.mocked(prisma.workRequest.findUnique).mockResolvedValue({
        ...mockRequestBase,
        status: RequestStatus.SUBMITTED,
      });

      const res = await request(app)
        .patch(`/api/requests/${mockRequestBase.id}`)
        .set("Authorization", `Bearer ${employee1Token}`)
        .send({ title: "Attempted edit on submitted request" });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain("only be edited while in DRAFT status");
    });
  });

  describe("Lifecycle & State Machine Transitions", () => {
    it("allows requester to submit a DRAFT request (DRAFT -> SUBMITTED)", async () => {
      vi.mocked(prisma.workRequest.findUnique).mockResolvedValue(mockRequestBase);
      vi.mocked(prisma.workRequest.update).mockResolvedValue({
        ...mockRequestBase,
        status: RequestStatus.SUBMITTED,
      });

      const res = await request(app)
        .post(`/api/requests/${mockRequestBase.id}/submit`)
        .set("Authorization", `Bearer ${employee1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.request.status).toBe(RequestStatus.SUBMITTED);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "REQUEST_SUBMITTED",
            actorId: employee1.id,
          }),
        })
      );
    });

    it("rejects illegal submit transition with 409 Conflict if already APPROVED", async () => {
      vi.mocked(prisma.workRequest.findUnique).mockResolvedValue({
        ...mockRequestBase,
        status: RequestStatus.APPROVED,
      });

      const res = await request(app)
        .post(`/api/requests/${mockRequestBase.id}/submit`)
        .set("Authorization", `Bearer ${employee1Token}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain("Cannot submit request");
    });

    it("allows manager to transition SUBMITTED -> IN_REVIEW -> APPROVED", async () => {
      vi.mocked(prisma.workRequest.findUnique).mockResolvedValue({
        ...mockRequestBase,
        status: RequestStatus.SUBMITTED,
      });
      vi.mocked(prisma.workRequest.update).mockResolvedValue({
        ...mockRequestBase,
        status: RequestStatus.IN_REVIEW,
      });

      const res1 = await request(app)
        .patch(`/api/requests/${mockRequestBase.id}/status`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ status: RequestStatus.IN_REVIEW });

      expect(res1.status).toBe(200);
      expect(res1.body.request.status).toBe(RequestStatus.IN_REVIEW);

      // Now IN_REVIEW -> APPROVED
      vi.mocked(prisma.workRequest.findUnique).mockResolvedValue({
        ...mockRequestBase,
        status: RequestStatus.IN_REVIEW,
      });
      vi.mocked(prisma.workRequest.update).mockResolvedValue({
        ...mockRequestBase,
        status: RequestStatus.APPROVED,
      });

      const res2 = await request(app)
        .patch(`/api/requests/${mockRequestBase.id}/status`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ status: RequestStatus.APPROVED });

      expect(res2.status).toBe(200);
      expect(res2.body.request.status).toBe(RequestStatus.APPROVED);
    });

    it("rejects illegal transition with 409 Conflict (e.g. DRAFT directly to IN_PROGRESS)", async () => {
      vi.mocked(prisma.workRequest.findUnique).mockResolvedValue(mockRequestBase); // status: DRAFT

      const res = await request(app)
        .patch(`/api/requests/${mockRequestBase.id}/status`)
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ status: RequestStatus.IN_PROGRESS });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain("Illegal status transition");
    });

    it("allows cancellation of active requests with audit log", async () => {
      vi.mocked(prisma.workRequest.findUnique).mockResolvedValue(mockRequestBase);
      vi.mocked(prisma.workRequest.update).mockResolvedValue({
        ...mockRequestBase,
        status: RequestStatus.CANCELLED,
      });

      const res = await request(app)
        .post(`/api/requests/${mockRequestBase.id}/cancel`)
        .set("Authorization", `Bearer ${employee1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.request.status).toBe(RequestStatus.CANCELLED);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "REQUEST_CANCELLED",
            actorId: employee1.id,
          }),
        })
      );
    });

    it("rejects cancellation of COMPLETED request with 409 Conflict", async () => {
      vi.mocked(prisma.workRequest.findUnique).mockResolvedValue({
        ...mockRequestBase,
        status: RequestStatus.COMPLETED,
      });

      const res = await request(app)
        .post(`/api/requests/${mockRequestBase.id}/cancel`)
        .set("Authorization", `Bearer ${employee1Token}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain("Cannot cancel request");
    });
  });
});
