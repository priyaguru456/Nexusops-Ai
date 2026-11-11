import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { userRepository, type FindUsersFilter, safeUserSelect } from "./user.repository";
import { authRepository } from "../auth/auth.repository";
import { auditService } from "../audit/audit.service";
import { AppError } from "../../lib/errors";
import { env } from "../../config/env";
import { assertSameTenant, isSuperAdmin, tenantWhere } from "../../lib/tenant";
import type { AuthenticatedUser } from "../../types/express";

export class UserService {
  async getUsers(filter: FindUsersFilter, actor?: AuthenticatedUser) {
    const scopedFilter = actor
      ? {
          ...filter,
          ...tenantWhere(actor, filter.organizationId),
        }
      : filter;
    return userRepository.findAll(scopedFilter);
  }

  /**
   * Counts currently active administrators in the system (optionally per organization).
   */
  async countActiveAdmins(organizationId?: string | null): Promise<number> {
    return prisma.user.count({
      where: {
        role: Role.ADMIN,
        isActive: true,
        ...(organizationId ? { organizationId } : {}),
      },
    });
  }

  async updateRole(
    adminUserId: string,
    targetUserId: string,
    newRole: Role,
    actor?: AuthenticatedUser
  ) {
    if (actor && isSuperAdmin(actor)) {
      if (adminUserId === targetUserId && newRole !== Role.SUPER_ADMIN) {
        throw AppError.badRequest("Super Admins cannot demote their own role");
      }
    } else if (adminUserId === targetUserId && newRole !== Role.ADMIN) {
      throw AppError.badRequest("Admins cannot demote their own role");
    }

    const targetUser = await userRepository.findById(targetUserId);
    if (!targetUser) {
      throw AppError.notFound("User not found");
    }

    if (actor) {
      assertSameTenant(targetUser.organizationId, actor, "User not found");
      if (!isSuperAdmin(actor)) {
        if (newRole === Role.SUPER_ADMIN || targetUser.role === Role.SUPER_ADMIN) {
          throw AppError.forbidden("Only Super Admins can assign or modify Super Admin roles");
        }
      }
    }

    // Protection: Never allow an organization to end up with zero active admins.
    // If targetUser is an active ADMIN and is being demoted to non-admin, verify count > 1.
    if (targetUser.role === Role.ADMIN && newRole !== Role.ADMIN && targetUser.isActive) {
      const activeAdminsCount = await this.countActiveAdmins(targetUser.organizationId);
      if (activeAdminsCount <= 1) {
        throw AppError.badRequest("Cannot demote the last active administrator");
      }
    }

    const previousRole = targetUser.role;
    const updatedUser = await userRepository.updateRole(targetUserId, newRole);

    await auditService.log({
      actorId: adminUserId,
      organizationId: targetUser.organizationId ?? null,
      action: "ROLE_CHANGE",
      entityType: "User",
      entityId: targetUserId,
      summary: `Changed role of user ${targetUser.email} from ${previousRole} to ${newRole}`,
      metadata: {
        previousRole,
        newRole,
      },
    });

    return updatedUser;
  }

  async updateStatus(
    adminUserId: string,
    targetUserId: string,
    isActive: boolean,
    actor?: AuthenticatedUser
  ) {
    if (adminUserId === targetUserId && !isActive) {
      throw AppError.badRequest("Admins cannot deactivate their own account");
    }

    const targetUser = await userRepository.findById(targetUserId);
    if (!targetUser) {
      throw AppError.notFound("User not found");
    }

    if (actor) {
      assertSameTenant(targetUser.organizationId, actor, "User not found");
      if (!isSuperAdmin(actor) && targetUser.role === Role.SUPER_ADMIN) {
        throw AppError.forbidden("Only Super Admins can modify Super Admin status");
      }
    }

    // Protection: Never allow an organization to end up with zero active admins.
    // If targetUser is an active ADMIN and is being deactivated, verify count > 1.
    if (targetUser.role === Role.ADMIN && !isActive && targetUser.isActive) {
      const activeAdminsCount = await this.countActiveAdmins(targetUser.organizationId);
      if (activeAdminsCount <= 1) {
        throw AppError.badRequest("Cannot deactivate the last active administrator");
      }
    }

    const previousStatus = targetUser.isActive;
    const updatedUser = await userRepository.updateStatus(targetUserId, isActive);

    if (!isActive) {
      // Invalidate all active sessions for deactivated user
      await authRepository.revokeAllUserRefreshTokens(targetUserId);

      await auditService.log({
        actorId: adminUserId,
        organizationId: targetUser.organizationId ?? null,
        action: "USER_DEACTIVATED",
        entityType: "User",
        entityId: targetUserId,
        metadata: {
          previousStatus,
          newStatus: isActive,
        },
      });
    } else {
      await auditService.log({
        actorId: adminUserId,
        organizationId: targetUser.organizationId ?? null,
        action: "USER_ACTIVATED",
        entityType: "User",
        entityId: targetUserId,
        metadata: {
          previousStatus,
          newStatus: isActive,
        },
      });
    }

    return updatedUser;
  }

  /**
   * Self-profile update: accepts strictly name.
   */
  async updateProfile(userId: string, name: string) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw AppError.notFound("User not found");
    }

    const previousName = user.name;
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { name },
      select: safeUserSelect,
    });

    await auditService.log({
      actorId: userId,
      organizationId: user.organizationId ?? null,
      action: "PROFILE_UPDATED",
      entityType: "User",
      entityId: userId,
      metadata: {
        previousName,
        newName: name,
      },
    });

    return updatedUser;
  }

  /**
   * Self-password change: verifies current password, validates new password,
   * revokes all other refresh tokens, and writes audit log. Never logs passwords.
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ) {
    const user = await userRepository.findByIdWithPassword(userId);
    if (!user) {
      throw AppError.notFound("User not found");
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw AppError.badRequest("Current password is incorrect");
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSamePassword) {
      throw AppError.badRequest("New password must differ from current password");
    }

    const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Invalidate all active sessions/refresh tokens for security
    await authRepository.revokeAllUserRefreshTokens(userId);

    await auditService.log({
      actorId: userId,
      organizationId: user.organizationId ?? null,
      action: "PASSWORD_CHANGED",
      entityType: "User",
      entityId: userId,
      metadata: {
        timestamp: new Date().toISOString(),
      },
    });

    return { message: "Password updated successfully" };
  }
}

export const userService = new UserService();
