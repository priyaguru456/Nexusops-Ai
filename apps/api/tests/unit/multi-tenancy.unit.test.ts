import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { DocVisibility, Role } from "@prisma/client";
import {
  DEFAULT_ORGANIZATION_ID,
  assertSameTenant,
  isAdminRole,
  isSuperAdmin,
  resolveTenantId,
  tenantWhere,
} from "../../src/lib/tenant";
import { authenticate, authorize, authorizeExact } from "../../src/middleware/auth";
import { signAccessToken } from "../../src/lib/jwt";
import { AppError } from "../../src/lib/errors";
import { organizationService } from "../../src/modules/organizations/organization.service";
import { organizationRepository } from "../../src/modules/organizations/organization.repository";
import { userRepository } from "../../src/modules/users/user.repository";
import { auditService } from "../../src/modules/audit/audit.service";
import { requestService } from "../../src/modules/requests/request.service";
import { requestRepository } from "../../src/modules/requests/request.repository";
import { canUserAccessDocument } from "../../src/modules/documents/document.service";
import { buildPermissionFilterSql } from "../../src/modules/ai/retrieval.service";
import type { AuthenticatedUser } from "../../src/types/express";

vi.mock("../../src/modules/organizations/organization.repository", () => ({
  organizationRepository: {
    findAll: vi.fn(),
    findById: vi.fn(),
    findBySlug: vi.fn(),
    createWithDefaults: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("../../src/modules/users/user.repository", () => ({
  userRepository: {
    findById: vi.fn(),
    findByEmail: vi.fn(),
  },
}));

vi.mock("../../src/modules/requests/request.repository", () => ({
  requestRepository: {
    findById: vi.fn(),
    findAll: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("../../src/modules/audit/audit.service", () => ({
  auditService: {
    log: vi.fn().mockResolvedValue({}),
  },
}));

const ORG_A = "11111111-1111-4111-8111-111111111111";
const ORG_B = "22222222-2222-4222-8222-222222222222";

const makeUser = (overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser => ({
  id: "usr-1",
  name: "Test User",
  email: "user@example.com",
  role: Role.EMPLOYEE,
  isActive: true,
  organizationId: ORG_A,
  departmentId: "dept-1",
  managerId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createMockResponse = () => {
  const res: Partial<Response> & { statusCode?: number; body?: unknown } = {};
  res.status = (code: number) => {
    res.statusCode = code;
    return res as Response;
  };
  res.json = (data: unknown) => {
    res.body = data;
    return res as Response;
  };
  return res as Response & { statusCode?: number; body?: unknown };
};

describe("Multi-Tenancy & SUPER_ADMIN Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Tenant Utility Helpers", () => {
    it("recognizes SUPER_ADMIN and admin hierarchy correctly", () => {
      const superAdmin = makeUser({ role: Role.SUPER_ADMIN, organizationId: null });
      const admin = makeUser({ role: Role.ADMIN });
      const manager = makeUser({ role: Role.MANAGER });
      const employee = makeUser({ role: Role.EMPLOYEE });

      expect(isSuperAdmin(superAdmin)).toBe(true);
      expect(isSuperAdmin(admin)).toBe(false);

      expect(isAdminRole(superAdmin)).toBe(true);
      expect(isAdminRole(admin)).toBe(true);
      expect(isAdminRole(Role.SUPER_ADMIN)).toBe(true);
      expect(isAdminRole(Role.ADMIN)).toBe(true);
      expect(isAdminRole(manager)).toBe(false);
      expect(isAdminRole(employee)).toBe(false);
    });

    it("resolveTenantId binds regular users to their own organization and lets SUPER_ADMIN target an org", () => {
      const adminA = makeUser({ role: Role.ADMIN, organizationId: ORG_A });
      const superAdmin = makeUser({ role: Role.SUPER_ADMIN, organizationId: null });
      const legacyMock = { ...makeUser(), organizationId: undefined } as unknown as AuthenticatedUser;

      expect(resolveTenantId(adminA)).toBe(ORG_A);
      expect(() => resolveTenantId(adminA, ORG_B)).toThrow(/different organization/i);

      expect(resolveTenantId(superAdmin, ORG_B)).toBe(ORG_B);
      expect(resolveTenantId(superAdmin)).toBe(DEFAULT_ORGANIZATION_ID);
      expect(resolveTenantId(legacyMock)).toBe(DEFAULT_ORGANIZATION_ID);
    });

    it("tenantWhere returns empty filter for SUPER_ADMIN unless scoped, and organizationId filter for tenant users", () => {
      const superAdmin = makeUser({ role: Role.SUPER_ADMIN, organizationId: null });
      const empA = makeUser({ role: Role.EMPLOYEE, organizationId: ORG_A });

      expect(tenantWhere(superAdmin)).toEqual({});
      expect(tenantWhere(superAdmin, ORG_B)).toEqual({ organizationId: ORG_B });
      expect(tenantWhere(empA)).toEqual({ organizationId: ORG_A });
    });

    it("assertSameTenant blocks cross-tenant access for regular users and permits SUPER_ADMIN", () => {
      const adminA = makeUser({ role: Role.ADMIN, organizationId: ORG_A });
      const superAdmin = makeUser({ role: Role.SUPER_ADMIN, organizationId: null });

      expect(() => assertSameTenant(ORG_A, adminA)).not.toThrow();
      expect(() => assertSameTenant(ORG_B, adminA, "Request not found")).toThrow(/Request not found/);
      expect(() => assertSameTenant(ORG_B, superAdmin)).not.toThrow();
    });
  });

  describe("Auth Middleware: Tenant Active Enforcement & Role Hierarchy", () => {
    it("authorize(Role.ADMIN) permits SUPER_ADMIN, while authorizeExact rejects ADMIN on SUPER_ADMIN routes", () => {
      const superAdmin = makeUser({ role: Role.SUPER_ADMIN, organizationId: null });
      const tenantAdmin = makeUser({ role: Role.ADMIN, organizationId: ORG_A });

      let err1: unknown;
      authorize(Role.ADMIN)(
        { user: superAdmin } as unknown as Request,
        createMockResponse(),
        (e?: unknown) => {
          err1 = e;
        }
      );
      expect(err1).toBeUndefined();

      let err2: unknown;
      authorizeExact(Role.SUPER_ADMIN)(
        { user: tenantAdmin } as unknown as Request,
        createMockResponse(),
        (e?: unknown) => {
          err2 = e;
        }
      );
      expect(err2).toBeInstanceOf(AppError);
      expect((err2 as AppError).statusCode).toBe(403);

      let err3: unknown;
      authorizeExact(Role.SUPER_ADMIN)(
        { user: superAdmin } as unknown as Request,
        createMockResponse(),
        (e?: unknown) => {
          err3 = e;
        }
      );
      expect(err3).toBeUndefined();
    });

    it("authenticate rejects users belonging to a suspended organization with 403", async () => {
      const token = signAccessToken({
        sub: "usr-suspended",
        email: "emp@suspended.com",
        role: Role.EMPLOYEE,
        organizationId: ORG_B,
      });

      vi.mocked(userRepository.findById).mockResolvedValueOnce({
        ...makeUser({ id: "usr-suspended", organizationId: ORG_B }),
        organization: { id: ORG_B, name: "Suspended Co", slug: "suspended", isActive: false },
      } as any);

      let capturedError: unknown;
      await authenticate(
        { headers: { authorization: `Bearer ${token}` } } as unknown as Request,
        createMockResponse(),
        ((e?: unknown) => {
          capturedError = e;
        }) as NextFunction
      );

      expect(capturedError).toBeInstanceOf(AppError);
      expect((capturedError as AppError).statusCode).toBe(403);
      expect((capturedError as AppError).message).toMatch(/suspended or inactive/i);
    });

    it("authenticate allows SUPER_ADMIN with organizationId = null", async () => {
      const token = signAccessToken({
        sub: "usr-super",
        email: "superadmin@nexusops.com",
        role: Role.SUPER_ADMIN,
        organizationId: null,
      });

      vi.mocked(userRepository.findById).mockResolvedValueOnce({
        ...makeUser({ id: "usr-super", role: Role.SUPER_ADMIN, organizationId: null }),
        organization: null,
      } as any);

      let capturedError: unknown;
      const req = { headers: { authorization: `Bearer ${token}` } } as unknown as Request;
      await authenticate(req, createMockResponse(), ((e?: unknown) => {
        capturedError = e;
      }) as NextFunction);

      expect(capturedError).toBeUndefined();
      expect(req.user?.role).toBe(Role.SUPER_ADMIN);
    });
  });

  describe("OrganizationService CRUD & Governance", () => {
    const superAdmin = makeUser({ id: "usr-super", role: Role.SUPER_ADMIN, organizationId: null });

    it("creates a new organization with defaults and audits creation", async () => {
      vi.mocked(organizationRepository.findBySlug).mockResolvedValueOnce(null);
      vi.mocked(userRepository.findByEmail).mockResolvedValueOnce(null);
      vi.mocked(organizationRepository.createWithDefaults).mockResolvedValueOnce({
        organization: { id: ORG_B, name: "Acme Corp", slug: "acme", isActive: true },
        initialAdmin: { id: "adm-b", email: "admin@acme.com", name: "Acme Admin", role: Role.ADMIN },
      } as any);

      const res = await organizationService.create(
        {
          name: "Acme Corp",
          slug: "acme",
          adminName: "Acme Admin",
          adminEmail: "admin@acme.com",
          adminPassword: "Password123!",
        },
        superAdmin
      );

      expect(res.organization.slug).toBe("acme");
      expect(organizationRepository.createWithDefaults).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Acme Corp",
          slug: "acme",
          initialAdmin: expect.objectContaining({ email: "admin@acme.com" }),
        })
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "ORGANIZATION_CREATED",
          organizationId: ORG_B,
        })
      );
    });

    it("rejects duplicate slug with 409 Conflict", async () => {
      vi.mocked(organizationRepository.findBySlug).mockResolvedValueOnce({
        id: ORG_A,
        slug: "acme",
      } as any);

      await expect(
        organizationService.create({ name: "Acme Duplicate", slug: "acme" }, superAdmin)
      ).rejects.toThrow(/already taken/i);
    });

    it("suspends an organization via update and writes audit log", async () => {
      vi.mocked(organizationRepository.findById).mockResolvedValueOnce({
        id: ORG_B,
        name: "Acme Corp",
        slug: "acme",
        isActive: true,
      } as any);
      vi.mocked(organizationRepository.update).mockResolvedValueOnce({
        id: ORG_B,
        name: "Acme Corp",
        slug: "acme",
        isActive: false,
      } as any);

      const updated = await organizationService.update(ORG_B, { isActive: false }, superAdmin);
      expect(updated.isActive).toBe(false);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "ORGANIZATION_UPDATED",
          organizationId: ORG_B,
        })
      );
    });
  });

  describe("Cross-Tenant Service & RAG SQL Isolation", () => {
    it("RequestService blocks Org B Admin from reading Org A's request while allowing SUPER_ADMIN", async () => {
      const adminB = makeUser({ id: "adm-b", role: Role.ADMIN, organizationId: ORG_B });
      const superAdmin = makeUser({ id: "sup-1", role: Role.SUPER_ADMIN, organizationId: null });

      vi.mocked(requestRepository.findById).mockResolvedValue({
        id: "req-org-a",
        organizationId: ORG_A,
        requesterId: "emp-a",
        requester: { departmentId: "dept-a" },
      } as any);

      await expect(requestService.getRequestById("req-org-a", adminB)).rejects.toThrow(
        /Request not found/i
      );

      const superResult = await requestService.getRequestById("req-org-a", superAdmin);
      expect(superResult.id).toBe("req-org-a");
    });

    it("canUserAccessDocument denies cross-tenant documents even with DocVisibility.ALL", () => {
      const userB = makeUser({ id: "emp-b", role: Role.ADMIN, organizationId: ORG_B });
      const superAdmin = makeUser({ id: "sup-1", role: Role.SUPER_ADMIN, organizationId: null });

      const docA = {
        organizationId: ORG_A,
        visibility: DocVisibility.ALL,
        departmentId: null,
        uploadedById: "adm-a",
      };

      expect(canUserAccessDocument(userB, docA)).toBe(false);
      expect(canUserAccessDocument(superAdmin, docA)).toBe(true);
    });

    it("buildPermissionFilterSql strictly includes organizationId predicate for tenant users", () => {
      const sqlTenant = buildPermissionFilterSql({
        id: "emp-a",
        role: Role.EMPLOYEE,
        departmentId: "dept-a",
        organizationId: ORG_A,
      });
      expect(sqlTenant.strings.join("?")).toContain(`d."organizationId" =`);
      expect(sqlTenant.values).toContain(ORG_A);

      const sqlNoOrg = buildPermissionFilterSql({
        id: "broken-emp",
        role: Role.EMPLOYEE,
        departmentId: null,
        organizationId: null,
      });
      expect(sqlNoOrg.strings.join("?")).toContain("FALSE");

      const sqlSuper = buildPermissionFilterSql({
        id: "sup-1",
        role: Role.SUPER_ADMIN,
        departmentId: null,
        organizationId: null,
      });
      expect(sqlSuper.strings.join("?")).toContain("TRUE");
    });
  });
});
