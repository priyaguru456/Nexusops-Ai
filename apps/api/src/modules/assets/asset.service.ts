import { assetRepository } from "./asset.repository";
import { auditService } from "../audit/audit.service";
import { notificationService } from "../notifications/notification.service";
import { AppError } from "../../lib/errors";
import { assertSameTenant, isAdminRole, isSuperAdmin, resolveTenantId } from "../../lib/tenant";
import type { AuthenticatedUser } from "../../types/express";
import type {
  CreateAssetInput,
  UpdateAssetInput,
  AssignAssetInput,
  ReturnAssetInput,
  RetireAssetInput,
  GetAssetsQueryInput,
} from "./asset.schema";

function resolveOptionalAssetOrgId(user: AuthenticatedUser): string | undefined {
  if (user.organizationId === undefined) return undefined;
  if (isSuperAdmin(user) && !user.organizationId) return undefined;
  return resolveTenantId(user);
}

export class AssetService {
  async list(user: AuthenticatedUser, query: GetAssetsQueryInput) {
    const orgId = resolveOptionalAssetOrgId(user);
    return orgId !== undefined
      ? assetRepository.findVisibleAssets(query, user.role, user.id, orgId)
      : assetRepository.findVisibleAssets(query, user.role, user.id);
  }

  async getMyAssets(user: AuthenticatedUser) {
    const orgId = resolveOptionalAssetOrgId(user);
    return orgId !== undefined
      ? assetRepository.findMyAssets(user.id, orgId)
      : assetRepository.findMyAssets(user.id);
  }

  async getById(id: string, user: AuthenticatedUser) {
    const asset = await assetRepository.findById(id);
    if (!asset) {
      throw AppError.notFound("Asset not found");
    }

    assertSameTenant(asset.organizationId, user, "Asset not found");

    // Role-based authorization: Employees/Managers can ONLY view their own assigned asset
    if (!isAdminRole(user)) {
      const activeAssignment = asset.assignments.find((a) => a.returnedAt === null);
      if (!activeAssignment || activeAssignment.userId !== user.id) {
        throw AppError.forbidden("You do not have permission to view this asset");
      }
    }

    return asset;
  }

  async create(user: AuthenticatedUser, data: CreateAssetInput) {
    if (!isAdminRole(user)) {
      throw AppError.forbidden("Only administrators and IT staff can create assets");
    }

    const orgId = user.organizationId !== undefined ? resolveTenantId(user) : undefined;
    const created = await assetRepository.create(
      orgId !== undefined ? { ...data, organizationId: orgId } : data
    );

    await auditService.log({
      organizationId: created.organizationId ?? orgId ?? null,
      actorId: user.id,
      action: "ASSET_CREATED",
      entityType: "Asset",
      entityId: created.id,
      summary: `Created asset '${created.name}' (${created.type}) with status ${created.status}`,
      metadata: {
        type: created.type,
        serialNumber: created.serialNumber,
        status: created.status,
      },
    });

    return created;
  }

  async update(id: string, user: AuthenticatedUser, data: UpdateAssetInput) {
    if (!isAdminRole(user)) {
      throw AppError.forbidden("Only administrators and IT staff can update assets");
    }

    const orgId = resolveOptionalAssetOrgId(user);
    const updated = await (orgId !== undefined
      ? assetRepository.update(id, data, orgId)
      : assetRepository.update(id, data));

    await auditService.log({
      organizationId: updated.organizationId ?? orgId ?? null,
      actorId: user.id,
      action: "ASSET_UPDATED",
      entityType: "Asset",
      entityId: updated.id,
      summary: `Updated asset specifications for '${updated.name}'`,
      metadata: {
        changes: data,
        currentStatus: updated.status,
      },
    });

    return updated;
  }

  async assign(id: string, user: AuthenticatedUser, data: AssignAssetInput) {
    if (!isAdminRole(user)) {
      throw AppError.forbidden("Only administrators and IT staff can assign assets");
    }

    const orgId = resolveOptionalAssetOrgId(user);
    const result = await (orgId !== undefined
      ? assetRepository.assignAssetTransaction(
          id,
          data.userId,
          user.id,
          data.requestId,
          data.notes,
          orgId
        )
      : assetRepository.assignAssetTransaction(
          id,
          data.userId,
          user.id,
          data.requestId,
          data.notes
        ));

    // Write audit log
    await auditService.log({
      organizationId: result.asset.organizationId ?? orgId ?? null,
      actorId: user.id,
      action: "ASSET_ASSIGNED",
      entityType: "Asset",
      entityId: result.asset.id,
      summary: `Assigned asset '${result.asset.name}' to ${result.targetUser.name}`,
      metadata: {
        assigneeId: data.userId,
        assigneeEmail: result.targetUser.email,
        requestId: data.requestId || null,
        serialNumber: result.asset.serialNumber,
      },
    });

    // Send in-app notification to the assignee
    await notificationService.notify({
      userId: data.userId,
      type: "ASSET_ASSIGNED",
      title: "Asset Assigned",
      message: `You have been assigned ${result.asset.name} (${result.asset.type}). Serial: ${result.asset.serialNumber || "N/A"}`,
      link: "/settings",
      entityType: "Asset",
      entityId: result.asset.id,
    });

    return result.asset;
  }

  async returnAsset(id: string, user: AuthenticatedUser, data: ReturnAssetInput) {
    if (!isAdminRole(user)) {
      throw AppError.forbidden("Only administrators and IT staff can process asset returns");
    }

    const orgId = resolveOptionalAssetOrgId(user);
    const result = await (orgId !== undefined
      ? assetRepository.returnAssetTransaction(id, data.notes, orgId)
      : assetRepository.returnAssetTransaction(id, data.notes));

    // Write audit log
    await auditService.log({
      organizationId: result.asset.organizationId ?? orgId ?? null,
      actorId: user.id,
      action: "ASSET_RETURNED",
      entityType: "Asset",
      entityId: result.asset.id,
      summary: `Processed return of asset '${result.asset.name}' from ${result.previousAssignee.name}`,
      metadata: {
        previousAssigneeId: result.previousAssignee.id,
        returnNotes: data.notes || null,
      },
    });

    // Notify the previous assignee
    await notificationService.notify({
      userId: result.previousAssignee.id,
      type: "ASSET_RETURNED",
      title: "Asset Returned",
      message: `Asset ${result.asset.name} has been confirmed returned and marked available.`,
      link: "/settings",
      entityType: "Asset",
      entityId: result.asset.id,
    });

    return result.asset;
  }

  async retire(id: string, user: AuthenticatedUser, data: RetireAssetInput) {
    if (!isAdminRole(user)) {
      throw AppError.forbidden("Only administrators and IT staff can retire assets");
    }

    const orgId = resolveOptionalAssetOrgId(user);
    const result = await (orgId !== undefined
      ? assetRepository.retireAssetTransaction(id, data.notes, orgId)
      : assetRepository.retireAssetTransaction(id, data.notes));

    await auditService.log({
      organizationId: result.asset.organizationId ?? orgId ?? null,
      actorId: user.id,
      action: "ASSET_RETIRED",
      entityType: "Asset",
      entityId: result.asset.id,
      summary: `Decommissioned and retired asset '${result.asset.name}'`,
      metadata: {
        retirementNotes: data.notes || null,
      },
    });

    return result.asset;
  }
}

export const assetService = new AssetService();

