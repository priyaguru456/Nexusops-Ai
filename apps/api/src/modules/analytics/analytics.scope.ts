import { Prisma, Role } from "@prisma/client";
import { isAdminRole, isSuperAdmin } from "../../lib/tenant";
import { AuthenticatedUser } from "../../types/express";

function tenantSql(user: AuthenticatedUser, tableAlias: string): Prisma.Sql | null {
  if (user.organizationId === undefined) {
    return null;
  }
  if (user.organizationId === null) {
    return isSuperAdmin(user) ? null : Prisma.sql`1=0`;
  }
  return Prisma.sql`${Prisma.raw(tableAlias)}."organizationId" = ${user.organizationId}`;
}

function combineSql(tenantCond: Prisma.Sql | null, roleCond: Prisma.Sql | null): Prisma.Sql {
  if (tenantCond && roleCond) {
    return Prisma.sql`(${tenantCond} AND ${roleCond})`;
  }
  if (tenantCond) {
    return tenantCond;
  }
  if (roleCond) {
    return roleCond;
  }
  return Prisma.sql`1=1`;
}

/**
 * Explicit scope definitions for analytics queries.
 * Every query MUST apply these scopes inside the SQL WHERE clause, never in JS.
 *
 * Scopes:
 * - EMPLOYEE:
 *     - WorkRequest: requesterId = user.id (within user's organization)
 *     - Task: assigneeId = user.id (within user's organization)
 *     - ChatSession: userId = user.id (within user's organization)
 * - MANAGER:
 *     - WorkRequest: requester belongs to the same department & organization as manager
 *     - Task: assignee or creator belongs to the same department & organization as manager
 *     - ChatSession: not applicable (403 on /ai-usage)
 * - ADMIN / SUPER_ADMIN:
 *     - Company-wide within organization (or platform-wide for unscoped SUPER_ADMIN)
 */
export const analyticsScope = {
  /**
   * Generates SQL WHERE condition for WorkRequest table.
   * @param user Authenticated user
   * @param tableAlias Table alias in SQL query (e.g. 'wr')
   */
  forRequests(user: AuthenticatedUser, tableAlias = "wr"): Prisma.Sql {
    const tCond = tenantSql(user, tableAlias);

    if (isAdminRole(user)) {
      return combineSql(tCond, null);
    }

    if (user.role === Role.MANAGER) {
      const roleCond = user.departmentId
        ? Prisma.sql`EXISTS (
          SELECT 1 FROM "User" u
          WHERE u.id = ${Prisma.raw(tableAlias)}."requesterId"
            AND u."departmentId" = ${user.departmentId}
        )`
        : Prisma.sql`${Prisma.raw(tableAlias)}."requesterId" = ${user.id}`;
      return combineSql(tCond, roleCond);
    }

    // EMPLOYEE: only own requests
    return combineSql(tCond, Prisma.sql`${Prisma.raw(tableAlias)}."requesterId" = ${user.id}`);
  },

  /**
   * Generates SQL WHERE condition for Task table.
   * @param user Authenticated user
   * @param tableAlias Table alias in SQL query (e.g. 't')
   */
  forTasks(user: AuthenticatedUser, tableAlias = "t"): Prisma.Sql {
    const tCond = tenantSql(user, tableAlias);

    if (isAdminRole(user)) {
      return combineSql(tCond, null);
    }

    if (user.role === Role.MANAGER) {
      const roleCond = user.departmentId
        ? Prisma.sql`EXISTS (
          SELECT 1 FROM "User" u
          WHERE (u.id = ${Prisma.raw(tableAlias)}."assigneeId" OR u.id = ${Prisma.raw(tableAlias)}."assignedById")
            AND u."departmentId" = ${user.departmentId}
        )`
        : Prisma.sql`${Prisma.raw(tableAlias)}."assigneeId" = ${user.id}`;
      return combineSql(tCond, roleCond);
    }

    // EMPLOYEE: only tasks assigned to employee
    return combineSql(tCond, Prisma.sql`${Prisma.raw(tableAlias)}."assigneeId" = ${user.id}`);
  },

  /**
   * Generates SQL WHERE condition for ApprovalStep / approvals.
   * @param user Authenticated user
   * @param tableAlias Table alias for ApprovalStep (e.g. 'ast')
   */
  forApprovals(user: AuthenticatedUser, tableAlias = "ast"): Prisma.Sql {
    const tCond = tenantSql(user, tableAlias);

    if (isAdminRole(user)) {
      return combineSql(tCond, null);
    }

    if (user.role === Role.MANAGER) {
      const roleCond = user.departmentId
        ? Prisma.sql`EXISTS (
          SELECT 1 FROM "WorkRequest" wr
          JOIN "User" u ON u.id = wr."requesterId"
          WHERE wr.id = ${Prisma.raw(tableAlias)}."requestId"
            AND u."departmentId" = ${user.departmentId}
        )`
        : Prisma.sql`${Prisma.raw(tableAlias)}."approverId" = ${user.id}`;
      return combineSql(tCond, roleCond);
    }

    // EMPLOYEE: only approvals for requests made by the employee
    return combineSql(
      tCond,
      Prisma.sql`EXISTS (
        SELECT 1 FROM "WorkRequest" wr
        WHERE wr.id = ${Prisma.raw(tableAlias)}."requestId"
          AND wr."requesterId" = ${user.id}
      )`
    );
  },

  /**
   * Generates SQL WHERE condition for ChatSession table.
   * @param user Authenticated user
   * @param sessionAlias Table alias for ChatSession (e.g. 'cs')
   */
  forChatSessions(user: AuthenticatedUser, sessionAlias = "cs"): Prisma.Sql {
    const tCond = tenantSql(user, sessionAlias);

    if (isAdminRole(user)) {
      return combineSql(tCond, null);
    }

    // EMPLOYEE: only own sessions
    return combineSql(tCond, Prisma.sql`${Prisma.raw(sessionAlias)}."userId" = ${user.id}`);
  },
};
