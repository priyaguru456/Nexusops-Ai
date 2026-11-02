import { Prisma, Role } from "@prisma/client";
import { AuthenticatedUser } from "../../types/express";

/**
 * Explicit scope definitions for analytics queries.
 * Every query MUST apply these scopes inside the SQL WHERE clause, never in JS.
 *
 * Scopes:
 * - EMPLOYEE:
 *     - WorkRequest: requesterId = user.id
 *     - Task: assigneeId = user.id
 *     - ChatSession: userId = user.id
 * - MANAGER:
 *     - WorkRequest: requester belongs to the same department as manager
 *     - Task: assignee or creator belongs to the same department as manager
 *     - ChatSession: not applicable (403 on /ai-usage)
 * - ADMIN:
 *     - Company-wide: all requests, all tasks, all chat sessions
 */
export const analyticsScope = {
  /**
   * Generates SQL WHERE condition for WorkRequest table.
   * @param user Authenticated user
   * @param tableAlias Table alias in SQL query (e.g. 'wr')
   */
  forRequests(user: AuthenticatedUser, tableAlias = "wr"): Prisma.Sql {
    if (user.role === Role.ADMIN) {
      return Prisma.sql`1=1`;
    }

    if (user.role === Role.MANAGER) {
      if (user.departmentId) {
        return Prisma.sql`EXISTS (
          SELECT 1 FROM "User" u
          WHERE u.id = ${Prisma.raw(tableAlias)}."requesterId"
            AND u."departmentId" = ${user.departmentId}
        )`;
      }
      return Prisma.sql`${Prisma.raw(tableAlias)}."requesterId" = ${user.id}`;
    }

    // EMPLOYEE: only own requests
    return Prisma.sql`${Prisma.raw(tableAlias)}."requesterId" = ${user.id}`;
  },

  /**
   * Generates SQL WHERE condition for Task table.
   * @param user Authenticated user
   * @param tableAlias Table alias in SQL query (e.g. 't')
   */
  forTasks(user: AuthenticatedUser, tableAlias = "t"): Prisma.Sql {
    if (user.role === Role.ADMIN) {
      return Prisma.sql`1=1`;
    }

    if (user.role === Role.MANAGER) {
      if (user.departmentId) {
        return Prisma.sql`EXISTS (
          SELECT 1 FROM "User" u
          WHERE (u.id = ${Prisma.raw(tableAlias)}."assigneeId" OR u.id = ${Prisma.raw(tableAlias)}."assignedById")
            AND u."departmentId" = ${user.departmentId}
        )`;
      }
      return Prisma.sql`${Prisma.raw(tableAlias)}."assigneeId" = ${user.id}`;
    }

    // EMPLOYEE: only tasks assigned to employee
    return Prisma.sql`${Prisma.raw(tableAlias)}."assigneeId" = ${user.id}`;
  },

  /**
   * Generates SQL WHERE condition for ApprovalStep / approvals.
   * @param user Authenticated user
   * @param tableAlias Table alias for ApprovalStep (e.g. 'ast')
   */
  forApprovals(user: AuthenticatedUser, tableAlias = "ast"): Prisma.Sql {
    if (user.role === Role.ADMIN) {
      return Prisma.sql`1=1`;
    }

    if (user.role === Role.MANAGER) {
      if (user.departmentId) {
        return Prisma.sql`EXISTS (
          SELECT 1 FROM "WorkRequest" wr
          JOIN "User" u ON u.id = wr."requesterId"
          WHERE wr.id = ${Prisma.raw(tableAlias)}."requestId"
            AND u."departmentId" = ${user.departmentId}
        )`;
      }
      return Prisma.sql`${Prisma.raw(tableAlias)}."approverId" = ${user.id}`;
    }

    // EMPLOYEE: only approvals for requests made by the employee
    return Prisma.sql`EXISTS (
      SELECT 1 FROM "WorkRequest" wr
      WHERE wr.id = ${Prisma.raw(tableAlias)}."requestId"
        AND wr."requesterId" = ${user.id}
    )`;
  },

  /**
   * Generates SQL WHERE condition for ChatSession table.
   * @param user Authenticated user
   * @param sessionAlias Table alias for ChatSession (e.g. 'cs')
   */
  forChatSessions(user: AuthenticatedUser, sessionAlias = "cs"): Prisma.Sql {
    if (user.role === Role.ADMIN) {
      return Prisma.sql`1=1`;
    }

    // EMPLOYEE: only own sessions
    return Prisma.sql`${Prisma.raw(sessionAlias)}."userId" = ${user.id}`;
  },
};
