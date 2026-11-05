import { prisma } from "../../lib/prisma";
import { AssetStatus, AssetType, Prisma } from "@prisma/client";
import { AppError } from "../../lib/errors";
import type {
  CreateAssetInput,
  UpdateAssetInput,
  GetAssetsQueryInput,
} from "./asset.schema";

const ASSET_INCLUDE_FULL = {
  assignments: {
    orderBy: { assignedAt: "desc" as const },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          department: {
            select: { id: true, name: true },
          },
        },
      },
      assignedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      request: {
        select: {
          id: true,
          title: true,
          category: true,
          status: true,
        },
      },
    },
  },
};

export class AssetRepository {
  async create(data: CreateAssetInput) {
    if (data.serialNumber) {
      const existing = await prisma.asset.findUnique({
        where: { serialNumber: data.serialNumber },
      });
      if (existing) {
        throw AppError.badRequest(`An asset with serial number '${data.serialNumber}' already exists`);
      }
    }

    return prisma.asset.create({
      data: {
        name: data.name,
        type: data.type,
        serialNumber: data.serialNumber || null,
        status: data.status || AssetStatus.AVAILABLE,
        purchaseDate: data.purchaseDate || null,
        warrantyExpiresAt: data.warrantyExpiresAt || null,
        notes: data.notes || null,
      },
      include: ASSET_INCLUDE_FULL,
    });
  }

