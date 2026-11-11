import { prisma } from "../../lib/prisma";
import {
  assertSameTenant,
  DEFAULT_ORGANIZATION_ID,
  isAdminRole,
  isSuperAdmin,
  resolveTenantId,
} from "../../lib/tenant";
import {
  Role,
  LeaveType,
  LeaveStatus,
  Prisma,
  type LeaveRequest,
  type LeaveBalance,
} from "@prisma/client";
import { leaveRepository } from "./leave.repository";
import { LEAVE_CONFIG } from "./leave.config";
import {
  normalizeDateToUTC,
  formatDateKeyUTC,
  calculateWorkingDays,
  isWithinPastGracePeriod,
} from "./leave.utils";
import { approvalService } from "../approvals/approval.service";
import { auditService } from "../audit/audit.service";
import { notificationService } from "../notifications/notification.service";
import { AppError } from "../../lib/errors";
import type { AuthenticatedUser } from "../../types/express";
import type {
  ApplyLeaveInput,
  ListLeavesQuery,
  AddHolidayInput,
  UpdateHolidayInput,
} from "./leave.schema";

function resolveOptionalLeaveOrgId(user: AuthenticatedUser): string | undefined {
  if (user.organizationId === undefined) return undefined;
  if (isSuperAdmin(user) && !user.organizationId) return undefined;
  return resolveTenantId(user);
}

export class LeaveService {
  /**
   * Retrieves or automatically initializes the annual leave balance for a user.
   */
  async getOrCreateBalance(
    userId: string,
    year: number,
    tx?: Prisma.TransactionClient,
    organizationId: string = DEFAULT_ORGANIZATION_ID
  ): Promise<LeaveBalance> {
    const existing = await leaveRepository.findBalance(userId, year, tx);
    if (existing) {
      return existing;
    }

    return leaveRepository.createBalance(
      {
        organizationId,
        userId,
        year,
        casualDays: LEAVE_CONFIG.DEFAULT_ALLOWANCES.casualDays,
        sickDays: LEAVE_CONFIG.DEFAULT_ALLOWANCES.sickDays,
        annualDays: LEAVE_CONFIG.DEFAULT_ALLOWANCES.annualDays,
        usedCasual: 0,
        usedSick: 0,
        usedAnnual: 0,
      },
      tx
    );
  }

