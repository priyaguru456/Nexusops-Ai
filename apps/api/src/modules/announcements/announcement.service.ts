import { Role } from "@prisma/client";
import { AppError } from "../../lib/errors";
import { assertSameTenant, isAdminRole, isSuperAdmin, resolveTenantId } from "../../lib/tenant";
import { announcementRepository } from "./announcement.repository";
import { auditService } from "../audit/audit.service";
import { notificationService } from "../notifications/notification.service";
import type {
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
  AnnouncementQueryInput,
} from "./announcement.schema";
import type { AuthenticatedUser } from "../../types/express";

function resolveOptionalOrgId(user: AuthenticatedUser): string | undefined {
  if (user.organizationId === undefined) return undefined;
  if (isSuperAdmin(user) && !user.organizationId) return undefined;
  return resolveTenantId(user);
}

export class AnnouncementService {
  async list(user: AuthenticatedUser, query: AnnouncementQueryInput) {
    const orgId = resolveOptionalOrgId(user);
    const result = await (orgId !== undefined
      ? announcementRepository.findVisibleForUser(
          user.id,
          user.departmentId,
          user.role,
          query,
          orgId
        )
      : announcementRepository.findVisibleForUser(
          user.id,
          user.departmentId,
          user.role,
          query
        ));

    // Compute target counts for visible announcements
    const items = await Promise.all(
      result.items.map(async (item) => {
        const isRead = item.reads.length > 0;
        const readAt = item.reads[0]?.readAt ?? null;
        const isAuthorOrAdmin = item.authorId === user.id || isAdminRole(user);

        let totalTargetUsers: number | undefined;
        if (isAuthorOrAdmin) {
          const itemOrgId = (item as { organizationId?: string }).organizationId ?? orgId;
          totalTargetUsers = await (itemOrgId !== undefined
            ? announcementRepository.countTargetUsers(item.targetDepartmentId, itemOrgId)
            : announcementRepository.countTargetUsers(item.targetDepartmentId));
        }

        return {
          id: item.id,
          title: item.title,
          content: item.content,
          priority: item.priority,
          targetDepartmentId: item.targetDepartmentId,
          targetDepartment: item.targetDepartment,
          authorId: item.authorId,
          author: item.author,
          isPinned: item.isPinned,
          expiresAt: item.expiresAt,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          isRead,
          readAt,
          readCount: item._count.reads,
          totalTargetUsers,
        };
      })
    );

    return {
      items,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      unreadCount: result.unreadCount,
    };
  }

  async getById(id: string, user: AuthenticatedUser) {
    const item = await announcementRepository.findById(id, user.id);
    if (!item) {
      throw AppError.notFound("Announcement not found");
    }

    assertSameTenant(item.organizationId, user, "Announcement not found");

    // Visibility permission check
    if (!isAdminRole(user)) {
      if (item.targetDepartmentId !== null && item.targetDepartmentId !== user.departmentId) {
        throw AppError.notFound("Announcement not found");
      }
    }

    const isRead = Array.isArray(item.reads) && item.reads.length > 0;
    const readAt = Array.isArray(item.reads) && item.reads.length > 0 ? item.reads[0].readAt : null;
    const isAuthorOrAdmin = item.authorId === user.id || isAdminRole(user);

    let totalTargetUsers: number | undefined;
    if (isAuthorOrAdmin) {
      const orgId = item.organizationId ?? resolveOptionalOrgId(user);
      totalTargetUsers = await (orgId !== undefined
        ? announcementRepository.countTargetUsers(item.targetDepartmentId, orgId)
        : announcementRepository.countTargetUsers(item.targetDepartmentId));
    }

    return {
      id: item.id,
      title: item.title,
      content: item.content,
      priority: item.priority,
      targetDepartmentId: item.targetDepartmentId,
      targetDepartment: item.targetDepartment,
      authorId: item.authorId,
      author: item.author,
      isPinned: item.isPinned,
      expiresAt: item.expiresAt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      isRead,
      readAt,
      readCount: item._count.reads,
      totalTargetUsers,
    };
  }

