import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import { Role, ApprovalStatus } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { userService } from "../src/modules/users/user.service";
import { approvalEscalationService } from "../src/modules/approvals/approval-escalation.service";
import { searchService } from "../src/modules/search/search.service";
import { authenticate } from "../src/middleware/auth";
import { app } from "../src/app";
import { signAccessToken } from "../src/lib/jwt";
import { updateProfileSchema, changePasswordSchema } from "../src/modules/users/user.schema";
import type { Request, Response } from "express";

vi.mock("../src/lib/prisma", () => {
  return {
    prisma: {
      $queryRaw: vi.fn(),
      $transaction: vi.fn((callback) => callback(prisma)),
      user: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
      },
      workRequest: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      task: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
      },
      approvalStep: {
        findMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      refreshToken: {
        deleteMany: vi.fn(),
        updateMany: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      notification: {
        create: vi.fn(),
        createMany: vi.fn(),
      },
    },
  };
});

describe("Task 12: User Management, Profile, Search, Escalation & Route Security Tests", () => {
  const admin1 = {
    id: "a0000000-0000-4000-8000-000000000001",
    name: "Primary Admin",
    email: "admin1@nexusops.com",
    role: Role.ADMIN,
    isActive: true,
    departmentId: null,
    managerId: null,
    passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz123456",
  };

  const admin2 = {
    id: "a0000000-0000-4000-8000-000000000002",
    name: "Secondary Admin",
    email: "admin2@nexusops.com",
    role: Role.ADMIN,
    isActive: true,
    departmentId: null,
    managerId: null,
    passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz123456",
  };

  const employee = {
    id: "e0000000-0000-4000-8000-000000000001",
    name: "Jane Employee",
    email: "jane@nexusops.com",
    role: Role.EMPLOYEE,
    isActive: true,
    departmentId: "dept-eng",
    managerId: null,
    passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz123456",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Last Active Admin Protection", () => {
    it("blocks demoting the last active administrator", async () => {
      // 1 active admin
      vi.mocked(prisma.user.findUnique).mockResolvedValue(admin1 as any);
      vi.mocked(prisma.user.count).mockResolvedValue(1);

      await expect(
        userService.updateRole(admin1.id, admin1.id, Role.EMPLOYEE)
      ).rejects.toThrow("Admins cannot demote their own role");

      await expect(
        userService.updateRole("another-admin-id", admin1.id, Role.MANAGER)
      ).rejects.toThrow("Cannot demote the last active administrator");
    });

    it("blocks deactivating the last active administrator", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(admin1 as any);
      vi.mocked(prisma.user.count).mockResolvedValue(1);

      await expect(
        userService.updateStatus("another-admin-id", admin1.id, false)
      ).rejects.toThrow("Cannot deactivate the last active administrator");
    });

    it("allows demoting or deactivating an admin when multiple active admins exist", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(admin2 as any);
      vi.mocked(prisma.user.count).mockResolvedValue(2); // 2 active admins
      vi.mocked(prisma.user.update).mockResolvedValue({ ...admin2, role: Role.MANAGER } as any);

      const result = await userService.updateRole(admin1.id, admin2.id, Role.MANAGER);
      expect(result.role).toBe(Role.MANAGER);
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "ROLE_CHANGE",
            entityId: admin2.id,
          }),
        })
      );
    });
  });

  describe("2. Immediate Effect of Role / Deactivation via Authenticate Middleware", () => {
    it("authenticates and loads the user from database on every request", async () => {
      const token = signAccessToken({
        sub: employee.id,
        email: employee.email,
        role: Role.EMPLOYEE,
      });

      vi.mocked(prisma.user.findUnique).mockResolvedValue(employee as any);

      const req = {
        headers: { authorization: `Bearer ${token}` },
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn();

      await authenticate(req, res, next);

      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: employee.id } })
      );
      expect((req as any).user.id).toBe(employee.id);
      expect(next).toHaveBeenCalledWith();
    });

    it("immediately rejects request with 403 when user is deactivated in the database", async () => {
      const token = signAccessToken({
        sub: employee.id,
        email: employee.email,
        role: Role.EMPLOYEE,
      });

      // User deactivated in database
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...employee,
        isActive: false,
      } as any);

      const req = {
        headers: { authorization: `Bearer ${token}` },
      } as unknown as Request;
      const res = {} as Response;
      const next = vi.fn();

      await authenticate(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          message: "Account is deactivated",
        })
      );
    });
  });

  describe("3. Profile and Password Change", () => {
    it("strict Zod schema accepts only name and rejects role, email, and isActive injection", () => {
      const valid = updateProfileSchema.parse({ name: "Jane New Name" });
      expect(valid.name).toBe("Jane New Name");

      expect(() =>
        updateProfileSchema.parse({
          name: "Jane",
          role: "ADMIN",
        })
      ).toThrow();

      expect(() =>
        updateProfileSchema.parse({
          name: "Jane",
          email: "hacked@example.com",
        })
      ).toThrow();

      expect(() =>
        updateProfileSchema.parse({
          name: "Jane",
          isActive: true,
        })
      ).toThrow();
    });

    it("validates password strength and rejects same password", () => {
      expect(() =>
        changePasswordSchema.parse({
          currentPassword: "OldPassword123!",
          newPassword: "OldPassword123!",
        })
      ).toThrow(/New password must differ/);

      expect(() =>
        changePasswordSchema.parse({
          currentPassword: "OldPassword123!",
          newPassword: "short",
        })
      ).toThrow(/at least 8 characters/);
    });

    it("changes password successfully, updates hash, revokes tokens, and logs audit", async () => {
      const currentRaw = "CurrentPass123!";
      const newRaw = "NewStrongPass456!";
      const hashedCurrent = await bcrypt.hash(currentRaw, 10);

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...employee,
        passwordHash: hashedCurrent,
      } as any);
      vi.mocked(prisma.user.update).mockResolvedValue({ ...employee } as any);

      const result = await userService.changePassword(employee.id, currentRaw, newRaw);

      expect(result.message).toBe("Password updated successfully");
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: employee.id },
          data: expect.objectContaining({
            passwordHash: expect.any(String),
          }),
        })
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: employee.id }),
        })
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "PASSWORD_CHANGED",
            actorId: employee.id,
          }),
        })
      );
    });
  });

  describe("4. Global Search Across Requests and Tasks", () => {
    it("scopes search results so employees never see another user's requests or tasks", async () => {
      vi.mocked(prisma.$queryRaw)
        .mockResolvedValueOnce([
          {
            id: "req-1",
            title: "Laptop Screen Replacement",
            description: "Broken screen",
            status: "SUBMITTED",
            priority: "HIGH",
            category: "IT",
            createdAt: "2026-10-15T10:00:00Z",
            requesterName: "Jane Employee",
          },
        ])
        .mockResolvedValueOnce([]);

      const searchResult = await searchService.search(employee as any, "Laptop");

      expect(searchResult.requests).toHaveLength(1);
      expect(searchResult.requests[0].title).toBe("Laptop Screen Replacement");

      const calls = vi.mocked(prisma.$queryRaw).mock.calls;
      expect(calls.length).toBe(2);

      const stringifiedArgs = calls.flatMap((c) => c.map((arg) => JSON.stringify(arg)));
      expect(stringifiedArgs.some((arg) => arg.includes(employee.id))).toBe(true);
    });

    it("escapes LIKE wildcards % and _ safely in search queries", async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      await searchService.search(employee as any, "100%_complete");

      const calls = vi.mocked(prisma.$queryRaw).mock.calls;
      expect(calls.length).toBe(2);

      // Verify that pattern in the SQL template strings or query objects escapes % and _
      const allArgs = calls.flatMap((c) => c.map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : String(arg))));
      expect(allArgs.some((arg) => arg.includes("100\\%\\_complete"))).toBe(true);
    });
  });

  describe("5. Overdue Approval Escalation (BullMQ Service)", () => {
    it("escalates a step pending longer than threshold and notifies admins and approver", async () => {
      const overdueActivatedAt = new Date(Date.now() - 80 * 60 * 60 * 1000);

      const overdueStep = {
        id: "step-1",
        requestId: "req-100",
        stepOrder: 1,
        approverRole: Role.MANAGER,
        approverId: null,
        status: ApprovalStatus.PENDING,
        activatedAt: overdueActivatedAt,
        escalatedAt: null,
        request: {
          id: "req-100",
          title: "Production AWS Budget Increase",
          requesterId: employee.id,
          requester: { id: employee.id, name: "Jane", departmentId: "dept-eng" },
          approvalSteps: [
            { id: "step-1", stepOrder: 1, status: ApprovalStatus.PENDING },
          ],
        },
      };

      vi.mocked(prisma.approvalStep.findMany).mockResolvedValueOnce([overdueStep as any]);
      vi.mocked(prisma.approvalStep.updateMany).mockResolvedValueOnce({ count: 1 } as any);
      vi.mocked(prisma.user.findMany)
        .mockResolvedValueOnce([admin1, admin2] as any)
        .mockResolvedValueOnce([
          { id: "mgr-1", name: "Engineering Manager", role: Role.MANAGER },
        ] as any);

      const res = await approvalEscalationService.checkAndEscalateOverdueApprovals(72);

      expect(res.escalatedCount).toBe(1);
      expect(res.escalatedStepIds).toContain("step-1");

      expect(prisma.notification.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              userId: admin1.id,
              type: "APPROVAL_ESCALATED",
            }),
          ]),
        })
      );

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "APPROVAL_STEP_ESCALATED",
            entityId: "step-1",
          }),
        })
      );
    });

    it("never escalates a step that is waiting for an earlier step to complete", async () => {
      const step2 = {
        id: "step-2",
        requestId: "req-100",
        stepOrder: 2,
        approverRole: Role.ADMIN,
        status: ApprovalStatus.PENDING,
        activatedAt: new Date(Date.now() - 100 * 60 * 60 * 1000),
        escalatedAt: null,
        request: {
          id: "req-100",
          title: "Server Migration",
          requesterId: employee.id,
          requester: { id: employee.id, name: "Jane", departmentId: "dept-eng" },
          approvalSteps: [
            { id: "step-1", stepOrder: 1, status: ApprovalStatus.PENDING },
            { id: "step-2", stepOrder: 2, status: ApprovalStatus.PENDING },
          ],
        },
      };

      vi.mocked(prisma.approvalStep.findMany).mockResolvedValueOnce([step2 as any]);

      const res = await approvalEscalationService.checkAndEscalateOverdueApprovals(72);

      expect(res.escalatedCount).toBe(0);
      expect(prisma.approvalStep.updateMany).not.toHaveBeenCalled();
    });

    it("is strictly idempotent: running escalation twice creates no duplicate notifications", async () => {
      const overdueStep = {
        id: "step-already-escalated",
        requestId: "req-200",
        stepOrder: 1,
        approverRole: Role.MANAGER,
        status: ApprovalStatus.PENDING,
        activatedAt: new Date(Date.now() - 90 * 60 * 60 * 1000),
        escalatedAt: null,
        request: {
          id: "req-200",
          title: "Hardware purchase",
          requesterId: employee.id,
          requester: { id: employee.id, name: "Jane", departmentId: "dept-eng" },
          approvalSteps: [
            { id: "step-already-escalated", stepOrder: 1, status: ApprovalStatus.PENDING },
          ],
        },
      };

      vi.mocked(prisma.approvalStep.findMany).mockResolvedValueOnce([overdueStep as any]);
      vi.mocked(prisma.approvalStep.updateMany).mockResolvedValueOnce({ count: 0 } as any);

      const res = await approvalEscalationService.checkAndEscalateOverdueApprovals(72);

      expect(res.escalatedCount).toBe(0);
      expect(prisma.notification.createMany).not.toHaveBeenCalled();
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });
  });

  describe("6. Route Security Audit Allowlist Test", () => {
    it("ensures every registered API route outside public allowlist requires authentication", () => {
      const PUBLIC_ALLOWLIST = new Set([
        "GET /api/health",
        "POST /api/auth/register",
        "POST /api/auth/login",
        "POST /api/auth/refresh",
        "POST /api/auth/logout",
      ]);

      interface DiscoveredRoute {
        method: string;
        path: string;
        isProtected: boolean;
      }

      const KNOWN_MOUNTS = [
        "/api/auth",
        "/api/users",
        "/api/requests",
        "/api/tasks",
        "/api/comments",
        "/api/approvals",
        "/api/notifications",
        "/api/audit-logs",
        "/api/documents",
        "/api/ai",
        "/api/analytics",
        "/api/search",
      ];

      function discoverRoutes(stack: any[], currentPath = ""): DiscoveredRoute[] {
        const routes: DiscoveredRoute[] = [];

        for (const layer of stack) {
          if (layer.route) {
            const methods = Object.keys(layer.route.methods).map((m) => m.toUpperCase());
            const fullPath = currentPath + (layer.route.path === "/" ? "" : layer.route.path);
            const hasAuthInRoute = layer.route.stack.some(
              (s: any) => s.name === "authenticate" || s.handle?.name === "authenticate"
            );
            for (const method of methods) {
              routes.push({
                method,
                path: fullPath,
                isProtected: hasAuthInRoute,
              });
            }
          } else if (layer.handle?.stack) {
            let prefix = currentPath;
            if (layer.matchers?.[0]) {
              const matched = KNOWN_MOUNTS.find((m) => {
                const res = layer.matchers[0](m);
                return res && res.path === m;
              });
              if (matched) {
                prefix = currentPath ? `${currentPath}${matched}` : matched;
              }
            }

            const routerHasAuth = layer.handle.stack.some(
              (s: any) => s.name === "authenticate" || s.handle?.name === "authenticate"
            );

            const childRoutes = discoverRoutes(layer.handle.stack, prefix);
            for (const cr of childRoutes) {
              routes.push({
                ...cr,
                isProtected: cr.isProtected || routerHasAuth,
              });
            }
          }
        }
        return routes;
      }

      const routerStack = (app as any)._router?.stack || (app as any).router?.stack || [];
      const discovered = discoverRoutes(routerStack);

      expect(discovered.length).toBeGreaterThan(15);

      const unprotectedRoutes = discovered.filter((r) => {
        const identifier = `${r.method} ${r.path}`;
        if (PUBLIC_ALLOWLIST.has(identifier)) return false;
        return !r.isProtected;
      });

      // Assert that there are zero unprotected routes outside allowlist
      expect(unprotectedRoutes).toEqual([]);
    });
  });
});
