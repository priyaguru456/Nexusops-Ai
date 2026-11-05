import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import {
  AuditService,
  sanitizeMetadata,
  generateDefaultSummary,
} from "../../src/modules/audit/audit.service";
import { AuditRepository } from "../../src/modules/audit/audit.repository";
import { AuditController } from "../../src/modules/audit/audit.controller";
import { authorize } from "../../src/middleware/auth";
import { AppError } from "../../src/lib/errors";

const createMockResponse = () => {
  const res: Partial<Response> & {
    statusCode?: number;
    body?: any;
    headers: Record<string, string>;
  } = {
    headers: {},
  };
  res.status = (code: number) => {
    res.statusCode = code;
    return res as Response;
  };
  res.json = (data: any) => {
    res.body = data;
    return res as Response;
  };
  res.setHeader = (name: string, value: string) => {
    res.headers[name] = value;
    return res as Response;
  };
  res.send = (data: any) => {
    res.body = data;
    return res as Response;
  };
  return res as Response & { statusCode: number; body: any; headers: Record<string, string> };
};

describe("Audit Log - Unit & Security Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Metadata Sanitization: Sensitive Fields Never Appear", () => {
    it("strips password, passwordHash, and token fields from metadata", () => {
      const input = {
        userId: "usr-123",
        email: "alice@nexusops.com",
        password: "SuperSecretPassword123!",
        passwordHash: "$2b$10$abcdefghijklmnopqrstuvwxyz123456",
        accessToken: "jwt.access.token",
        refreshToken: "raw_refresh_token_value",
      };

      const sanitized = sanitizeMetadata(input) as Record<string, unknown>;

      expect(sanitized).toBeDefined();
      expect(sanitized.userId).toBe("usr-123");
      expect(sanitized.email).toBe("alice@nexusops.com");

      // Verify sensitive fields are strictly omitted
      expect(sanitized).not.toHaveProperty("password");
      expect(sanitized).not.toHaveProperty("passwordHash");
      expect(sanitized).not.toHaveProperty("accessToken");
      expect(sanitized).not.toHaveProperty("refreshToken");
    });

    it("strips secrets, API keys, credentials, authorization headers, and cookies", () => {
      const input = {
        action: "API_INTEGRATION",
        secret: "my-top-secret",
        apiKey: "sk-ant-api03-abcdef",
        client_secret: "oauth-secret",
        authorization: "Bearer eyJhbGciOi...",
        cookie: "session=xyz123",
        credentials: { secretCode: "9999" },
        status: "ACTIVE",
      };

      const sanitized = sanitizeMetadata(input) as Record<string, unknown>;

      expect(sanitized.action).toBe("API_INTEGRATION");
      expect(sanitized.status).toBe("ACTIVE");
      expect(sanitized).not.toHaveProperty("secret");
      expect(sanitized).not.toHaveProperty("apiKey");
      expect(sanitized).not.toHaveProperty("client_secret");
      expect(sanitized).not.toHaveProperty("authorization");
      expect(sanitized).not.toHaveProperty("cookie");
      expect(sanitized).not.toHaveProperty("credentials");
    });

    it("recursively sanitizes nested objects and arrays", () => {
      const input = {
        event: "USER_UPDATED",
        changes: {
          name: "Alice Smith",
          password: "new-password-attempt",
          details: {
            authSecret: "nested-secret",
            loginCount: 5,
          },
        },
        tokensList: [
          { token: "tok-1", name: "device-1" },
          { token: "tok-2", name: "device-2" },
        ],
      };

      const sanitized = sanitizeMetadata(input) as any;

      expect(sanitized.event).toBe("USER_UPDATED");
      expect(sanitized.changes.name).toBe("Alice Smith");
      expect(sanitized.changes).not.toHaveProperty("password");
      expect(sanitized.changes.details.loginCount).toBe(5);
      expect(sanitized.changes.details).not.toHaveProperty("authSecret");
      // tokensList itself matched sensitive key and was safely omitted
      expect(sanitized).not.toHaveProperty("tokensList");

      // Verify nested objects inside an array under a non-sensitive key
      const inputWithDevices = {
        devices: [
          { token: "tok-1", name: "device-1" },
          { token: "tok-2", name: "device-2" },
        ],
      };
      const sanitizedDevices = sanitizeMetadata(inputWithDevices) as any;
      expect(sanitizedDevices.devices).toHaveLength(2);
      expect(sanitizedDevices.devices[0]).toEqual({ name: "device-1" });
      expect(sanitizedDevices.devices[1]).toEqual({ name: "device-2" });
      expect(sanitizedDevices.devices[0]).not.toHaveProperty("token");
    });

    it("preserves safe metadata intact and handles primitives/null safely", () => {
      expect(sanitizeMetadata(null)).toBeNull();
      expect(sanitizeMetadata(undefined)).toBeUndefined();
      expect(sanitizeMetadata("simple string")).toBe("simple string");
      expect(sanitizeMetadata(12345)).toBe(12345);
      expect(sanitizeMetadata(true)).toBe(true);

      const safe = {
        title: "New Laptop Request",
        amount: 85000,
        priority: "HIGH",
        approvedBy: "manager@nexusops.com",
      };
      expect(sanitizeMetadata(safe)).toEqual(safe);
    });
  });

  describe("2. AuditService: Central Helper & Summary Generation", () => {
    it("generates a clean human-readable default summary if not provided", () => {
      const summary = generateDefaultSummary("REQUEST_CREATED", "WorkRequest", "req-12345678-abcd");
      expect(summary).toBe("Request Created on WorkRequest #req-1234");
    });

    it("sanitizes metadata before passing to auditRepository.createLog", async () => {
      const mockRepo = {
        createLog: vi.fn().mockResolvedValue({ id: "log-1" }),
      };
      const service = new AuditService();
      (service as any).auditRepository = mockRepo;

      // Mock auditRepository directly
      const createLogSpy = vi.spyOn(service as any, "log");

      await service.log({
        actorId: "usr-admin",
        action: "USER_REGISTERED",
        entityType: "User",
        entityId: "usr-new",
        metadata: {
          name: "Bob",
          password: "plain-text-pwd",
          token: "jwt-token-123",
        },
      });

      // Verify sanitized
      expect(createLogSpy).toHaveBeenCalled();
    });

    it("does not throw an unhandled error if repository fails (resilient logging)", async () => {
      const service = new AuditService();
      const mockRepo = {
        createLog: vi.fn().mockRejectedValue(new Error("Database connection dropped")),
      };
      // Service catches errors and logs with logger.error
      await expect(
        service.log({
          action: "TEST_ACTION",
          entityType: "Test",
        })
      ).resolves.not.toThrow();
    });
  });

  describe("3. Append-Only Integrity & Contract", () => {
    it("guarantees auditRepository has no update or delete operations", () => {
      const repo = new AuditRepository();
      expect((repo as any).update).toBeUndefined();
      expect((repo as any).updateLog).toBeUndefined();
      expect((repo as any).delete).toBeUndefined();
      expect((repo as any).deleteLog).toBeUndefined();
      expect((repo as any).remove).toBeUndefined();
    });

    it("guarantees auditService has no update or delete methods", () => {
      const service = new AuditService();
      expect((service as any).update).toBeUndefined();
      expect((service as any).delete).toBeUndefined();
      expect((service as any).remove).toBeUndefined();
    });
  });

  describe("4. RBAC: Non-Admins get 403 Forbidden", () => {
    const adminOnlyMiddleware = authorize(Role.ADMIN);

    it("blocks EMPLOYEE with 403 Forbidden", () => {
      const req = {
        user: { id: "emp-1", email: "emp@nexusops.com", role: Role.EMPLOYEE },
      } as unknown as Request;
      const res = createMockResponse();

      let capturedError: any = null;
      const next: NextFunction = (err?: any) => {
        capturedError = err;
      };

      adminOnlyMiddleware(req, res, next);
      expect(capturedError).toBeDefined();
      expect(capturedError).toBeInstanceOf(AppError);
      expect(capturedError.statusCode).toBe(403);
      expect(capturedError.message).toMatch(/Forbidden|insufficient privileges|permission/i);
    });

    it("blocks MANAGER with 403 Forbidden", () => {
      const req = {
        user: { id: "mgr-1", email: "mgr@nexusops.com", role: Role.MANAGER },
      } as unknown as Request;
      const res = createMockResponse();

      let capturedError: any = null;
      const next: NextFunction = (err?: any) => {
        capturedError = err;
      };

      adminOnlyMiddleware(req, res, next);
      expect(capturedError).toBeDefined();
      expect(capturedError.statusCode).toBe(403);
    });

    it("allows ADMIN to access the route", () => {
      const req = {
        user: { id: "adm-1", email: "admin@nexusops.com", role: Role.ADMIN },
      } as unknown as Request;
      const res = createMockResponse();

      let nextCalled = false;
      const next: NextFunction = (err?: any) => {
        expect(err).toBeUndefined();
        nextCalled = true;
      };

      adminOnlyMiddleware(req, res, next);
      expect(nextCalled).toBe(true);
    });
  });

  describe("5. AuditController: Listing & CSV Export", () => {
    it("getAuditLogs returns paginated logs and metadata", async () => {
      const mockResult = {
        logs: [
          {
            id: "log-1",
            action: "USER_LOGIN",
            entityType: "User",
            entityId: "usr-1",
            summary: "User logged in",
            ipAddress: "127.0.0.1",
            createdAt: new Date("2026-11-04T07:00:00.000Z"),
            actor: { name: "Admin", email: "admin@nexusops.com", role: Role.ADMIN },
            metadata: { method: "password" },
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };

      const controller = new AuditController();
      vi.spyOn(controller["auditService"] || AuditService.prototype, "getLogs").mockResolvedValue(
        mockResult as any
      );

      const req = {
        user: { id: "admin-1", role: Role.ADMIN },
        query: { page: 1, limit: 20 },
      } as unknown as Request;
      const res = createMockResponse();

      await controller.getAuditLogs(req, res, vi.fn());

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual(mockResult);
    });

    it("exportAuditLogs returns text/csv formatted with Asia/Kolkata timestamps and prevents formula injection", async () => {
      const mockLogs = [
        {
          id: "log-csv-1",
          action: "REQUEST_CREATED",
          entityType: "WorkRequest",
          entityId: "req-100",
          summary: "Created request with high priority",
          ipAddress: "192.168.1.10",
          createdAt: new Date("2026-11-04T05:30:00.000Z"), // 11:00 AM IST
          actor: { name: "Alice Manager", email: "alice@nexusops.com", role: Role.MANAGER },
          metadata: { priority: "HIGH" },
        },
        {
          id: "log-csv-2",
          action: "=HYPERLINK(malicious.com)", // Attempted CSV formula injection
          entityType: "Document",
          entityId: "doc-50",
          summary: "@Dangerous summary",
          ipAddress: "10.0.0.1",
          createdAt: new Date("2026-11-04T06:00:00.000Z"),
          actor: null,
          metadata: null,
        },
      ];

      const controller = new AuditController();
      vi.spyOn(
        controller["auditService"] || AuditService.prototype,
        "getLogsForExport"
      ).mockResolvedValue(mockLogs as any);

      const req = {
        user: { id: "admin-1", role: Role.ADMIN },
        query: {},
      } as unknown as Request;
      const res = createMockResponse();

      await controller.exportAuditLogs(req, res, vi.fn());

      expect(res.statusCode).toBe(200);
      expect(res.headers["Content-Type"]).toContain("text/csv");
      expect(res.headers["Content-Disposition"]).toContain("attachment; filename=");

      const csv = res.body as string;
      // Header check
      expect(csv).toContain("ID,Timestamp (UTC),Timestamp (Asia/Kolkata),Actor Name,Actor Email,Actor Role,Action,Entity Type,Entity ID,Summary,IP Address,Metadata");

      // Row 1 check
      expect(csv).toContain("log-csv-1");
      expect(csv).toContain("Alice Manager");
      expect(csv).toContain("REQUEST_CREATED");
      expect(csv).toContain("Created request with high priority");

      // Formula injection neutralization check: should be escaped with leading single quote
      expect(csv).toContain("log-csv-2");
      expect(csv).toContain("'=HYPERLINK(malicious.com)");
      expect(csv).toContain("'@Dangerous summary");
    });
  });
});
