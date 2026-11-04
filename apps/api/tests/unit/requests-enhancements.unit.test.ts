import { describe, it, expect, vi, beforeEach } from "vitest";
import { Role, RequestStatus, Priority, RequestCategory } from "@prisma/client";
import { requestService } from "../../src/modules/requests/request.service";
import { requestRepository } from "../../src/modules/requests/request.repository";
import { requestController } from "../../src/modules/requests/request.controller";
import type { AuthenticatedUser } from "../../src/types/express";

vi.mock("../../src/modules/requests/request.repository", () => ({
  requestRepository: {
    create: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
    findAll: vi.fn(),
    getStatusCounts: vi.fn(),
    getActivityHistory: vi.fn(),
    addAttachment: vi.fn(),
  },
}));

vi.mock("../../src/modules/audit/audit.service", () => ({
  auditService: {
    log: vi.fn().mockResolvedValue({}),
  },
}));

describe("Request Enhancements Unit Tests", () => {
  const employeeUser: AuthenticatedUser = {
    id: "emp-1",
    email: "emp@example.com",
    name: "Employee User",
    role: Role.EMPLOYEE,
    departmentId: "dept-eng",
  };

  const managerUser: AuthenticatedUser = {
    id: "mgr-1",
    email: "mgr@example.com",
    name: "Manager User",
    role: Role.MANAGER,
    departmentId: "dept-eng",
  };

  const adminUser: AuthenticatedUser = {
    id: "adm-1",
    email: "adm@example.com",
    name: "Admin User",
    role: Role.ADMIN,
    departmentId: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getStatusCounts", () => {
    const mockCounts = {
      all: 10,
      pendingApproval: 4,
      approved: 2,
      inProgress: 2,
      completed: 1,
      rejected: 1,
      draft: 0,
      cancelled: 0,
    };

    it("scopes counts to requesterId for EMPLOYEE role", async () => {
      vi.mocked(requestRepository.getStatusCounts).mockResolvedValueOnce(mockCounts);

      const result = await requestService.getStatusCounts(employeeUser);

      expect(requestRepository.getStatusCounts).toHaveBeenCalledWith({
        requesterId: "emp-1",
      });
      expect(result).toEqual(mockCounts);
    });

    it("scopes counts to requester or same department for MANAGER role", async () => {
      vi.mocked(requestRepository.getStatusCounts).mockResolvedValueOnce(mockCounts);

      const result = await requestService.getStatusCounts(managerUser);

      expect(requestRepository.getStatusCounts).toHaveBeenCalledWith({
        OR: [
          { requesterId: "mgr-1" },
          { requester: { departmentId: "dept-eng" } },
        ],
      });
      expect(result).toEqual(mockCounts);
    });

    it("does not scope counts for ADMIN role (sees all)", async () => {
      vi.mocked(requestRepository.getStatusCounts).mockResolvedValueOnce(mockCounts);

      const result = await requestService.getStatusCounts(adminUser);

      expect(requestRepository.getStatusCounts).toHaveBeenCalledWith({});
      expect(result).toEqual(mockCounts);
    });
  });

  describe("getRequests with PENDING_APPROVAL filter", () => {
    it("passes PENDING_APPROVAL filter to repository with user visibility scoping", async () => {
      vi.mocked(requestRepository.findAll).mockResolvedValueOnce({
        requests: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 1,
      } as any);

      await requestService.getRequests(employeeUser, {
        status: "PENDING_APPROVAL",
        page: 1,
        limit: 10,
        sortBy: "createdAt",
        sortOrder: "desc",
      });

      expect(requestRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "PENDING_APPROVAL",
        }),
        { requesterId: "emp-1" }
      );
    });
  });

  describe("RequestController.getStatusCounts", () => {
    it("returns status counts for authenticated user with 200 OK", async () => {
      const mockCounts = {
        all: 5,
        pendingApproval: 2,
        approved: 1,
        inProgress: 1,
        completed: 1,
        rejected: 0,
        draft: 0,
        cancelled: 0,
      };

      vi.mocked(requestRepository.getStatusCounts).mockResolvedValueOnce(mockCounts);

      const req: any = { user: managerUser };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await requestController.getStatusCounts(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ counts: mockCounts });
      expect(next).not.toHaveBeenCalled();
    });

    it("forwards unauthorized error if req.user is missing", async () => {
      const req: any = {};
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await requestController.getStatusCounts(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    });
  });
});