  /**
   * Submits a new leave application with validation, balance checking,
   * overlap detection, working days calculation, and manager approval routing.
   */
  async applyLeave(
    input: ApplyLeaveInput,
    user: AuthenticatedUser
  ) {
    const startDate = normalizeDateToUTC(input.startDate);
    const endDate = normalizeDateToUTC(input.endDate);
    const orgId =
      user.organizationId !== undefined ? resolveTenantId(user) : DEFAULT_ORGANIZATION_ID;

    // 1. Rule: start date must not be after end date
    if (startDate.getTime() > endDate.getTime()) {
      throw AppError.badRequest("Start date cannot be after end date");
    }

    // 2. Rule: limit past-dated leave to configurable grace period
    if (!isWithinPastGracePeriod(startDate, LEAVE_CONFIG.PAST_LEAVE_GRACE_DAYS)) {
      throw AppError.badRequest(
        `Leave start date cannot be older than the past-dated grace period of ${LEAVE_CONFIG.PAST_LEAVE_GRACE_DAYS} days`
      );
    }

    // 3. Rule: count working days excluding weekends and company holidays
    const holidays = await (user.organizationId !== undefined
      ? leaveRepository.findHolidaysBetween(startDate, endDate, undefined, orgId)
      : leaveRepository.findHolidaysBetween(startDate, endDate));
    const holidayDateKeys = new Set(holidays.map((h) => formatDateKeyUTC(h.date)));
    const daysCount = calculateWorkingDays(startDate, endDate, holidayDateKeys);

    if (daysCount === 0) {
      throw AppError.badRequest(
        "Selected date range contains 0 working days (all selected days are weekends or official holidays)"
      );
    }

    // 4. Rule: reject overlapping leave requests
    const overlapping = await leaveRepository.findOverlappingLeaves(
      user.id,
      startDate,
      endDate
    );
    if (overlapping.length > 0) {
      throw AppError.conflict(
        "Leave request overlaps with an existing pending or approved leave request"
      );
    }

    // 5. Rule: check sufficient balance (UNPAID is exempt)
    const leaveYear = startDate.getUTCFullYear();
    const balance = await this.getOrCreateBalance(user.id, leaveYear, undefined, orgId);

    if (input.type === LeaveType.CASUAL) {
      const remainingCasual = balance.casualDays - balance.usedCasual;
      if (daysCount > remainingCasual) {
        throw AppError.badRequest(
          `Insufficient casual leave balance. Requested: ${daysCount} days, Available: ${remainingCasual} days`
        );
      }
    } else if (input.type === LeaveType.SICK) {
      const remainingSick = balance.sickDays - balance.usedSick;
      if (daysCount > remainingSick) {
        throw AppError.badRequest(
          `Insufficient sick leave balance. Requested: ${daysCount} days, Available: ${remainingSick} days`
        );
      }
    } else if (input.type === LeaveType.ANNUAL) {
      const remainingAnnual = balance.annualDays - balance.usedAnnual;
      if (daysCount > remainingAnnual) {
        throw AppError.badRequest(
          `Insufficient annual leave balance. Requested: ${daysCount} days, Available: ${remainingAnnual} days`
        );
      }
    }

    // 6. Execute in transaction: create leave record and route approval step
    return prisma.$transaction(async (tx) => {
      const leave = await leaveRepository.createLeaveRequest(
        {
          organizationId: orgId,
          userId: user.id,
          type: input.type,
          startDate,
          endDate,
          daysCount,
          reason: input.reason.trim(),
          status: LeaveStatus.PENDING,
        },
        tx
      );

      // Determine approver: employee's manager, with ADMIN as fallback
      const requester = await tx.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          name: true,
          managerId: true,
          departmentId: true,
          manager: { select: { id: true, isActive: true } },
        },
      });

      let approverRole: Role = Role.MANAGER;
      let approverId: string | null = null;

      if (requester?.managerId && requester.manager?.isActive) {
        approverRole = Role.MANAGER;
        approverId = requester.managerId;
      } else {
        // Fallback to Admin if employee has no active manager
        approverRole = Role.ADMIN;
        approverId = null;
      }

      // Create generic approval step for entityType LEAVE
      await approvalService.initializeApprovalStepsForEntity(
        {
          entityType: "LEAVE",
          entityId: leave.id,
          title: `Leave Request: ${leave.type} (${leave.daysCount} days)`,
          requesterId: user.id,
          organizationId: orgId,
          steps: [
            {
              stepOrder: 1,
              approverRole,
              approverId,
            },
          ],
          link: `/leaves/${leave.id}`,
        },
        tx
      );

      // Audit log
      await auditService.log({
        organizationId: user.organizationId !== undefined ? orgId : null,
        actorId: user.id,
        action: "LEAVE_SUBMITTED",
        entityType: "Leave",
        entityId: leave.id,
        summary: `Submitted ${input.type} leave for ${daysCount} working days (${formatDateKeyUTC(startDate)} to ${formatDateKeyUTC(endDate)})`,
        metadata: {
          type: input.type,
          startDate: formatDateKeyUTC(startDate),
          endDate: formatDateKeyUTC(endDate),
          daysCount,
          approverId,
          approverRole,
        },
      });