  async update(id: string, data: UpdateAssetInput) {
    const existing = await prisma.asset.findUnique({
      where: { id },
      include: {
        assignments: {
          where: { returnedAt: null },
        },
      },
    });

    if (!existing) {
      throw AppError.notFound("Asset not found");
    }

    if (data.serialNumber && data.serialNumber !== existing.serialNumber) {
      const conflict = await prisma.asset.findUnique({
        where: { serialNumber: data.serialNumber },
      });
      if (conflict && conflict.id !== id) {
        throw AppError.badRequest(`An asset with serial number '${data.serialNumber}' already exists`);
      }
    }

    // Safety check: cannot retire an already assigned asset directly
    if (data.status === AssetStatus.RETIRED && existing.status === AssetStatus.ASSIGNED) {
      throw AppError.badRequest("Cannot retire an asset that is currently assigned. Return it first.");
    }

    return prisma.asset.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.serialNumber !== undefined && { serialNumber: data.serialNumber }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.purchaseDate !== undefined && { purchaseDate: data.purchaseDate }),
        ...(data.warrantyExpiresAt !== undefined && { warrantyExpiresAt: data.warrantyExpiresAt }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
      include: ASSET_INCLUDE_FULL,
    });
  }

  async findById(id: string) {
    return prisma.asset.findUnique({
      where: { id },
      include: ASSET_INCLUDE_FULL,
    });
  }

  async findMyAssets(userId: string) {
    return prisma.asset.findMany({
      where: {
        status: AssetStatus.ASSIGNED,
        assignments: {
          some: {
            userId,
            returnedAt: null,
          },
        },
      },
      include: ASSET_INCLUDE_FULL,
      orderBy: { createdAt: "desc" },
    });
  }

  async findVisibleAssets(
    query: GetAssetsQueryInput,
    userRole: string,
    userId: string
  ) {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const andConditions: Prisma.AssetWhereInput[] = [];

    // Role-based scoping: Employees & Managers can ONLY view their own currently assigned assets
    if (userRole !== "ADMIN") {
      andConditions.push({
        status: AssetStatus.ASSIGNED,
        assignments: {
          some: {
            userId,
            returnedAt: null,
          },
        },
      });
    }

    // Search filter across name, serialNumber, or current assignee's name/email
    if (query.search) {
      andConditions.push({
        OR: [
          { name: { contains: query.search, mode: "insensitive" } },
          { serialNumber: { contains: query.search, mode: "insensitive" } },
          {
            assignments: {
              some: {
                returnedAt: null,
                user: {
                  OR: [
                    { name: { contains: query.search, mode: "insensitive" } },
                    { email: { contains: query.search, mode: "insensitive" } },
                  ],
                },
              },
            },
          },
        ],
      });
    }

    if (query.type) {
      andConditions.push({ type: query.type as AssetType });
    }

    if (query.status) {
      andConditions.push({ status: query.status as AssetStatus });
    }

    // Warranty filter
    if (query.warranty === "expired") {
      andConditions.push({
        warrantyExpiresAt: {
          not: null,
          lt: now,
        },
      });
    } else if (query.warranty === "expiring_soon") {
      andConditions.push({
        warrantyExpiresAt: {
          not: null,
          gte: now,
          lte: thirtyDaysFromNow,
        },
      });
    } else if (query.warranty === "valid") {
      andConditions.push({
        warrantyExpiresAt: {
          not: null,
          gt: thirtyDaysFromNow,
        },
      });
    }

    if (query.requestId) {
      andConditions.push({
        assignments: {
          some: {
            requestId: query.requestId,
          },
        },
      });
    }

    const where: Prisma.AssetWhereInput = andConditions.length > 0 ? { AND: andConditions } : {};

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      prisma.asset.count({ where }),
      prisma.asset.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [query.sortBy]: query.sortOrder },
        include: ASSET_INCLUDE_FULL,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Assigns an asset inside a safe database transaction.
   * Guarantees:
   * - A retired or already-assigned asset cannot be assigned.
   * - In-repair asset cannot be assigned.
   * - Assignee must exist and be active.
   * - Atomically sets asset status to ASSIGNED and inserts AssetAssignment.
   */
  async assignAssetTransaction(
    assetId: string,
    targetUserId: string,
    assignedById: string,
    requestId?: string | null,
    notes?: string | null
  ) {
    return prisma.$transaction(async (tx) => {
      const asset = await tx.asset.findUnique({
        where: { id: assetId },
        include: {
          assignments: {
            where: { returnedAt: null },
          },
        },
      });

      if (!asset) {
        throw AppError.notFound("Asset not found");
      }

      if (asset.status === AssetStatus.RETIRED) {
        throw AppError.badRequest("A retired asset cannot be assigned");
      }

      if (asset.status === AssetStatus.ASSIGNED || asset.assignments.length > 0) {
        throw AppError.badRequest("This asset is already assigned to a user");
      }

      if (asset.status === AssetStatus.IN_REPAIR) {
        throw AppError.badRequest("Cannot assign an asset that is currently in repair");
      }

      const targetUser = await tx.user.findUnique({
        where: { id: targetUserId },
      });

      if (!targetUser) {
        throw AppError.notFound("Target assignee user not found");
      }

      if (!targetUser.isActive) {
        throw AppError.badRequest("Cannot assign an asset to a deactivated user account");
      }

      if (requestId) {
        const request = await tx.workRequest.findUnique({
          where: { id: requestId },
        });
        if (!request) {
          throw AppError.notFound("Referenced work request not found");
        }
      }

      // Create assignment record
      const assignment = await tx.assetAssignment.create({
        data: {
          assetId,
          userId: targetUserId,
          assignedById,
          assignedAt: new Date(),
          returnedAt: null,
          requestId: requestId || null,
          notes: notes || null,
        },
      });

      // Update asset status
      const updatedAsset = await tx.asset.update({
        where: { id: assetId },
        data: { status: AssetStatus.ASSIGNED },
        include: ASSET_INCLUDE_FULL,
      });

      return {
        asset: updatedAsset,
        assignment,
        targetUser,
      };
    });
  }

  /**
   * Returns an assigned asset inside a database transaction.
   * Guarantees:
   * - Asset must be ASSIGNED.
   * - Atomically marks active AssetAssignment returnedAt and sets asset status to AVAILABLE.
   */
  async returnAssetTransaction(assetId: string, notes?: string | null) {
    return prisma.$transaction(async (tx) => {
      const asset = await tx.asset.findUnique({
        where: { id: assetId },
        include: {
          assignments: {
            where: { returnedAt: null },
            include: { user: true },
          },
        },
      });

      if (!asset) {
        throw AppError.notFound("Asset not found");
      }

      if (asset.status !== AssetStatus.ASSIGNED || asset.assignments.length === 0) {
        throw AppError.badRequest("Asset is not currently assigned");
      }

      const activeAssignment = asset.assignments[0];
      const now = new Date();

      const updatedAssignment = await tx.assetAssignment.update({
        where: { id: activeAssignment.id },
        data: {
          returnedAt: now,
          ...(notes ? { notes: activeAssignment.notes ? `${activeAssignment.notes}\n[Return]: ${notes}` : notes } : {}),
        },
      });

      const updatedAsset = await tx.asset.update({
        where: { id: assetId },
        data: { status: AssetStatus.AVAILABLE },
        include: ASSET_INCLUDE_FULL,
      });

      return {
        asset: updatedAsset,
        assignment: updatedAssignment,
        previousAssignee: activeAssignment.user,
      };
    });
  }

  /**
   * Retires an asset inside a database transaction.
   * Guarantees:
   * - Asset cannot be currently assigned.
   */
  async retireAssetTransaction(assetId: string, notes?: string | null) {
    return prisma.$transaction(async (tx) => {
      const asset = await tx.asset.findUnique({
        where: { id: assetId },
        include: {
          assignments: {
            where: { returnedAt: null },
          },
        },
      });

      if (!asset) {
        throw AppError.notFound("Asset not found");
      }

      if (asset.status === AssetStatus.ASSIGNED || asset.assignments.length > 0) {
        throw AppError.badRequest("Cannot retire an asset that is currently assigned. Return it first.");
      }

      const updatedAsset = await tx.asset.update({
        where: { id: assetId },
        data: {
          status: AssetStatus.RETIRED,
          ...(notes ? { notes: asset.notes ? `${asset.notes}\n[Retire]: ${notes}` : notes } : {}),
        },
        include: ASSET_INCLUDE_FULL,
      });

      return {
        asset: updatedAsset,
      };
    });
  }
}

export const assetRepository = new AssetRepository();
