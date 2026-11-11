import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { Role, DocStatus } from "@prisma/client";
import { authorize, authenticate } from "../../src/middleware/auth";
import { documentController } from "../../src/modules/documents/document.controller";
import { documentService } from "../../src/modules/documents/document.service";
import { userRepository } from "../../src/modules/users/user.repository";
import { signAccessToken } from "../../src/lib/jwt";
import { AppError } from "../../src/lib/errors";

vi.mock("../../src/modules/documents/document.service", () => ({
  documentService: {
    reprocess: vi.fn(),
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

describe("Reprocess Route - RBAC & Controller Authorization", () => {
  const validDocId = "11111111-1111-1111-1111-111111111111";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("authorize(Role.ADMIN, Role.MANAGER) middleware", () => {
    const authMiddleware = authorize(Role.ADMIN, Role.MANAGER);

    it("allows ADMIN role to proceed", () => {
      const req = {
        user: { id: "admin-1", role: Role.ADMIN },
      } as unknown as Request;
      const res = createMockResponse();
      let nextCalled = false;
      const next: NextFunction = (err?: any) => {
        expect(err).toBeUndefined();
        nextCalled = true;
      };

      authMiddleware(req, res, next);
      expect(nextCalled).toBe(true);
    });

    it("allows MANAGER role to proceed", () => {
      const req = {
        user: { id: "mgr-1", role: Role.MANAGER },
      } as unknown as Request;
      const res = createMockResponse();
      let nextCalled = false;
      const next: NextFunction = (err?: any) => {
        expect(err).toBeUndefined();
        nextCalled = true;
      };

      authMiddleware(req, res, next);
      expect(nextCalled).toBe(true);
    });

    it("rejects EMPLOYEE role with 403 Forbidden", () => {
      const req = {
        user: { id: "emp-1", role: Role.EMPLOYEE },
      } as unknown as Request;
      const res = createMockResponse();
      let capturedError: any = null;
      const next: NextFunction = (err?: any) => {
        capturedError = err;
      };

      authMiddleware(req, res, next);
      expect(capturedError).toBeInstanceOf(AppError);
      expect(capturedError.statusCode).toBe(403);
      expect(capturedError.message).toMatch(/permission/i);
    });

    it("rejects unauthenticated request with 401 Unauthorized", () => {
      const req = {} as Request;
      const res = createMockResponse();
      let capturedError: any = null;
      const next: NextFunction = (err?: any) => {
        capturedError = err;
      };

      authMiddleware(req, res, next);
      expect(capturedError).toBeInstanceOf(AppError);
      expect(capturedError.statusCode).toBe(401);
    });
  });

  describe("authenticate middleware with JWT tokens", () => {
    it("authenticates valid JWT and populates req.user", async () => {
      const token = signAccessToken({
        sub: "user-1",
        email: "test@nexusops.ai",
        role: Role.ADMIN,
      });

      vi.mocked(userRepository.findById).mockResolvedValueOnce({
        id: "user-1",
        email: "test@nexusops.ai",
        role: Role.ADMIN,
        isActive: true,
        organizationId: "00000000-0000-4000-8000-000000000001",
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
      expect(req.user).toBeDefined();
      expect(req.user?.id).toBe("user-1");
    });

    it("rejects missing authorization header with 401", async () => {
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
  });

  describe("documentController.reprocess()", () => {
    it("successfully delegates to documentService.reprocess and responds with 200", async () => {
      const mockDoc = {
        id: validDocId,
        title: "Test Guide",
        status: DocStatus.UPLOADED,
      };
      vi.mocked(documentService.reprocess).mockResolvedValueOnce(mockDoc as any);

      const req = {
        user: { id: "admin-1", role: Role.ADMIN },
        params: { id: validDocId },
      } as unknown as Request;

      const res = createMockResponse();
      const next: NextFunction = vi.fn();

      await documentController.reprocess(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.document).toEqual(mockDoc);
      expect(documentService.reprocess).toHaveBeenCalledWith(validDocId, req.user);
    });

    it("catches errors and forwards to next()", async () => {
      vi.mocked(documentService.reprocess).mockRejectedValueOnce(
        AppError.forbidden("You do not have permission to reprocess this document")
      );

      const req = {
        user: { id: "mgr-1", role: Role.MANAGER },
        params: { id: validDocId },
      } as unknown as Request;

      const res = createMockResponse();
      let capturedError: any = null;
      const next: NextFunction = (err?: any) => {
        capturedError = err;
      };

      await documentController.reprocess(req, res, next);

      expect(capturedError).toBeInstanceOf(AppError);
      expect(capturedError.statusCode).toBe(403);
    });
  });
});