      return leave;
    });
  }

  /**
   * Approves a leave request: updates status, deducts balance in transaction,
   * updates approval step, logs audit, and notifies employee.
   */
  async approveLeave(
    leaveId: string,
    approver: AuthenticatedUser,
    comment?: string,
    existingTx?: Prisma.TransactionClient
  ) {
    const execute = async (tx: Prisma.TransactionClient) => {
      const leave = await leaveRepository.findLeaveById(leaveId, tx);
      if (!leave) {
        throw AppError.notFound("Leave request not found");
      }

      assertSameTenant(leave.organizationId, approver, "Leave request not found");

      if (leave.status !== LeaveStatus.PENDING) {
        throw AppError.conflict(
          `Leave request has already been decided with status: ${leave.status}`
        );
      }

      // Check self-approval: requester cannot approve their own leave
      if (leave.userId === approver.id) {
        throw AppError.forbidden("Requesters cannot approve their own leave requests");
      }

      // Permission check: approver must be Admin or the employee's direct manager
      const isDirectManager = leave.user.managerId === approver.id;
      const isAdmin = isAdminRole(approver);

      if (!isAdmin && !isDirectManager) {
        throw AppError.forbidden("You are not authorized to approve this leave request");
      }

      // Deduct balance (UNPAID is exempt)
      if (leave.type !== LeaveType.UNPAID) {
        const year = leave.startDate.getUTCFullYear();
        const balance = await this.getOrCreateBalance(
          leave.userId,
          year,
          tx,
          leave.organizationId ?? DEFAULT_ORGANIZATION_ID
        );

        const updateData: Prisma.LeaveBalanceUpdateInput = {};
        if (leave.type === LeaveType.CASUAL) {
          const newUsed = balance.usedCasual + leave.daysCount;
          if (newUsed > balance.casualDays) {
            throw AppError.badRequest(
              `Insufficient casual leave balance to complete approval. Available: ${balance.casualDays - balance.usedCasual}, Required: ${leave.daysCount}`
            );
          }
          updateData.usedCasual = newUsed;
        } else if (leave.type === LeaveType.SICK) {
          const newUsed = balance.usedSick + leave.daysCount;
          if (newUsed > balance.sickDays) {
            throw AppError.badRequest(
              `Insufficient sick leave balance to complete approval. Available: ${balance.sickDays - balance.usedSick}, Required: ${leave.daysCount}`
            );
          }
          updateData.usedSick = newUsed;
        } else if (leave.type === LeaveType.ANNUAL) {
          const newUsed = balance.usedAnnual + leave.daysCount;
          if (newUsed > balance.annualDays) {
            throw AppError.badRequest(
              `Insufficient annual leave balance to complete approval. Available: ${balance.annualDays - balance.usedAnnual}, Required: ${leave.daysCount}`
            );
          }
          updateData.usedAnnual = newUsed;
        }

        await leaveRepository.updateBalance(balance.id, updateData, tx);
      }

      // Update LeaveRequest state
      const updatedLeave = await leaveRepository.updateLeaveRequest(
        leaveId,
        {
          status: LeaveStatus.APPROVED,
          approverId: approver.id,
          decidedAt: new Date(),
        },
        tx
      );

      // Update approval step if one exists and is pending
      const pendingStep = await tx.approvalStep.findFirst({
        where: {
          entityType: "LEAVE",
          entityId: leaveId,
          status: "PENDING",
        },
      });

      if (pendingStep) {
        await tx.approvalStep.update({
          where: { id: pendingStep.id },
          data: {
            status: "APPROVED",
            approverId: approver.id,
            decidedAt: new Date(),
            comment: comment?.trim() || null,
          },
        });
      }

      // Send notification to employee
      await notificationService.notify(
        leave.userId,
        "LEAVE_APPROVED",
        "Leave Request Approved",
        `Your ${leave.type} leave request for ${leave.daysCount} working day(s) (${formatDateKeyUTC(leave.startDate)} to ${formatDateKeyUTC(leave.endDate)}) has been approved.`,
        `/leaves/${leave.id}`,
        "Leave",
        leave.id
      );

      // Record audit log
      await auditService.log({
        organizationId: leave.organizationId ?? null,
        actorId: approver.id,
        action: "LEAVE_APPROVED",
        entityType: "Leave",
        entityId: leave.id,
        summary: `Approved ${leave.type} leave for ${leave.user.name} (${leave.daysCount} days)`,
        metadata: {
          leaveId: leave.id,
          type: leave.type,
          daysCount: leave.daysCount,
          applicantId: leave.userId,
          comment: comment ?? null,
        },
      });

      return updatedLeave;
    };

    if (existingTx) {
      return execute(existingTx);
    }
    return prisma.$transaction(execute);
  }

  /**
   * Rejects a leave request: updates status, updates approval step,
   * leaves balance untouched, logs audit, and notifies employee.
   */
  async rejectLeave(
    leaveId: string,
    approver: AuthenticatedUser,
    comment?: string,
    existingTx?: Prisma.TransactionClient
  ) {
    const execute = async (tx: Prisma.TransactionClient) => {
      const leave = await leaveRepository.findLeaveById(leaveId, tx);
      if (!leave) {
        throw AppError.notFound("Leave request not found");
      }

      assertSameTenant(leave.organizationId, approver, "Leave request not found");

      if (leave.status !== LeaveStatus.PENDING) {
        throw AppError.conflict(
          `Leave request has already been decided with status: ${leave.status}`
        );
      }

      if (leave.userId === approver.id) {
        throw AppError.forbidden("Requesters cannot reject their own leave requests");
      }

      const isDirectManager = leave.user.managerId === approver.id;
      const isAdmin = isAdminRole(approver);

      if (!isAdmin && !isDirectManager) {
        throw AppError.forbidden("You are not authorized to reject this leave request");
      }

      const updatedLeave = await leaveRepository.updateLeaveRequest(
        leaveId,
        {
          status: LeaveStatus.REJECTED,
          approverId: approver.id,
          decidedAt: new Date(),
        },
        tx
      );

      const pendingStep = await tx.approvalStep.findFirst({
        where: {
          entityType: "LEAVE",
          entityId: leaveId,
          status: "PENDING",
        },
      });

      if (pendingStep) {
        await tx.approvalStep.update({
          where: { id: pendingStep.id },
          data: {
            status: "REJECTED",
            approverId: approver.id,
            decidedAt: new Date(),
            comment: comment?.trim() || null,
          },
        });
      }

      const reasonNote = comment ? ` Reason: ${comment.trim()}` : "";
      await notificationService.notify(
        leave.userId,
        "LEAVE_REJECTED",
        "Leave Request Rejected",
        `Your ${leave.type} leave request for ${leave.daysCount} working day(s) was rejected.${reasonNote}`,
        `/leaves/${leave.id}`,
        "Leave",
        leave.id
      );

      await auditService.log({
        organizationId: leave.organizationId ?? null,
        actorId: approver.id,
        action: "LEAVE_REJECTED",
        entityType: "Leave",
        entityId: leave.id,
        summary: `Rejected ${leave.type} leave for ${leave.user.name} (${leave.daysCount} days)`,
        metadata: {
          leaveId: leave.id,
          type: leave.type,
          daysCount: leave.daysCount,
          applicantId: leave.userId,
          comment: comment ?? null,
        },
      });

      return updatedLeave;
    };

    if (existingTx) {
      return execute(existingTx);
    }
    return prisma.$transaction(execute);
  }

  /**
   * Cancels a leave request:
   * - Allowed for applicant, employee's direct manager, or Admin.
   * - If leave was already APPROVED, restores the deducted leave balance.
   */
  async cancelLeave(
    leaveId: string,
    user: AuthenticatedUser,
    reason?: string
  ) {
    return prisma.$transaction(async (tx) => {
      const leave = await leaveRepository.findLeaveById(leaveId, tx);
      if (!leave) {
        throw AppError.notFound("Leave request not found");
      }

      assertSameTenant(leave.organizationId, user, "Leave request not found");

      if (
        leave.status === LeaveStatus.CANCELLED ||
        leave.status === LeaveStatus.REJECTED
      ) {
        throw AppError.conflict(
          `Cannot cancel leave request that is already ${leave.status.toLowerCase()}`
        );
      }

      const isOwner = leave.userId === user.id;
      const isDirectManager = leave.user.managerId === user.id;
      const isAdmin = isAdminRole(user);

      if (!isOwner && !isDirectManager && !isAdmin) {
        throw AppError.forbidden("You are not authorized to cancel this leave request");
      }

      const wasApproved = leave.status === LeaveStatus.APPROVED;

      // Restore balance if cancelled after approval (UNPAID is exempt)
      if (wasApproved && leave.type !== LeaveType.UNPAID) {
        const year = leave.startDate.getUTCFullYear();
        const balance = await this.getOrCreateBalance(
          leave.userId,
          year,
          tx,
          leave.organizationId ?? DEFAULT_ORGANIZATION_ID
        );

        const updateData: Prisma.LeaveBalanceUpdateInput = {};
        if (leave.type === LeaveType.CASUAL) {
          updateData.usedCasual = Math.max(0, balance.usedCasual - leave.daysCount);
        } else if (leave.type === LeaveType.SICK) {
          updateData.usedSick = Math.max(0, balance.usedSick - leave.daysCount);
        } else if (leave.type === LeaveType.ANNUAL) {
          updateData.usedAnnual = Math.max(0, balance.usedAnnual - leave.daysCount);
        }

        await leaveRepository.updateBalance(balance.id, updateData, tx);
      }

      // Update Leave status to CANCELLED
      const updatedLeave = await leaveRepository.updateLeaveRequest(
        leaveId,
        {
          status: LeaveStatus.CANCELLED,
        },
        tx
      );

      // Cancel pending approval steps if any
      await tx.approvalStep.updateMany({
        where: {
          entityType: "LEAVE",
          entityId: leaveId,
          status: "PENDING",
        },
        data: {
          status: "SKIPPED",
          comment: `Leave was cancelled: ${reason?.trim() || "No reason specified"}`,
        },
      });

      // Send notifications
      if (!isOwner) {
        await notificationService.notify(
          leave.userId,
          "LEAVE_CANCELLED",
          "Leave Request Cancelled",
          `Your ${leave.type} leave request has been cancelled by ${user.name}.`,
          `/leaves/${leave.id}`,
          "Leave",
          leave.id
        );
      } else if (wasApproved && leave.approverId) {
        await notificationService.notify(
          leave.approverId,
          "LEAVE_CANCELLED",
          "Approved Leave Cancelled",
          `${leave.user.name} cancelled their approved ${leave.type} leave (${leave.daysCount} days).`,
          `/leaves/${leave.id}`,
          "Leave",
          leave.id
        );
      }

      // Record audit log
      await auditService.log({
        organizationId: leave.organizationId ?? null,
        actorId: user.id,
        action: "LEAVE_CANCELLED",
        entityType: "Leave",
        entityId: leave.id,
        summary: `Cancelled ${leave.type} leave for ${leave.user.name} (${leave.daysCount} days)`,
        metadata: {
          leaveId: leave.id,
          wasApproved,
          balanceRestored: wasApproved && leave.type !== LeaveType.UNPAID,
          reason: reason ?? null,
        },
      });

      return updatedLeave;
    });
  }

  /**
   * Retrieves single leave request by ID with RBAC access check.
   */
  async getLeaveById(id: string, user: AuthenticatedUser) {
    const leave = await leaveRepository.findLeaveById(id);
    if (!leave) {
      throw AppError.notFound("Leave request not found");
    }

    assertSameTenant(leave.organizationId, user, "Leave request not found");

    const isOwner = leave.userId === user.id;
    const isDirectManager = leave.user.managerId === user.id;
    const isAdmin = isAdminRole(user);

    if (!isOwner && !isDirectManager && !isAdmin) {
      throw AppError.forbidden("You do not have access to view this leave request");
    }

    return leave;
  }

  /**
   * Lists leave requests with role-based scoping and pagination.
   */
  async listLeaves(query: ListLeavesQuery, user: AuthenticatedUser) {
    const orgId = resolveOptionalLeaveOrgId(user);
    let scopedUserId = query.userId;
    let scopedUserIds: string[] | undefined = undefined;

    if (user.role === Role.EMPLOYEE) {
      // Employees may only view their own leave requests
      if (query.userId && query.userId !== user.id) {
        throw AppError.forbidden("Employees can only view their own leave requests");
      }
      scopedUserId = user.id;
    } else if (user.role === Role.MANAGER) {
      if (query.userId) {
        if (query.userId !== user.id) {
          // Check if target user is a direct report in same organization
          const target = await prisma.user.findUnique({
            where: { id: query.userId },
            select: { managerId: true, organizationId: true },
          });
          if (target?.managerId !== user.id || (orgId && target?.organizationId && target.organizationId !== orgId)) {
            throw AppError.forbidden("Managers can only view leaves of their direct reports or themselves");
          }
        }
        scopedUserId = query.userId;
      } else {
        // Find all direct reports
        const reports = await prisma.user.findMany({
          where: {
            managerId: user.id,
            isActive: true,
            ...(orgId ? { organizationId: orgId } : {}),
          },
          select: { id: true },
        });
        scopedUserIds = [user.id, ...reports.map((r) => r.id)];
      }
    } else if (isAdminRole(user)) {
      // Admin can filter by any userId or view all in their organization
      scopedUserId = query.userId;
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const filters = {
      ...(orgId ? { organizationId: orgId } : {}),
      userId: scopedUserId,
      userIds: scopedUserIds,
      status: query.status,
      type: query.type,
      year: query.year,
    };

    const [leaves, total] = await Promise.all([
      leaveRepository.listLeaves({ ...filters, skip, take: limit }),
      leaveRepository.countLeaves(filters),
    ]);

    return {
      leaves,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Retrieves leave balance for a given user and year with RBAC checks.
   */
  async getBalance(
    targetUserId: string | undefined,
    year: number | undefined,
    user: AuthenticatedUser
  ) {
    const requestedUserId = targetUserId || user.id;
    const targetYear = year || new Date().getFullYear();
    const orgId = resolveOptionalLeaveOrgId(user);

    if (requestedUserId !== user.id) {
      if (user.role === Role.EMPLOYEE) {
        throw AppError.forbidden("Employees can only view their own leave balance");
      }
      if (user.role === Role.MANAGER) {
        const target = await prisma.user.findUnique({
          where: { id: requestedUserId },
          select: { managerId: true, organizationId: true },
        });
        if (target?.managerId !== user.id || (orgId && target?.organizationId && target.organizationId !== orgId)) {
          throw AppError.forbidden("Managers can only view leave balances of their direct reports");
        }
      } else if (isAdminRole(user) && orgId) {
        const target = await prisma.user.findUnique({
          where: { id: requestedUserId },
          select: { organizationId: true },
        });
        if (target && target.organizationId && target.organizationId !== orgId) {
          throw AppError.notFound("User not found");
        }
      }
    }

    const balance = await this.getOrCreateBalance(
      requestedUserId,
      targetYear,
      undefined,
      orgId ?? DEFAULT_ORGANIZATION_ID
    );

    return {
      ...balance,
      remainingCasual: Math.max(0, balance.casualDays - balance.usedCasual),
      remainingSick: Math.max(0, balance.sickDays - balance.usedSick),
      remainingAnnual: Math.max(0, balance.annualDays - balance.usedAnnual),
    };
  }

  /**
   * Registers a company holiday (Admin only).
   */
  async addHoliday(input: AddHolidayInput, user: AuthenticatedUser) {
    if (!isAdminRole(user)) {
      throw AppError.forbidden("Only Administrators can register company holidays");
    }

    const orgId = user.organizationId !== undefined ? resolveTenantId(user) : undefined;
    const date = normalizeDateToUTC(input.date);
    const existing = await (orgId !== undefined
      ? leaveRepository.findHolidayByDate(date, undefined, orgId)
      : leaveRepository.findHolidayByDate(date));
    if (existing) {
      throw AppError.conflict(
        `A holiday is already registered on ${formatDateKeyUTC(date)}: ${existing.name}`
      );
    }

    const holiday = await leaveRepository.createHoliday({
      ...(orgId !== undefined ? { organizationId: orgId } : {}),
      name: input.name.trim(),
      date,
    });

    await auditService.log({
      organizationId: holiday.organizationId ?? orgId ?? null,
      actorId: user.id,
      action: "HOLIDAY_CREATED",
      entityType: "Holiday",
      entityId: holiday.id,
      summary: `Registered company holiday: ${holiday.name} on ${formatDateKeyUTC(holiday.date)}`,
      metadata: {
        name: holiday.name,
        date: formatDateKeyUTC(holiday.date),
      },
    });

    return holiday;
  }

  /**
   * Updates an existing company holiday (Admin only).
   */
  async updateHoliday(id: string, input: UpdateHolidayInput, user: AuthenticatedUser) {
    if (!isAdminRole(user)) {
      throw AppError.forbidden("Only Administrators can modify company holidays");
    }

    const existing = await leaveRepository.findHolidayById(id);
    if (!existing) {
      throw AppError.notFound("Holiday not found");
    }

    assertSameTenant(existing.organizationId, user, "Holiday not found");

    let normalizedDate = existing.date;
    if (input.date) {
      normalizedDate = normalizeDateToUTC(input.date);
      if (normalizedDate.getTime() !== existing.date.getTime()) {
        const conflict = await leaveRepository.findHolidayByDate(
          normalizedDate,
          undefined,
          existing.organizationId ?? DEFAULT_ORGANIZATION_ID
        );
        if (conflict && conflict.id !== id) {
          throw AppError.conflict(
            `A holiday is already registered on ${formatDateKeyUTC(normalizedDate)}: ${conflict.name}`
          );
        }
      }
    }

    const updated = await leaveRepository.updateHoliday(id, {
      name: input.name ? input.name.trim() : undefined,
      date: input.date ? normalizedDate : undefined,
    });

    await auditService.log({
      organizationId: existing.organizationId ?? null,
      actorId: user.id,
      action: "HOLIDAY_UPDATED",
      entityType: "Holiday",
      entityId: updated.id,
      summary: `Updated company holiday: ${updated.name} on ${formatDateKeyUTC(updated.date)}`,
      metadata: {
        holidayId: updated.id,
        previousName: existing.name,
        newName: updated.name,
        previousDate: formatDateKeyUTC(existing.date),
        newDate: formatDateKeyUTC(updated.date),
      },
    });

    return updated;
  }

  /**
   * Deletes a company holiday (Admin only).
   */
  async deleteHoliday(id: string, user: AuthenticatedUser) {
    if (!isAdminRole(user)) {
      throw AppError.forbidden("Only Administrators can delete company holidays");
    }

    const existing = await leaveRepository.findHolidayById(id);
    if (!existing) {
      throw AppError.notFound("Holiday not found");
    }

    assertSameTenant(existing.organizationId, user, "Holiday not found");

    const deleted = await leaveRepository.deleteHoliday(id);

    await auditService.log({
      organizationId: existing.organizationId ?? null,
      actorId: user.id,
      action: "HOLIDAY_DELETED",
      entityType: "Holiday",
      entityId: deleted.id,
      summary: `Deleted company holiday: ${deleted.name} on ${formatDateKeyUTC(deleted.date)}`,
      metadata: {
        holidayId: deleted.id,
        name: deleted.name,
        date: formatDateKeyUTC(deleted.date),
      },
    });

    return deleted;
  }

  /**
   * Lists company holidays, optionally filtered by year.
   */
  async listHolidays(year?: number, user?: AuthenticatedUser) {
    const orgId = user ? resolveOptionalLeaveOrgId(user) : undefined;
    return leaveRepository.findAllHolidays(year, undefined, orgId);
  }
}

export const leaveService = new LeaveService();
