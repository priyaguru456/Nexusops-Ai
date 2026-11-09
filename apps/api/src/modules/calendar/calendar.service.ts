import { Role, LeaveStatus, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import type { AuthenticatedUser } from "../../types/express";
import type { CalendarEventDTO, GetCalendarEventsQuery } from "./calendar.schema";

export class CalendarService {
  /**
   * Parses input date boundary strings into UTC Date instances.
   */
  private parseRangeBoundaries(startStr: string, endStr: string): { startDate: Date; endDate: Date } {
    let startDate: Date;
    let endDate: Date;

    if (/^\d{4}-\d{2}-\d{2}$/.test(startStr)) {
      startDate = new Date(`${startStr}T00:00:00.000Z`);
    } else {
      startDate = new Date(startStr);
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(endStr)) {
      endDate = new Date(`${endStr}T23:59:59.999Z`);
    } else {
      endDate = new Date(endStr);
    }

    return { startDate, endDate };
  }

  /**
   * Fetches unified role-scoped calendar events for the visible date range.
   */
  async getEvents(
    query: GetCalendarEventsQuery,
    user: AuthenticatedUser
  ): Promise<{ events: CalendarEventDTO[]; range: { start: string; end: string } }> {
    const { startDate, endDate } = this.parseRangeBoundaries(query.start, query.end);

    const requestedTypes = query.types
      ? query.types.toLowerCase().split(",").map((t) => t.trim())
      : ["tasks", "requests", "leaves", "holidays"];

    const includeTasks = requestedTypes.includes("tasks");
    const includeRequests = requestedTypes.includes("requests");
    const includeLeaves = requestedTypes.includes("leaves");
    const includeHolidays = requestedTypes.includes("holidays");

    const promises: [
      Promise<any[]>,
      Promise<any[]>,
      Promise<any[]>,
      Promise<any[]>
    ] = [
      includeTasks ? this.fetchTasks(startDate, endDate, user) : Promise.resolve([]),
      includeRequests ? this.fetchRequests(startDate, endDate, user) : Promise.resolve([]),
      includeLeaves ? this.fetchApprovedLeaves(startDate, endDate, user) : Promise.resolve([]),
      includeHolidays ? this.fetchHolidays(startDate, endDate) : Promise.resolve([]),
    ];

    const [tasks, requests, leaves, holidays] = await Promise.all(promises);

    const taskEvents: CalendarEventDTO[] = tasks.map((t) => ({
      id: `task-${t.id}`,
      rawId: t.id,
      title: t.title,
      type: "TASK",
      start: t.dueDate.toISOString(),
      end: t.dueDate.toISOString(),
      allDay: false,
      colorKey: "tasks",
      details: {
        status: t.status,
        priority: t.priority,
        assigneeName: t.assignee?.name ?? null,
        assigneeId: t.assigneeId,
        link: `/tasks`,
      },
    }));

    const requestEvents: CalendarEventDTO[] = requests.map((r) => ({
      id: `request-${r.id}`,
      rawId: r.id,
      title: r.title,
      type: "REQUEST",
      start: r.dueDate.toISOString(),
      end: r.dueDate.toISOString(),
      allDay: false,
      colorKey: "requests",
      details: {
        status: r.status,
        priority: r.priority,
        category: r.category,
        requesterName: r.requester?.name ?? null,
        requesterId: r.requesterId,
        amount: r.amount ? Number(r.amount) : null,
        link: `/requests/${r.id}`,
      },
    }));

    const leaveEvents: CalendarEventDTO[] = leaves.map((l) => ({
      id: `leave-${l.id}`,
      rawId: l.id,
      title: `${l.user.name} - ${l.type} Leave (${l.daysCount}d)`,
      type: "LEAVE",
      start: l.startDate.toISOString(),
      end: l.endDate.toISOString(),
      allDay: true,
      colorKey: "leaves",
      details: {
        userName: l.user.name,
        userId: l.userId,
        leaveType: l.type,
        daysCount: l.daysCount,
        reason: l.reason,
        status: l.status,
        departmentName: l.user.department?.name ?? null,
        link: user.role === Role.ADMIN || user.role === Role.MANAGER ? "/approvals" : "/dashboard",
      },
    }));

    const holidayEvents: CalendarEventDTO[] = holidays.map((h) => ({
      id: `holiday-${h.id}`,
      rawId: h.id,
      title: h.name,
      type: "HOLIDAY",
      start: h.date.toISOString(),
      end: h.date.toISOString(),
      allDay: true,
      colorKey: "holidays",
      details: {
        status: "COMPANY_HOLIDAY",
        link: "/calendar",
      },
    }));

    const allEvents = [...taskEvents, ...requestEvents, ...leaveEvents, ...holidayEvents].sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
    );

    return {
      events: allEvents,
      range: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    };
  }

  /**
   * Fetches role-scoped tasks having due dates in range.
   */
  private async fetchTasks(startDate: Date, endDate: Date, user: AuthenticatedUser) {
    let visibilityFilter: Prisma.TaskWhereInput = {};

    if (user.role === Role.ADMIN) {
      visibilityFilter = {};
    } else if (user.role === Role.MANAGER) {
      if (user.departmentId) {
        visibilityFilter = {
          OR: [
            { assigneeId: user.id },
            { assignedById: user.id },
            { assignee: { departmentId: user.departmentId } },
            { request: { requester: { departmentId: user.departmentId } } },
          ],
        };
      } else {
        visibilityFilter = {
          OR: [{ assigneeId: user.id }, { assignedById: user.id }],
        };
      }
    } else {
      // Role.EMPLOYEE
      visibilityFilter = {
        OR: [{ assigneeId: user.id }, { request: { requesterId: user.id } }],
      };
    }

    return prisma.task.findMany({
      where: {
        dueDate: {
          gte: startDate,
          lte: endDate,
        },
        ...visibilityFilter,
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, departmentId: true },
        },
      },
      orderBy: { dueDate: "asc" },
    });
  }

  /**
   * Fetches role-scoped requests having target/due dates in range.
   */
  private async fetchRequests(startDate: Date, endDate: Date, user: AuthenticatedUser) {
    let visibilityFilter: Prisma.WorkRequestWhereInput = {};

    if (user.role === Role.ADMIN) {
      visibilityFilter = {};
    } else if (user.role === Role.MANAGER) {
      if (user.departmentId) {
        visibilityFilter = {
          OR: [
            { requesterId: user.id },
            { requester: { departmentId: user.departmentId } },
          ],
        };
      } else {
        visibilityFilter = { requesterId: user.id };
      }
    } else {
      // Role.EMPLOYEE
      visibilityFilter = { requesterId: user.id };
    }

    return prisma.workRequest.findMany({
      where: {
        dueDate: {
          gte: startDate,
          lte: endDate,
        },
        ...visibilityFilter,
      },
      include: {
        requester: {
          select: { id: true, name: true, email: true, departmentId: true },
        },
      },
      orderBy: { dueDate: "asc" },
    });
  }

  /**
   * Fetches role-scoped approved leaves overlapping the range.
   * Employees see their own leaves; Managers see their team's leaves; Admins see all.
   */
  private async fetchApprovedLeaves(startDate: Date, endDate: Date, user: AuthenticatedUser) {
    let userFilter: Prisma.LeaveRequestWhereInput = {};

    if (user.role === Role.ADMIN) {
      userFilter = {};
    } else if (user.role === Role.MANAGER) {
      // Team's leaves: self + direct reports + department members
      userFilter = {
        OR: [
          { userId: user.id },
          { user: { managerId: user.id } },
          ...(user.departmentId ? [{ user: { departmentId: user.departmentId } }] : []),
        ],
      };
    } else {
      // Role.EMPLOYEE: only own approved leaves
      userFilter = {
        userId: user.id,
      };
    }

    return prisma.leaveRequest.findMany({
      where: {
        status: LeaveStatus.APPROVED,
        startDate: { lte: endDate },
        endDate: { gte: startDate },
        ...userFilter,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            managerId: true,
            departmentId: true,
            department: { select: { id: true, name: true } },
          },
        },
        approver: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { startDate: "asc" },
    });
  }

  /**
   * Fetches company holidays in range. All authenticated users see company holidays.
   */
  private async fetchHolidays(startDate: Date, endDate: Date) {
    return prisma.holiday.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { date: "asc" },
    });
  }
}

export const calendarService = new CalendarService();
