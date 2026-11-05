import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../../src/lib/prisma";
import { directoryRepository } from "../../src/modules/directory/directory.repository";
import { directoryService } from "../../src/modules/directory/directory.service";
import { directoryController } from "../../src/modules/directory/directory.controller";
import { authenticate } from "../../src/middleware/auth";
import { userRepository } from "../../src/modules/users/user.repository";
import { signAccessToken } from "../../src/lib/jwt";
import { AppError } from "../../src/lib/errors";

vi.mock("../../src/lib/prisma", () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    department: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("../../src/modules/users/user.repository", () => ({
  userRepository: {
    findById: vi.fn(),
  },
}));

const createMockResponse = () => {
  const res: Partial<Response> & { statusCode?: number; body?: any } = {};
  res.status = (code: number) => {
    res.statusCode = code;
    return res as Response;
  };
  res.json = (data: any) => {
    res.body = data;
    return res as Response;
  };
  return res as Response & { statusCode: number; body: any };
};

describe("Directory Module Unit & Security Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockUsers = [
    {
      id: "u-head-1",
      name: "Engineering Head",
      email: "head.eng@nexusops.ai",
      role: Role.ADMIN,
      isActive: true,
      departmentId: "dept-eng",
      managerId: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      department: { id: "dept-eng", name: "Engineering" },
      manager: null,
      _count: { reports: 2 },
    },
    {
      id: "u-mgr-1",
      name: "Engineering Manager",
      email: "mgr.eng@nexusops.ai",
      role: Role.MANAGER,
      isActive: true,
      departmentId: "dept-eng",
      managerId: "u-head-1",
      createdAt: new Date("2026-02-01T00:00:00Z"),
      department: { id: "dept-eng", name: "Engineering" },
      manager: {
        id: "u-head-1",
        name: "Engineering Head",
        email: "head.eng@nexusops.ai",
        role: Role.ADMIN,
      },
      _count: { reports: 1 },
    },
    {
      id: "u-dev-1",
      name: "Dev One",
      email: "dev.one@nexusops.ai",
      role: Role.EMPLOYEE,
      isActive: true,
      departmentId: "dept-eng",
      managerId: "u-mgr-1",
      createdAt: new Date("2026-03-01T00:00:00Z"),
      department: { id: "dept-eng", name: "Engineering" },
      manager: {
        id: "u-mgr-1",
        name: "Engineering Manager",
        email: "mgr.eng@nexusops.ai",
        role: Role.MANAGER,
      },
      _count: { reports: 0 },
    },
    {
      id: "u-solo-1",
      name: "Solo Contributor",
      email: "solo@nexusops.ai",
      role: Role.EMPLOYEE,
      isActive: true,
      departmentId: null,
      managerId: null,
      createdAt: new Date("2026-04-01T00:00:00Z"),
      department: null,
      manager: null,
      _count: { reports: 0 },
    },
  ];

  describe("DirectoryRepository", () => {
    it("findDirectoryUsers returns paginated safe fields and excludes passwordHash", async () => {
      vi.mocked(prisma.user.count).mockResolvedValueOnce(4);
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce(mockUsers as any);

      const result = await directoryRepository.findDirectoryUsers({
        page: 1,
        limit: 10,
        search: "eng",
      });

      expect(result.total).toBe(4);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(1);
      expect(result.users).toHaveLength(4);

      // Verify safe fields and NO passwordHash or tokens
      result.users.forEach((user) => {
        expect(user).toHaveProperty("id");
        expect(user).toHaveProperty("name");
        expect(user).toHaveProperty("email");
        expect(user).toHaveProperty("role");
        expect(user).toHaveProperty("department");
        expect(user).toHaveProperty("manager");
        expect(user).toHaveProperty("directReportsCount");
        expect((user as any).passwordHash).toBeUndefined();
        expect((user as any).refreshToken).toBeUndefined();
        expect((user as any).tokenHash).toBeUndefined();
      });

      // Verify Prisma call filters for isActive: true
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            OR: expect.arrayContaining([
              { name: { contains: "eng", mode: "insensitive" } },
              { email: { contains: "eng", mode: "insensitive" } },
              { department: { name: { contains: "eng", mode: "insensitive" } } },
            ]),
          }),
        })
      );
    });

    it("findDirectoryUsers applies department and role filters correctly", async () => {
      vi.mocked(prisma.user.count).mockResolvedValueOnce(1);
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([mockUsers[1]] as any);

      await directoryRepository.findDirectoryUsers({
        departmentId: "dept-eng",
        role: Role.MANAGER,
      });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            departmentId: "dept-eng",
            role: Role.MANAGER,
          }),
        })
      );
    });

    it("findDepartments returns all departments with active member count", async () => {
      vi.mocked(prisma.department.findMany).mockResolvedValueOnce([
        {
          id: "dept-eng",
          name: "Engineering",
          _count: { users: 3 },
        },
        {
          id: "dept-ops",
          name: "Operations",
          _count: { users: 2 },
        },
      ] as any);

      const depts = await directoryRepository.findDepartments();
      expect(depts).toEqual([
        { id: "dept-eng", name: "Engineering", userCount: 3 },
        { id: "dept-ops", name: "Operations", userCount: 2 },
      ]);
    });

    it("findOrgRoots returns top level roots and users without a manager", async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
        mockUsers[0], // Head with reports
        mockUsers[3], // Solo without manager or reports
      ] as any);

      const roots = await directoryRepository.findOrgRoots();
      expect(roots).toHaveLength(2);
      expect(roots[0].id).toBe("u-head-1");
      expect(roots[0].directReportsCount).toBe(2);
      expect(roots[1].id).toBe("u-solo-1");
      expect(roots[1].directReportsCount).toBe(0);

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            managerId: null,
          }),
        })
      );
    });

    it("findDirectReports returns reports for a given managerId", async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([mockUsers[2]] as any);

      const reports = await directoryRepository.findDirectReports("u-mgr-1");
      expect(reports).toHaveLength(1);
      expect(reports[0].id).toBe("u-dev-1");
      expect(reports[0].managerId).toBe("u-mgr-1");
    });

    it("findUserTeam builds full team context: user, manager, peers, and direct reports", async () => {
      // 1. find user
      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce(mockUsers[1] as any) // target user (Engineering Manager)
        .mockResolvedValueOnce(mockUsers[0] as any); // manager (Engineering Head)

      // 2. peers
      vi.mocked(prisma.user.findMany)
        .mockResolvedValueOnce([]) // peers
        .mockResolvedValueOnce([mockUsers[2]] as any); // direct reports (Dev One)

      const team = await directoryRepository.findUserTeam("u-mgr-1");
      expect(team).not.toBeNull();
      expect(team?.user.id).toBe("u-mgr-1");
      expect(team?.manager?.id).toBe("u-head-1");
      expect(team?.directReports).toHaveLength(1);
      expect(team?.directReports[0].id).toBe("u-dev-1");
      expect(team?.peers).toEqual([]);
    });

    it("findUserTeam returns null when user does not exist", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

      const team = await directoryRepository.findUserTeam("non-existent");
      expect(team).toBeNull();
    });
  });

  describe("DirectoryService", () => {
    it("getUserTeam throws 404 AppError when user is not found", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

      await expect(directoryService.getUserTeam("missing-user")).rejects.toThrow(
        "User not found in directory"
      );
    });
  });

  describe("DirectoryController", () => {
    it("getDirectory returns 200 with directory data", async () => {
      vi.mocked(prisma.user.count).mockResolvedValueOnce(1);
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([mockUsers[0]] as any);

      const req = { query: { page: "1", limit: "10" } } as unknown as Request;
      const res = createMockResponse();
      let nextCalled = false;
      const next: NextFunction = () => {
        nextCalled = true;
      };

      await directoryController.getDirectory(req, res, next);
      expect(nextCalled).toBe(false);
      expect(res.statusCode).toBe(200);
      expect(res.body.users).toHaveLength(1);
      expect(res.body.total).toBe(1);
    });

    it("getDepartments returns 200 with departments list", async () => {
      vi.mocked(prisma.department.findMany).mockResolvedValueOnce([]);

      const req = {} as Request;
      const res = createMockResponse();
      const next: NextFunction = vi.fn();

      await directoryController.getDepartments(req, res, next);
      expect(res.statusCode).toBe(200);
      expect(res.body.departments).toEqual([]);
    });

    it("getOrgRoots returns 200 with root nodes", async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([mockUsers[0]] as any);

      const req = { query: {} } as unknown as Request;
      const res = createMockResponse();
      const next: NextFunction = vi.fn();

      await directoryController.getOrgRoots(req, res, next);
      expect(res.statusCode).toBe(200);
      expect(res.body.roots).toHaveLength(1);
    });

    it("getDirectReports returns 200 with direct reports", async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValueOnce([mockUsers[1]] as any);

      const req = { params: { managerId: "u-head-1" } } as unknown as Request;
      const res = createMockResponse();
      const next: NextFunction = vi.fn();

      await directoryController.getDirectReports(req, res, next);
      expect(res.statusCode).toBe(200);
      expect(res.body.reports).toHaveLength(1);
    });
  });

  describe("Authentication & RBAC Permissions on /api/directory", () => {
    it("rejects unauthenticated requests with 401 Unauthorized", async () => {
      const req = { headers: {} } as Request;
      const res = createMockResponse();
      let capturedError: any = null;
      const next: NextFunction = (err?: any) => {
        capturedError = err;
      };

      await authenticate(req, res, next);
      expect(capturedError).toBeInstanceOf(AppError);
      expect(capturedError.statusCode).toBe(401);
    });

    it("permits any logged-in role (EMPLOYEE, MANAGER, ADMIN)", async () => {
      const roles: Role[] = [Role.EMPLOYEE, Role.MANAGER, Role.ADMIN];

      for (const role of roles) {
        const token = signAccessToken({
          sub: `user-${role.toLowerCase()}`,
          email: `${role.toLowerCase()}@nexusops.ai`,
          role,
        });

        vi.mocked(userRepository.findById).mockResolvedValueOnce({
          id: `user-${role.toLowerCase()}`,
          name: `User ${role}`,
          email: `${role.toLowerCase()}@nexusops.ai`,
          role,
          isActive: true,
        } as any);

        const req = {
          headers: { authorization: `Bearer ${token}` },
        } as unknown as Request;
        const res = createMockResponse();
        let nextCalled = false;
        const next: NextFunction = (err?: any) => {
          expect(err).toBeUndefined();
          nextCalled = true;
        };

        await authenticate(req, res, next);
        expect(nextCalled).toBe(true);
        expect(req.user?.role).toBe(role);
      }
    });
  });
});
