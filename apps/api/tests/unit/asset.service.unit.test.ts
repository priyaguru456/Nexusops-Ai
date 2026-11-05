import { describe, it, expect, vi, beforeEach } from "vitest";
import { AssetType, AssetStatus, Role } from "@prisma/client";
import { assetService } from "../../src/modules/assets/asset.service";
import { assetRepository } from "../../src/modules/assets/asset.repository";
import { auditService } from "../../src/modules/audit/audit.service";
import { notificationService } from "../../src/modules/notifications/notification.service";
import type { AuthenticatedUser } from "../../src/types/express";

vi.mock("../../src/modules/assets/asset.repository", () => ({
  assetRepository: {
    create: vi.fn(),
    update: vi.fn(),
    findById: vi.fn(),
    findMyAssets: vi.fn(),
    findVisibleAssets: vi.fn(),
    assignAssetTransaction: vi.fn(),
    returnAssetTransaction: vi.fn(),
    retireAssetTransaction: vi.fn(),
  },
}));

vi.mock("../../src/modules/audit/audit.service", () => ({
  auditService: {
    log: vi.fn(),
  },
}));

vi.mock("../../src/modules/notifications/notification.service", () => ({
  notificationService: {
    notify: vi.fn(),
  },
}));

describe("Asset Management Service Unit Tests", () => {
  const adminUser: AuthenticatedUser = {
    id: "usr-admin-1",
    name: "Admin Officer",
    email: "admin@nexusops.com",
    role: Role.ADMIN,
    isActive: true,
    departmentId: "dept-it",
    managerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const employeeUser1: AuthenticatedUser = {
    id: "usr-emp-1",
    name: "John Doe",
    email: "john@nexusops.com",
    role: Role.EMPLOYEE,
    isActive: true,
    departmentId: "dept-eng",
    managerId: "usr-mgr-1",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const employeeUser2: AuthenticatedUser = {
    id: "usr-emp-2",
    name: "Jane Smith",
    email: "jane@nexusops.com",
    role: Role.EMPLOYEE,
    isActive: true,
    departmentId: "dept-hr",
    managerId: "usr-mgr-2",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Role-based Asset Creation", () => {
    it("allows Admin to create an asset and creates an audit log", async () => {
      const mockCreated = {
        id: "asset-101",
        name: "MacBook Pro M3",
        type: AssetType.LAPTOP,
        serialNumber: "MBP-2026-001",
        status: AssetStatus.AVAILABLE,
        purchaseDate: new Date(),
        warrantyExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        notes: "Dev setup",
        createdAt: new Date(),
        updatedAt: new Date(),
        assignments: [],
      };

      vi.mocked(assetRepository.create).mockResolvedValueOnce(mockCreated as any);

      const result = await assetService.create(adminUser, {
        name: "MacBook Pro M3",
        type: AssetType.LAPTOP,
        serialNumber: "MBP-2026-001",
        status: AssetStatus.AVAILABLE,
        notes: "Dev setup",
      });

      expect(result.id).toBe("asset-101");
      expect(assetRepository.create).toHaveBeenCalledTimes(1);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "ASSET_CREATED",
          entityType: "Asset",
          entityId: "asset-101",
        })
      );
    });

    it("rejects non-admin (EMPLOYEE) from creating an asset with 403", async () => {
      await expect(
        assetService.create(employeeUser1, {
          name: "Dell Monitor",
          type: AssetType.MONITOR,
          serialNumber: "DELL-MON-1",
        })
      ).rejects.toMatchObject({
        statusCode: 403,
      });
      expect(assetRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("2. Asset Update & Modification", () => {
    it("allows Admin to update asset specs and records audit entry", async () => {
      const mockUpdated = {
        id: "asset-101",
        name: "MacBook Pro M3 Max",
        type: AssetType.LAPTOP,
        serialNumber: "MBP-2026-001",
        status: AssetStatus.AVAILABLE,
        notes: "Upgraded RAM",
        assignments: [],
      };

      vi.mocked(assetRepository.update).mockResolvedValueOnce(mockUpdated as any);

      const result = await assetService.update("asset-101", adminUser, {
        name: "MacBook Pro M3 Max",
        notes: "Upgraded RAM",
      });

      expect(result.name).toBe("MacBook Pro M3 Max");
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "ASSET_UPDATED",
          entityId: "asset-101",
        })
      );
    });

    it("rejects non-admin from updating assets with 403", async () => {
      await expect(
        assetService.update("asset-101", employeeUser1, {
          name: "Attempted Hack",
        })
      ).rejects.toMatchObject({
        statusCode: 403,
      });
      expect(assetRepository.update).not.toHaveBeenCalled();
    });
  });

  describe("3. Assignment Workflow (Transactions, Notifications & Audit)", () => {
    it("assigns an AVAILABLE asset to a user, sends in-app notification, and writes audit", async () => {
      const mockResult = {
        asset: {
          id: "asset-101",
          name: "MacBook Pro M3",
          type: AssetType.LAPTOP,
          serialNumber: "MBP-2026-001",
          status: AssetStatus.ASSIGNED,
          assignments: [],
        },
        assignment: {
          id: "asgn-1",
          assetId: "asset-101",
          userId: employeeUser1.id,
          assignedById: adminUser.id,
          requestId: "req-hardware-10",
        },
        targetUser: {
          id: employeeUser1.id,
          name: employeeUser1.name,
          email: employeeUser1.email,
        },
      };

      vi.mocked(assetRepository.assignAssetTransaction).mockResolvedValueOnce(mockResult as any);

      const result = await assetService.assign("asset-101", adminUser, {
        userId: employeeUser1.id,
        requestId: "req-hardware-10",
        notes: "Issued for engineering work",
      });

      expect(result.status).toBe(AssetStatus.ASSIGNED);
      expect(assetRepository.assignAssetTransaction).toHaveBeenCalledWith(
        "asset-101",
        employeeUser1.id,
        adminUser.id,
        "req-hardware-10",
        "Issued for engineering work"
      );

      // Verify audit log
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "ASSET_ASSIGNED",
          entityId: "asset-101",
          metadata: expect.objectContaining({
            assigneeId: employeeUser1.id,
            requestId: "req-hardware-10",
          }),
        })
      );

      // Verify in-app notification
      expect(notificationService.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: employeeUser1.id,
          type: "ASSET_ASSIGNED",
          entityId: "asset-101",
        })
      );
    });

    it("rejects non-admin from executing asset assignment with 403", async () => {
      await expect(
        assetService.assign("asset-101", employeeUser1, {
          userId: employeeUser2.id,
        })
      ).rejects.toMatchObject({
        statusCode: 403,
      });
      expect(assetRepository.assignAssetTransaction).not.toHaveBeenCalled();
    });
  });

  describe("4. Return Workflow", () => {
    it("returns an assigned asset, sets status AVAILABLE, notifies previous assignee", async () => {
      const mockResult = {
        asset: {
          id: "asset-101",
          name: "MacBook Pro M3",
          status: AssetStatus.AVAILABLE,
          assignments: [],
        },
        assignment: {
          id: "asgn-1",
          returnedAt: new Date(),
        },
        previousAssignee: {
          id: employeeUser1.id,
          name: employeeUser1.name,
        },
      };

      vi.mocked(assetRepository.returnAssetTransaction).mockResolvedValueOnce(mockResult as any);

      const result = await assetService.returnAsset("asset-101", adminUser, {
        notes: "Turned in in pristine condition",
      });

      expect(result.status).toBe(AssetStatus.AVAILABLE);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "ASSET_RETURNED",
          entityId: "asset-101",
        })
      );
      expect(notificationService.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: employeeUser1.id,
          type: "ASSET_RETURNED",
        })
      );
    });

    it("rejects non-admin from processing asset returns with 403", async () => {
      await expect(
        assetService.returnAsset("asset-101", employeeUser1, {})
      ).rejects.toMatchObject({
        statusCode: 403,
      });
    });
  });

  describe("5. Retirement Workflow", () => {
    it("retires an unassigned asset and logs audit entry", async () => {
      const mockResult = {
        asset: {
          id: "asset-old",
          name: "Ancient Laptop",
          status: AssetStatus.RETIRED,
        },
      };

      vi.mocked(assetRepository.retireAssetTransaction).mockResolvedValueOnce(mockResult as any);

      const result = await assetService.retire("asset-old", adminUser, {
        notes: "Recycled by e-waste contractor",
      });

      expect(result.status).toBe(AssetStatus.RETIRED);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "ASSET_RETIRED",
          entityId: "asset-old",
        })
      );
    });

    it("rejects non-admin from retiring assets with 403", async () => {
      await expect(
        assetService.retire("asset-old", employeeUser1, {})
      ).rejects.toMatchObject({
        statusCode: 403,
      });
    });
  });

  describe("6. Scoped Read Permissions (Employee can only view their own assets)", () => {
    it("allows Admin to view any asset details", async () => {
      const mockAsset = {
        id: "asset-101",
        name: "MacBook Pro",
        assignments: [
          {
            id: "asgn-1",
            userId: employeeUser1.id,
            returnedAt: null,
          },
        ],
      };

      vi.mocked(assetRepository.findById).mockResolvedValueOnce(mockAsset as any);

      const asset = await assetService.getById("asset-101", adminUser);
      expect(asset.id).toBe("asset-101");
    });

    it("allows Employee to view an asset currently assigned to them", async () => {
      const mockAsset = {
        id: "asset-101",
        name: "MacBook Pro",
        assignments: [
          {
            id: "asgn-1",
            userId: employeeUser1.id,
            returnedAt: null, // Currently assigned to user 1
          },
        ],
      };

      vi.mocked(assetRepository.findById).mockResolvedValueOnce(mockAsset as any);

      const asset = await assetService.getById("asset-101", employeeUser1);
      expect(asset.id).toBe("asset-101");
    });

    it("blocks Employee from viewing an asset assigned to another user with 403", async () => {
      const mockAsset = {
        id: "asset-101",
        name: "MacBook Pro",
        assignments: [
          {
            id: "asgn-1",
            userId: employeeUser2.id, // Assigned to Jane
            returnedAt: null,
          },
        ],
      };

      vi.mocked(assetRepository.findById).mockResolvedValueOnce(mockAsset as any);

      await expect(
        assetService.getById("asset-101", employeeUser1) // John tries to view
      ).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it("getMyAssets delegates to repository findMyAssets for the authenticated user", async () => {
      const mockList = [
        { id: "asset-1", name: "Laptop" },
        { id: "asset-2", name: "Monitor" },
      ];

      vi.mocked(assetRepository.findMyAssets).mockResolvedValueOnce(mockList as any);

      const result = await assetService.getMyAssets(employeeUser1);
      expect(result).toHaveLength(2);
      expect(assetRepository.findMyAssets).toHaveBeenCalledWith(employeeUser1.id);
    });
  });
});