  async create(user: AuthenticatedUser, data: CreateAnnouncementInput) {
    if (!isAdminRole(user) && user.role !== Role.MANAGER) {
      throw AppError.forbidden("Only Administrators and Managers can post announcements");
    }

    const orgId = user.organizationId !== undefined ? resolveTenantId(user) : undefined;
    let targetDepartmentId = data.targetDepartmentId;

    // Manager role restriction: A Manager may only target their own department
    if (user.role === Role.MANAGER) {
      if (!user.departmentId) {
        throw AppError.forbidden("Manager must belong to a department to create announcements");
      }
      if (targetDepartmentId && targetDepartmentId !== user.departmentId) {
        throw AppError.forbidden("Managers may only target their own department");
      }
      if (!targetDepartmentId) {
        // Enforce their own department
        targetDepartmentId = user.departmentId;
      }
    }

    const created = await announcementRepository.create({
      ...(orgId !== undefined ? { organizationId: orgId } : {}),
      title: data.title,
      content: data.content,
      priority: data.priority,
      targetDepartmentId,
      authorId: user.id,
      isPinned: data.isPinned ?? false,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    });

    // Record audit log
    await auditService.log({
      organizationId: created.organizationId ?? orgId ?? null,
      actorId: user.id,
      action: "ANNOUNCEMENT_CREATED",
      entityType: "Announcement",
      entityId: created.id,
      metadata: {
        title: created.title,
        priority: created.priority,
        targetDepartmentId: created.targetDepartmentId,
        isPinned: created.isPinned,
      },
    });

    // Send notification for URGENT announcements
    if (created.priority === "URGENT") {
      try {
        const targetOrgId = created.organizationId ?? orgId;
        const targetUserIds = await (targetOrgId !== undefined
          ? announcementRepository.getTargetUserIds(created.targetDepartmentId, targetOrgId)
          : announcementRepository.getTargetUserIds(created.targetDepartmentId));
        // Exclude author from self-notification
        const recipientIds = targetUserIds.filter((id) => id !== user.id);

        if (recipientIds.length > 0) {
          await notificationService.notifyMultiple(
            recipientIds,
            "ANNOUNCEMENT",
            `Urgent Announcement: ${created.title}`,
            `Urgent operational announcement: ${created.title}`,
            "/announcements",
            "Announcement",
            created.id
          );
        }
      } catch (err) {
        // Notification delivery should not fail announcement creation
      }
    }

    const countOrgId = created.organizationId ?? orgId;
    const totalTargetUsers = await (countOrgId !== undefined
      ? announcementRepository.countTargetUsers(created.targetDepartmentId, countOrgId)
      : announcementRepository.countTargetUsers(created.targetDepartmentId));

    return {
      ...created,
      isRead: false,
      readAt: null,
      readCount: 0,
      totalTargetUsers,
    };
  }

  async update(id: string, user: AuthenticatedUser, data: UpdateAnnouncementInput) {
    const existing = await announcementRepository.findById(id);
    if (!existing) {
      throw AppError.notFound("Announcement not found");
    }

    assertSameTenant(existing.organizationId, user, "Announcement not found");

    if (!isAdminRole(user) && user.role !== Role.MANAGER) {
      throw AppError.forbidden("Only Administrators and Managers can update announcements");
    }

    // Role check for Manager
    if (user.role === Role.MANAGER) {
      if (existing.targetDepartmentId !== user.departmentId) {
        throw AppError.forbidden("Managers can only manage announcements in their own department");
      }
      if (data.targetDepartmentId !== undefined && data.targetDepartmentId !== user.departmentId) {
        throw AppError.forbidden("Managers may only target their own department");
      }
    }

    const updated = await announcementRepository.update(id, {
      title: data.title,
      content: data.content,
      priority: data.priority,
      targetDepartmentId: data.targetDepartmentId,
      isPinned: data.isPinned,
      expiresAt: data.expiresAt !== undefined ? (data.expiresAt ? new Date(data.expiresAt) : null) : undefined,
    });

    await auditService.log({
      organizationId: existing.organizationId ?? null,
      actorId: user.id,
      action: "ANNOUNCEMENT_UPDATED",
      entityType: "Announcement",
      entityId: id,
      metadata: {
        title: updated.title,
        priority: updated.priority,
        targetDepartmentId: updated.targetDepartmentId,
        isPinned: updated.isPinned,
      },
    });

    return updated;
  }

