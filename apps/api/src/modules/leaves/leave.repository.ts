import { prisma } from "../../lib/prisma";
import {
  Prisma,
  LeaveType,
  LeaveStatus,
  type LeaveRequest,
  type LeaveBalance,
  type Holiday,
} from "@prisma/client";

export class LeaveRepository {
  /**
   * Retrieves holidays between two dates (inclusive).
   */
  async findHolidaysBetween(
    startDate: Date,
    endDate: Date,
    tx?: Prisma.TransactionClient
  ): Promise<Holiday[]> {
    const client = tx || prisma;
    return client.holiday.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { date: "asc" },
    });
  }

  /**
   * Retrieves all registered holidays, optionally filtered by year.
   */
  async findAllHolidays(
    year?: number,
    tx?: Prisma.TransactionClient
  ): Promise<Holiday[]> {
    const client = tx || prisma;
    const where: Prisma.HolidayWhereInput = {};

    if (year) {
      const yearStart = new Date(Date.UTC(year, 0, 1));
      const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
      where.date = { gte: yearStart, lte: yearEnd };
    }

    return client.holiday.findMany({
      where,
      orderBy: { date: "asc" },
    });
  }

  /**
   * Creates a new company holiday.
   */
  async createHoliday(
    data: { name: string; date: Date },
    tx?: Prisma.TransactionClient
  ): Promise<Holiday> {
    const client = tx || prisma;
    return client.holiday.create({ data });
  }

  /**
   * Finds a holiday by its exact UTC date.
   */
  async findHolidayByDate(
    date: Date,
    tx?: Prisma.TransactionClient
  ): Promise<Holiday | null> {
    const client = tx || prisma;
    return client.holiday.findUnique({
      where: { date },
    });
  }

  /**
   * Finds a holiday by its unique ID.
   */
  async findHolidayById(
    id: string,
    tx?: Prisma.TransactionClient
  ): Promise<Holiday | null> {
    const client = tx || prisma;
    return client.holiday.findUnique({
      where: { id },
    });
  }

  /**
   * Updates an existing company holiday.
   */
  async updateHoliday(
    id: string,
    data: { name?: string; date?: Date },
    tx?: Prisma.TransactionClient
  ): Promise<Holiday> {
    const client = tx || prisma;
    return client.holiday.update({
      where: { id },
      data,
    });
  }

  /**
   * Deletes a company holiday.
   */
  async deleteHoliday(
    id: string,
    tx?: Prisma.TransactionClient
  ): Promise<Holiday> {
    const client = tx || prisma;
    return client.holiday.delete({
      where: { id },
    });
  }

  /**
   * Finds leave balance for a given user and calendar year.
   */
  async findBalance(
    userId: string,
    year: number,
    tx?: Prisma.TransactionClient
  ): Promise<LeaveBalance | null> {
    const client = tx || prisma;
    return client.leaveBalance.findUnique({
      where: {
        userId_year: {
          userId,
          year,
        },
      },
    });
  }

  /**
   * Creates initial leave balance for a user and year.
   */
  async createBalance(
    data: Prisma.LeaveBalanceUncheckedCreateInput,
    tx?: Prisma.TransactionClient
  ): Promise<LeaveBalance> {
    const client = tx || prisma;
    return client.leaveBalance.create({ data });
  }

  /**
   * Updates leave balance (e.g. deductions or restorations).
   */
  async updateBalance(
    id: string,
    data: Prisma.LeaveBalanceUpdateInput,
    tx?: Prisma.TransactionClient
  ): Promise<LeaveBalance> {
    const client = tx || prisma;
    return client.leaveBalance.update({
      where: { id },
      data,
    });
  }

  /**
   * Finds any existing non-cancelled and non-rejected leave requests overlapping the given range.
   */
  async findOverlappingLeaves(
    userId: string,
    startDate: Date,
    endDate: Date,
    excludeId?: string,
    tx?: Prisma.TransactionClient
  ): Promise<LeaveRequest[]> {
    const client = tx || prisma;
    return client.leaveRequest.findMany({
      where: {
        userId,
        status: { in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  /**
   * Creates a new leave request.
   */
  async createLeaveRequest(
    data: Prisma.LeaveRequestUncheckedCreateInput,
    tx?: Prisma.TransactionClient
  ): Promise<LeaveRequest> {
    const client = tx || prisma;
    return client.leaveRequest.create({ data });
  }

  /**
   * Finds leave request by ID, including applicant and approver profiles.
   */
  async findLeaveById(
    id: string,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    return client.leaveRequest.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            departmentId: true,
            managerId: true,
            department: { select: { id: true, name: true } },
          },
        },
        approver: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });
  }

  /**
   * Updates leave request state.
   */
  async updateLeaveRequest(
    id: string,
    data: Prisma.LeaveRequestUncheckedUpdateInput,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    return client.leaveRequest.update({
      where: { id },
      data,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            departmentId: true,
            managerId: true,
          },
        },
        approver: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });
  }

  /**
   * Lists leave requests with filtering and pagination.
   */
  async listLeaves(
    filters: {
      userId?: string;
      userIds?: string[];
      status?: LeaveStatus;
      type?: LeaveType;
      year?: number;
      skip?: number;
      take?: number;
    },
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    const where: Prisma.LeaveRequestWhereInput = {};

    if (filters.userId) {
      where.userId = filters.userId;
    } else if (filters.userIds && filters.userIds.length > 0) {
      where.userId = { in: filters.userIds };
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.year) {
      const yearStart = new Date(Date.UTC(filters.year, 0, 1));
      const yearEnd = new Date(Date.UTC(filters.year, 11, 31, 23, 59, 59, 999));
      where.startDate = { gte: yearStart, lte: yearEnd };
    }

    return client.leaveRequest.findMany({
      where,
      skip: filters.skip ?? 0,
      take: filters.take ?? 20,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            departmentId: true,
            department: { select: { id: true, name: true } },
          },
        },
        approver: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });
  }

  /**
   * Counts leave requests matching the given filters.
   */
  async countLeaves(
    filters: {
      userId?: string;
      userIds?: string[];
      status?: LeaveStatus;
      type?: LeaveType;
      year?: number;
    },
    tx?: Prisma.TransactionClient
  ): Promise<number> {
    const client = tx || prisma;
    const where: Prisma.LeaveRequestWhereInput = {};

    if (filters.userId) {
      where.userId = filters.userId;
    } else if (filters.userIds && filters.userIds.length > 0) {
      where.userId = { in: filters.userIds };
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.year) {
      const yearStart = new Date(Date.UTC(filters.year, 0, 1));
      const yearEnd = new Date(Date.UTC(filters.year, 11, 31, 23, 59, 59, 999));
      where.startDate = { gte: yearStart, lte: yearEnd };
    }

    return client.leaveRequest.count({ where });
  }
}

export const leaveRepository = new LeaveRepository();
