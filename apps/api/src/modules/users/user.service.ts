import { Role } from "@prisma/client";
import { userRepository, type FindUsersFilter } from "./user.repository";
import { authRepository } from "../auth/auth.repository";
import { auditService } from "../audit/audit.service";
import { AppError } from "../../lib/errors";

export class UserService {
  async getUsers(filter: FindUsersFilter) {
    return userRepository.findAll(filter);
  }

  async updateRole(adminUserId: string, targetUserId: string, newRole: Role) {
    if (adminUserId === targetUserId) {
      throw AppError.badRequest("Admins cannot demote or change their own role");
    }

    const targetUser = await userRepository.findById(targetUserId);
    if (!targetUser) {
      throw AppError.notFound("User not found");
    }

    const previousRole = targetUser.role;
    const updatedUser = await userRepository.updateRole(targetUserId, newRole);

    await auditService.log({
      actorId: adminUserId,
      action: "ROLE_CHANGE",
      entityType: "User",
      entityId: targetUserId,
      metadata: {
        previousRole,
        newRole,
      },
    });

    return updatedUser;
  }

  async updateStatus(adminUserId: string, targetUserId: string, isActive: boolean) {
    if (adminUserId === targetUserId && !isActive) {
      throw AppError.badRequest("Admins cannot deactivate their own account");
    }

    const targetUser = await userRepository.findById(targetUserId);
    if (!targetUser) {
      throw AppError.notFound("User not found");
    }

    const previousStatus = targetUser.isActive;
    const updatedUser = await userRepository.updateStatus(targetUserId, isActive);

    if (!isActive) {
      // Invalidate all active sessions for deactivated user
      await authRepository.revokeAllUserRefreshTokens(targetUserId);

      await auditService.log({
        actorId: adminUserId,
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
}

export const userService = new UserService();