  async delete(id: string, user: AuthenticatedUser) {
    const existing = await announcementRepository.findById(id);
    if (!existing) {
      throw AppError.notFound("Announcement not found");
    }

    assertSameTenant(existing.organizationId, user, "Announcement not found");

    if (!isAdminRole(user) && user.role !== Role.MANAGER) {
      throw AppError.forbidden("Only Administrators and Managers can delete announcements");
    }

    if (user.role === Role.MANAGER) {
      if (existing.targetDepartmentId !== user.departmentId) {
        throw AppError.forbidden("Managers can only delete announcements in their own department");
      }
    }

    await announcementRepository.delete(id);

    await auditService.log({
      organizationId: existing.organizationId ?? null,
      actorId: user.id,
      action: "ANNOUNCEMENT_DELETED",
      entityType: "Announcement",
      entityId: id,
      metadata: {
        title: existing.title,
      },
    });

    return { success: true };
  }

  async markAsRead(id: string, user: AuthenticatedUser) {
    const existing = await announcementRepository.findById(id);
    if (!existing) {
      throw AppError.notFound("Announcement not found");
    }

    assertSameTenant(existing.organizationId, user, "Announcement not found");

    if (!isAdminRole(user)) {
      if (existing.targetDepartmentId !== null && existing.targetDepartmentId !== user.departmentId) {
        throw AppError.notFound("Announcement not found");
      }
    }

    const record = await announcementRepository.markAsRead(id, user.id);
    return {
      success: true,
      readAt: record.readAt,
    };
  }

  async getReadStats(id: string, user: AuthenticatedUser) {
    const existing = await announcementRepository.findById(id);
    if (!existing) {
      throw AppError.notFound("Announcement not found");
    }

    assertSameTenant(existing.organizationId, user, "Announcement not found");

    if (existing.authorId !== user.id && !isAdminRole(user)) {
      throw AppError.forbidden("Only the author or an Administrator can view read metrics");
    }

    return existing.organizationId !== undefined
      ? announcementRepository.getReadStats(id, existing.targetDepartmentId, existing.organizationId)
      : announcementRepository.getReadStats(id, existing.targetDepartmentId);
  }

  async getUnreadForDashboard(user: AuthenticatedUser, limit = 3) {
    const orgId = resolveOptionalOrgId(user);
    const items = await (orgId !== undefined
      ? announcementRepository.getUnreadAnnouncements(
          user.id,
          user.departmentId,
          user.role,
          limit,
          orgId
        )
      : announcementRepository.getUnreadAnnouncements(
          user.id,
          user.departmentId,
          user.role,
          limit
        ));

    return items.map((item) => ({
      id: item.id,
      title: item.title,
      content: item.content,
      priority: item.priority,
      targetDepartmentId: item.targetDepartmentId,
      targetDepartment: item.targetDepartment,
      authorId: item.authorId,
      author: item.author,
      isPinned: item.isPinned,
      createdAt: item.createdAt,
      isRead: false,
    }));
  }

  async getDepartments(user?: AuthenticatedUser) {
    const orgId = user ? resolveOptionalOrgId(user) : undefined;
    return announcementRepository.getDepartments(orgId);
  }
}

export const announcementService = new AnnouncementService();
