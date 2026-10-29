import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { Role } from "@prisma/client";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { signAccessToken } from "../src/lib/jwt";

vi.mock("../src/lib/prisma", () => {
  return {
    prisma: {
      user: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
      },
      refreshToken: {
        updateMany: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      $queryRaw: vi.fn(),
    },
  };
});

describe("Users Admin Module Integration Tests", () => {
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
    department: null,
  };

  const employeeUser = {
    id: "b0000000-0000-4000-8000-000000000002",
    name: "Employee User",
    email: "emp@nexusops.com",
    role: Role.EMPLOYEE,
    isActive: true,
    departmentId: null,
    managerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    department: null,
  };

  const adminToken = signAccessToken({
    sub: adminUser.id,
    email: adminUser.email,
    role: adminUser.role,
  });

  const employeeToken = signAccessToken({
    sub: employeeUser.id,
    email: employeeUser.email,
    role: employeeUser.role,
  });

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(prisma.user.findUnique).mockImplementation(async ({ where }: any) => {
      if (where.id === adminUser.id || where.email === adminUser.email) {
        return adminUser as any;
      }
      if (where.id === employeeUser.id || where.email === employeeUser.email) {
        return employeeUser as any;
      }
      return null;
    });
  });

  describe("RBAC & GET /api/users", () => {
    it("returns 403 Forbidden when accessed by EMPLOYEE", async () => {
      const res = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${employeeToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("permission");
    });

    it("returns 200 OK and user list when accessed by ADMIN", async () => {
      vi.mocked(prisma.user.count).mockResolvedValueOnce(2);
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([adminUser, employeeUser] as any);

      const res = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(2);
      expect(res.body.users).toHaveLength(2);
    });
  });

  describe("PATCH /api/users/:id/role", () => {
    it("blocks an admin from changing/demoting their own role", async () => {
      const res = await request(app)
        .patch(`/api/users/${adminUser.id}/role`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ role: Role.EMPLOYEE });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("cannot demote or change their own role");
    });

    it("successfully updates another user's role and creates audit log", async () => {
      const updated = { ...employeeUser, role: Role.MANAGER };
      vi.mocked(prisma.user.update).mockResolvedValueOnce(updated as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValueOnce({} as any);

      const res = await request(app)
        .patch(`/api/users/${employeeUser.id}/role`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ role: Role.MANAGER });

      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe(Role.MANAGER);

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorId: adminUser.id,
            action: "ROLE_CHANGE",
            entityType: "User",
            entityId: employeeUser.id,
          }),
        })
      );
    });
  });

  describe("PATCH /api/users/:id/status", () => {
    it("blocks an admin from deactivating their own account", async () => {
      const res = await request(app)
        .patch(`/api/users/${adminUser.id}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isActive: false });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("cannot deactivate their own account");
    });

    it("deactivates another user, revokes refresh tokens, and creates audit log", async () => {
      const deactivatedUser = { ...employeeUser, isActive: false };
      vi.mocked(prisma.user.update).mockResolvedValueOnce(deactivatedUser as any);
      vi.mocked(prisma.refreshToken.updateMany).mockResolvedValueOnce({ count: 2 });
      vi.mocked(prisma.auditLog.create).mockResolvedValueOnce({} as any);

      const res = await request(app)
        .patch(`/api/users/${employeeUser.id}/status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.user.isActive).toBe(false);

      // Verify sessions revoked
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: employeeUser.id, revoked: false },
        data: { revoked: true },
      });

      // Verify audit log
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorId: adminUser.id,
            action: "USER_DEACTIVATED",
            entityType: "User",
            entityId: employeeUser.id,
          }),
        })
      );
    });
  });
});
