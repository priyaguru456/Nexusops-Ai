import { describe, it, expect, vi, beforeEach } from "vitest";
import { Role, DocVisibility, DocStatus } from "@prisma/client";
import { policyService, formatKolkataDateTime } from "../../src/modules/policies/policy.service";
import { policyRepository } from "../../src/modules/policies/policy.repository";
import { documentRepository } from "../../src/modules/documents/document.repository";
import { storageService } from "../../src/lib/storage";
import { documentQueue } from "../../src/lib/queue";
import { auditService } from "../../src/modules/audit/audit.service";
import { notificationService } from "../../src/modules/notifications/notification.service";
import { AppError } from "../../src/lib/errors";
import {
  createPolicyMetadataSchema,
  listPoliciesQuerySchema,
  acknowledgePolicySchema,
  complianceSummaryQuerySchema,
} from "../../src/modules/policies/policy.schema";
import type { AuthenticatedUser } from "../../src/types/express";

vi.mock("../../src/lib/prisma", () => ({
  prisma: {
    document: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    documentChunk: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
    },
    acknowledgement: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
    department: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("../../src/modules/documents/document.repository", () => ({
  documentRepository: {
    deleteChunks: vi.fn().mockResolvedValue({ count: 5 }),
    findById: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("../../src/lib/storage", () => ({
  storageService: {
    save: vi.fn().mockResolvedValue({
      relativePath: "policies/test-uuid.pdf",
      fileName: "test-uuid.pdf",
      sizeBytes: 1024,
    }),
    read: vi.fn().mockResolvedValue(Buffer.from("dummy pdf")),
  },
}));

vi.mock("../../src/lib/queue", () => ({
  documentQueue: {
    add: vi.fn().mockResolvedValue({ id: "job-123" }),
  },
}));

vi.mock("../../src/modules/audit/audit.service", () => ({
  auditService: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../src/modules/notifications/notification.service", () => ({
  notificationService: {
    notify: vi.fn().mockResolvedValue(undefined),
    notifyMultiple: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("Policy Hub & Compliance Service Unit Tests", () => {
  const adminUser: AuthenticatedUser = {
    id: "usr-admin-1",
    name: "Admin User",
    email: "admin@nexusops.com",
    role: Role.ADMIN,
    isActive: true,
    departmentId: "dept-it",
    managerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const managerIT: AuthenticatedUser = {
    id: "usr-mgr-it",
    name: "IT Manager",
    email: "manager.it@nexusops.com",
    role: Role.MANAGER,
    isActive: true,
    departmentId: "dept-it",
    managerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const managerHR: AuthenticatedUser = {
    id: "usr-mgr-hr",
    name: "HR Manager",
    email: "manager.hr@nexusops.com",
    role: Role.MANAGER,
    isActive: true,
    departmentId: "dept-hr",
    managerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const employeeIT: AuthenticatedUser = {
    id: "usr-emp-it",
    name: "IT Employee",
    email: "employee.it@nexusops.com",
    role: Role.EMPLOYEE,
    isActive: true,
    departmentId: "dept-it",
    managerId: "usr-mgr-it",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const employeeHR: AuthenticatedUser = {
    id: "usr-emp-hr",
    name: "HR Employee",
    email: "employee.hr@nexusops.com",
    role: Role.EMPLOYEE,
    isActive: true,
    departmentId: "dept-hr",
    managerId: "usr-mgr-hr",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const samplePolicyV1 = {
    id: "pol-100",
    title: "Data Security Policy",
    fileName: "security-v1.pdf",
    filePath: "policies/security-v1.pdf",
    mimeType: "application/pdf",
    sizeBytes: 5000,
    category: "SECURITY",
    isPolicy: true,
    isMandatory: true,
    version: 1,
    status: DocStatus.READY,
    visibility: DocVisibility.ALL,
    errorMessage: null,
    departmentId: "dept-it",
    targetDepartmentId: null,
    uploadedById: adminUser.id,
    createdAt: new Date("2026-10-01T10:00:00Z"),
    targetDepartment: null,
    department: { id: "dept-it", name: "IT" },
    uploadedBy: { id: adminUser.id, name: adminUser.name, email: adminUser.email },
  };

  const mockFile = {
    originalname: "policy-doc.pdf",
    mimetype: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 test dummy policy"),
    size: 1024,
  } as Express.Multer.File;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Policy Schema & Input Validation", () => {
    it("validates valid policy creation inputs for allowed categories (HR, SECURITY, TRAVEL, OTHER)", () => {
      const validCases = [
        { title: "HR Manual", category: "HR", isMandatory: true },
        { title: "Sec Protocol", category: "SECURITY", isMandatory: "true" },
        { title: "Flight Policy", category: "TRAVEL", isMandatory: false },
        { title: "Office Conduct", category: "OTHER", isMandatory: "0" },
      ];

      for (const item of validCases) {
        const parsed = createPolicyMetadataSchema.safeParse(item);
        expect(parsed.success).toBe(true);
      }
    });

    it("rejects invalid categories not in (HR, SECURITY, TRAVEL, OTHER)", () => {
      const invalid = createPolicyMetadataSchema.safeParse({
        title: "Bad Category Policy",
        category: "FINANCE_UNSUPPORTED",
      });
      expect(invalid.success).toBe(false);
      if (!invalid.success) {
        expect(invalid.error.issues[0].message).toContain("Category must be one of: HR, SECURITY, TRAVEL, OTHER");
      }
    });

    it("rejects empty policy titles", () => {
      const invalid = createPolicyMetadataSchema.safeParse({
        title: "   ",
        category: "HR",
      });
      expect(invalid.success).toBe(false);
    });

    it("validates acknowledgement input version schema", () => {
      expect(acknowledgePolicySchema.safeParse({ version: 1 }).success).toBe(true);
      expect(acknowledgePolicySchema.safeParse({ version: "2" }).success).toBe(true);
      expect(acknowledgePolicySchema.safeParse({ version: 0 }).success).toBe(false);
      expect(acknowledgePolicySchema.safeParse({}).success).toBe(true);
    });
  });

  describe("2. Policy Creation & Role Enforcement", () => {
    it("allows ADMIN to create a policy document, saves file, enqueues ingestion, and logs audit", async () => {
      vi.spyOn(policyRepository, "createPolicy").mockResolvedValue({
        ...samplePolicyV1,
      } as any);
      vi.spyOn(policyRepository, "findActiveUsers").mockResolvedValue([employeeIT, employeeHR] as any);

      const created = await policyService.create(
        mockFile,
        {
          title: "Data Security Policy",
          category: "SECURITY",
          isMandatory: true,
          visibility: DocVisibility.ALL,
        },
        adminUser
      );

      expect(created.id).toBe("pol-100");
      expect(storageService.save).toHaveBeenCalledWith(mockFile.buffer, mockFile.originalname);
      expect(documentQueue.add).toHaveBeenCalledWith("process-document", { documentId: "pol-100" });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "POLICY_CREATED",
          entityType: "Policy",
          entityId: "pol-100",
        })
      );
      expect(notificationService.notifyMultiple).toHaveBeenCalled();
    });

    it("blocks non-ADMIN (EMPLOYEE and MANAGER) from creating policies with 403 Forbidden", async () => {
      await expect(
        policyService.create(
          mockFile,
          { title: "Test", category: "HR", isMandatory: false, visibility: DocVisibility.ALL },
          employeeIT
        )
      ).rejects.toThrow(AppError);

      await expect(
        policyService.create(
          mockFile,
          { title: "Test", category: "HR", isMandatory: false, visibility: DocVisibility.ALL },
          managerIT
        )
      ).rejects.toThrow(AppError);
    });
  });

  describe("3. Acknowledgement & Current Version Only Rule", () => {
    it("allows employee to acknowledge current policy version (v1)", async () => {
      vi.spyOn(policyRepository, "findPolicyById").mockResolvedValue(samplePolicyV1 as any);
      vi.spyOn(policyRepository, "findAcknowledgement").mockResolvedValue(null);
      vi.spyOn(policyRepository, "createAcknowledgement").mockResolvedValue({
        id: "ack-1",
        documentId: samplePolicyV1.id,
        userId: employeeIT.id,
        version: 1,
        acknowledgedAt: new Date(),
      });

      const result = await policyService.acknowledge(samplePolicyV1.id, employeeIT, 1);

      expect(result.alreadyAcknowledged).toBe(false);
      expect(policyRepository.createAcknowledgement).toHaveBeenCalledWith({
        documentId: samplePolicyV1.id,
        userId: employeeIT.id,
        version: 1,
      });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "POLICY_ACKNOWLEDGED",
          entityType: "Policy",
          entityId: samplePolicyV1.id,
        })
      );
    });

    it("defaults to current policy version if versionInput is omitted", async () => {
      vi.spyOn(policyRepository, "findPolicyById").mockResolvedValue(samplePolicyV1 as any);
      vi.spyOn(policyRepository, "findAcknowledgement").mockResolvedValue(null);
      vi.spyOn(policyRepository, "createAcknowledgement").mockResolvedValue({
        id: "ack-2",
        documentId: samplePolicyV1.id,
        userId: employeeIT.id,
        version: 1,
        acknowledgedAt: new Date(),
      });

      const result = await policyService.acknowledge(samplePolicyV1.id, employeeIT);

      expect(result.alreadyAcknowledged).toBe(false);
      expect(policyRepository.createAcknowledgement).toHaveBeenCalledWith({
        documentId: samplePolicyV1.id,
        userId: employeeIT.id,
        version: 1,
      });
    });

    it("is idempotent when user has already acknowledged current version", async () => {
      const existingAck = {
        id: "ack-existing",
        documentId: samplePolicyV1.id,
        userId: employeeIT.id,
        version: 1,
        acknowledgedAt: new Date("2026-10-02T12:00:00Z"),
      };
      vi.spyOn(policyRepository, "findPolicyById").mockResolvedValue(samplePolicyV1 as any);
      vi.spyOn(policyRepository, "findAcknowledgement").mockResolvedValue(existingAck);

      const result = await policyService.acknowledge(samplePolicyV1.id, employeeIT, 1);

      expect(result.alreadyAcknowledged).toBe(true);
      expect(result.acknowledgement.id).toBe("ack-existing");
      expect(policyRepository.createAcknowledgement).not.toHaveBeenCalled();
    });

    it("rejects attempt to acknowledge a non-current or stale version with 400 Bad Request", async () => {
      // Policy is at version 2
      vi.spyOn(policyRepository, "findPolicyById").mockResolvedValue({
        ...samplePolicyV1,
        version: 2,
      } as any);

      // User tries to acknowledge v1
      await expect(policyService.acknowledge(samplePolicyV1.id, employeeIT, 1)).rejects.toThrow(
        "Can only acknowledge the current policy version (v2)"
      );

      // User tries to acknowledge non-existent v3
      await expect(policyService.acknowledge(samplePolicyV1.id, employeeIT, 3)).rejects.toThrow(
        "Can only acknowledge the current policy version (v2)"
      );
    });

    it("prevents user from acknowledging a policy targeted to another department", async () => {
      const itTargetedPolicy = {
        ...samplePolicyV1,
        targetDepartmentId: "dept-it",
      };
      vi.spyOn(policyRepository, "findPolicyById").mockResolvedValue(itTargetedPolicy as any);

      // Employee from HR attempts to acknowledge IT-targeted policy
      await expect(policyService.acknowledge(itTargetedPolicy.id, employeeHR)).rejects.toThrow(
        AppError
      );
    });
  });

  describe("4. New Version Upload & Acknowledgement Reset Pipeline", () => {
    it("deletes old chunks, bumps version, resets status, keeps old acknowledgements, and notifies users", async () => {
      vi.spyOn(policyRepository, "findPolicyById").mockResolvedValue(samplePolicyV1 as any);
      vi.spyOn(policyRepository, "updatePolicy").mockResolvedValue({
        ...samplePolicyV1,
        version: 2,
        fileName: "security-v2.pdf",
      } as any);
      vi.spyOn(policyRepository, "findActiveUsers").mockResolvedValue([employeeIT, employeeHR] as any);

      const updated = await policyService.uploadNewVersion(
        samplePolicyV1.id,
        {
          ...mockFile,
          originalname: "security-v2.pdf",
        },
        {},
        adminUser
      );

      // 1. Chunks from the old version must not stay in the index
      expect(documentRepository.deleteChunks).toHaveBeenCalledWith(samplePolicyV1.id);

      // 2. Incremented version
      expect(updated.version).toBe(2);

      // 3. Document ingestion job enqueued for latest version
      expect(documentQueue.add).toHaveBeenCalledWith("process-document", { documentId: samplePolicyV1.id });

      // 4. Audit log written with old and new version
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "POLICY_NEW_VERSION_UPLOADED",
          entityType: "Policy",
          entityId: samplePolicyV1.id,
          metadata: expect.objectContaining({
            oldVersion: 1,
            newVersion: 2,
          }),
        })
      );

      // 5. Eligible users notified of new version requiring re-acknowledgement
      expect(notificationService.notifyMultiple).toHaveBeenCalledWith(
        expect.arrayContaining([employeeIT.id, employeeHR.id]),
        "POLICY_VERSION_UPDATED",
        expect.stringContaining("v2"),
        expect.stringContaining("reset"),
        expect.any(String),
        "Policy",
        samplePolicyV1.id
      );
    });

    it("verifies user's acknowledgement status resets from ACKNOWLEDGED to PENDING after new version", async () => {
      // User had acknowledged v1
      const v1Ack = {
        id: "ack-v1",
        documentId: samplePolicyV1.id,
        userId: employeeIT.id,
        version: 1,
        acknowledgedAt: new Date("2026-10-02T10:00:00Z"),
      };

      // When policy was at v1:
      vi.spyOn(policyRepository, "findPolicies").mockResolvedValue([samplePolicyV1 as any]);
      vi.spyOn(policyRepository, "countPolicies").mockResolvedValue(1);
      vi.spyOn(policyRepository, "findAcknowledgementsForUser").mockResolvedValue([v1Ack]);

      const listBefore = await policyService.list({}, employeeIT);
      expect(listBefore.policies[0].myAcknowledgement.acknowledged).toBe(true);
      expect(listBefore.policies[0].myAcknowledgement.version).toBe(1);

      // Admin updates policy to v2
      const policyV2 = { ...samplePolicyV1, version: 2 };
      vi.spyOn(policyRepository, "findPolicies").mockResolvedValue([policyV2 as any]);

      // Note: Acknowledgement table still has only the v1 record (history preserved!)
      vi.spyOn(policyRepository, "findAcknowledgementsForUser").mockResolvedValue([v1Ack]);

      const listAfter = await policyService.list({}, employeeIT);
      // Status for v2 is now false (reset) because no ack exists for version 2
      expect(listAfter.policies[0].myAcknowledgement.acknowledged).toBe(false);
      expect(listAfter.policies[0].myAcknowledgement.acknowledgedAt).toBe(null);
      expect(listAfter.policies[0].myAcknowledgement.version).toBe(2);

      // Now employee acknowledges v2:
      vi.spyOn(policyRepository, "findPolicyById").mockResolvedValue(policyV2 as any);
      vi.spyOn(policyRepository, "findAcknowledgement").mockResolvedValue(null);
      const v2Ack = {
        id: "ack-v2",
        documentId: policyV2.id,
        userId: employeeIT.id,
        version: 2,
        acknowledgedAt: new Date(),
      };
      vi.spyOn(policyRepository, "createAcknowledgement").mockResolvedValue(v2Ack);

      const ackResult = await policyService.acknowledge(policyV2.id, employeeIT, 2);
      expect(ackResult.acknowledgement.version).toBe(2);

      // Now both records exist in DB (v1 and v2)
      vi.spyOn(policyRepository, "findAcknowledgementsForUser").mockResolvedValue([v1Ack, v2Ack]);
      const listAfterAck = await policyService.list({}, employeeIT);
      expect(listAfterAck.policies[0].myAcknowledgement.acknowledged).toBe(true);
      expect(listAfterAck.policies[0].myAcknowledgement.version).toBe(2);
    });
  });

  describe("5. Compliance Percentage Math & Scoping", () => {
    const mockUsers = [
      { id: "u1", name: "Alice", email: "alice@test.com", departmentId: "dept-it", isActive: true },
      { id: "u2", name: "Bob", email: "bob@test.com", departmentId: "dept-it", isActive: true },
      { id: "u3", name: "Charlie", email: "charlie@test.com", departmentId: "dept-hr", isActive: true },
      { id: "u4", name: "Dave", email: "dave@test.com", departmentId: "dept-hr", isActive: true },
    ];

    const mockDepts = [
      { id: "dept-it", name: "IT" },
      { id: "dept-hr", name: "HR" },
    ];

    it("calculates 100% compliance when all eligible users have acknowledged", async () => {
      const itPolicy = {
        id: "pol-it-only",
        title: "IT Policy",
        category: "SECURITY",
        version: 1,
        isMandatory: true,
        targetDepartmentId: "dept-it",
        isPolicy: true,
      };

      vi.spyOn(policyRepository, "findActiveUsers").mockResolvedValue(mockUsers.filter((u) => u.departmentId === "dept-it") as any);
      vi.spyOn(policyRepository, "findAllDepartments").mockResolvedValue(mockDepts as any);
      vi.spyOn(policyRepository, "findPolicies").mockResolvedValue([itPolicy as any]);
      // Both Alice and Bob acknowledged
      vi.spyOn(policyRepository, "findAcknowledgementsForPolicies").mockResolvedValue([
        { id: "a1", documentId: "pol-it-only", version: 1, userId: "u1", acknowledgedAt: new Date() },
        { id: "a2", documentId: "pol-it-only", version: 1, userId: "u2", acknowledgedAt: new Date() },
      ]);

      const res = await policyService.getComplianceSummary({ departmentId: "dept-it" }, adminUser);

      expect(res.policiesBreakdown[0].totalEligible).toBe(2);
      expect(res.policiesBreakdown[0].acknowledgedCount).toBe(2);
      expect(res.policiesBreakdown[0].pendingCount).toBe(0);
      expect(res.policiesBreakdown[0].compliancePercentage).toBe(100.0);
    });

    it("calculates exact fractional percentage (50.0% when 1 of 2 users acknowledged)", async () => {
      const itPolicy = {
        id: "pol-it-only",
        title: "IT Policy",
        category: "SECURITY",
        version: 1,
        isMandatory: true,
        targetDepartmentId: "dept-it",
        isPolicy: true,
      };

      vi.spyOn(policyRepository, "findActiveUsers").mockResolvedValue(mockUsers.filter((u) => u.departmentId === "dept-it") as any);
      vi.spyOn(policyRepository, "findAllDepartments").mockResolvedValue(mockDepts as any);
      vi.spyOn(policyRepository, "findPolicies").mockResolvedValue([itPolicy as any]);
      // Only Alice acknowledged
      vi.spyOn(policyRepository, "findAcknowledgementsForPolicies").mockResolvedValue([
        { id: "a1", documentId: "pol-it-only", version: 1, userId: "u1", acknowledgedAt: new Date() },
      ]);

      const res = await policyService.getComplianceSummary({ departmentId: "dept-it" }, adminUser);

      expect(res.policiesBreakdown[0].totalEligible).toBe(2);
      expect(res.policiesBreakdown[0].acknowledgedCount).toBe(1);
      expect(res.policiesBreakdown[0].pendingCount).toBe(1);
      expect(res.policiesBreakdown[0].compliancePercentage).toBe(50.0);
    });

    it("safely handles 0 eligible users without division by zero or NaN", async () => {
      vi.spyOn(policyRepository, "findActiveUsers").mockResolvedValue([]);
      vi.spyOn(policyRepository, "findAllDepartments").mockResolvedValue(mockDepts as any);
      vi.spyOn(policyRepository, "findPolicies").mockResolvedValue([samplePolicyV1 as any]);
      vi.spyOn(policyRepository, "findAcknowledgementsForPolicies").mockResolvedValue([]);

      const res = await policyService.getComplianceSummary({}, adminUser);

      expect(res.policiesBreakdown[0].totalEligible).toBe(0);
      expect(res.policiesBreakdown[0].compliancePercentage).toBe(100.0);
      expect(res.summary.overallComplianceRate).toBe(100.0);
    });

    it("excludes users from other departments when evaluating department-targeted policies", async () => {
      const itOnlyPolicy = {
        ...samplePolicyV1,
        id: "pol-it",
        targetDepartmentId: "dept-it",
      };

      vi.spyOn(policyRepository, "findActiveUsers").mockResolvedValue(mockUsers as any);
      vi.spyOn(policyRepository, "findAllDepartments").mockResolvedValue(mockDepts as any);
      vi.spyOn(policyRepository, "findPolicies").mockResolvedValue([itOnlyPolicy as any]);
      vi.spyOn(policyRepository, "findAcknowledgementsForPolicies").mockResolvedValue([]);

      const res = await policyService.getComplianceSummary({}, adminUser);

      // Should count only IT users (2), NOT all 4 users in company
      expect(res.policiesBreakdown[0].totalEligible).toBe(2);
    });
  });

  describe("6. Compliance Authorization & Role Boundaries", () => {
    it("strictly blocks regular EMPLOYEE from viewing compliance summary with 403", async () => {
      await expect(policyService.getComplianceSummary({}, employeeIT)).rejects.toThrow(
        "Access denied: Compliance summary is restricted to Managers and Administrators"
      );
    });

    it("strictly blocks regular EMPLOYEE from exporting compliance CSV with 403", async () => {
      await expect(policyService.exportComplianceCsv({}, employeeIT)).rejects.toThrow(
        "Access denied: CSV export is restricted to Managers and Administrators"
      );
    });

    it("allows Manager to view compliance ONLY for their own department", async () => {
      vi.spyOn(policyRepository, "findActiveUsers").mockResolvedValue([employeeIT] as any);
      vi.spyOn(policyRepository, "findAllDepartments").mockResolvedValue([{ id: "dept-it", name: "IT" }] as any);
      vi.spyOn(policyRepository, "findPolicies").mockResolvedValue([samplePolicyV1 as any]);
      vi.spyOn(policyRepository, "findAcknowledgementsForPolicies").mockResolvedValue([]);

      // Manager IT viewing their own department
      const res = await policyService.getComplianceSummary({ departmentId: "dept-it" }, managerIT);
      expect(res.summary.scopedDepartmentId).toBe("dept-it");
    });

    it("blocks Manager from viewing another department's compliance summary with 403", async () => {
      // Manager IT attempting to view HR department
      await expect(
        policyService.getComplianceSummary({ departmentId: "dept-hr" }, managerIT)
      ).rejects.toThrow("Managers can only view compliance for their own department");
    });

    it("blocks Manager from exporting another department's compliance CSV with 403", async () => {
      await expect(
        policyService.exportComplianceCsv({ departmentId: "dept-hr" }, managerIT)
      ).rejects.toThrow("Managers can only export compliance for their own department");
    });
  });

  describe("7. CSV Export & Date Formatting (Asia/Kolkata)", () => {
    it("formats dates accurately in Asia/Kolkata with IST suffix", () => {
      const utcDate = new Date("2026-11-04T10:00:00.000Z"); // 15:30 IST (+5:30)
      const formatted = formatKolkataDateTime(utcDate);

      expect(formatted).toContain("IST");
      expect(formatted).toContain("03:30");
      expect(formatted).toContain("pm");
      expect(formatKolkataDateTime(null)).toBe("N/A");
    });

    it("generates well-formed CSV with RFC-4180 escaping and headers", async () => {
      const activeUser = {
        id: "u1",
        name: 'John "Neo" Doe',
        email: "neo@nexusops.com",
        departmentId: "dept-it",
        department: { id: "dept-it", name: "Information Technology" },
        isActive: true,
      };

      vi.spyOn(policyRepository, "findActiveUsers").mockResolvedValue([activeUser] as any);
      vi.spyOn(policyRepository, "findAllDepartments").mockResolvedValue([
        { id: "dept-it", name: "Information Technology" },
      ] as any);
      vi.spyOn(policyRepository, "findPolicies").mockResolvedValue([samplePolicyV1 as any]);
      vi.spyOn(policyRepository, "findAcknowledgementsForPolicies").mockResolvedValue([
        {
          id: "ack-1",
          documentId: samplePolicyV1.id,
          version: 1,
          userId: "u1",
          acknowledgedAt: new Date("2026-11-04T10:00:00.000Z"),
        },
      ]);

      const { csv, fileName } = await policyService.exportComplianceCsv({}, adminUser);

      expect(fileName).toMatch(/^policy-compliance-report-\d{4}-\d{2}-\d{2}\.csv$/);
      expect(csv).toContain('"Policy Title","Category","Version","Mandatory"');
      expect(csv).toContain('"Data Security Policy"');
      expect(csv).toContain('"John ""Neo"" Doe"'); // escaped quotes
      expect(csv).toContain('"ACKNOWLEDGED"');
      expect(csv).toContain("IST");
    });
  });
});
