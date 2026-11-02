import { prisma } from "../../lib/prisma";
import { analyticsScope } from "../analytics/analytics.scope";
import type { AuthenticatedUser } from "../../types/express";

export interface SearchRequestResult {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  createdAt: string;
  requesterName: string;
}

export interface SearchTaskResult {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  createdAt: string;
  assigneeName: string;
  requestId: string | null;
}

export interface GlobalSearchResult {
  query: string;
  requests: SearchRequestResult[];
  tasks: SearchTaskResult[];
  totalMatches: number;
}

export class SearchService {
  /**
   * Searches across Work Requests and Tasks with role visibility scoping
   * applied strictly inside SQL WHERE clauses.
   *
   * Escapes LIKE wildcards (% and _) to avoid arbitrary wildcard injections.
   * Maximum 8 results per type.
   */
  async search(user: AuthenticatedUser, rawQuery: string): Promise<GlobalSearchResult> {
    const trimmed = rawQuery.trim();
    // Escape LIKE wildcards %, _, and backslash escape itself
    const escapedQuery = trimmed.replace(/[%_\\]/g, "\\$&");
    const pattern = `%${escapedQuery}%`;

    const wrScope = analyticsScope.forRequests(user, "wr");
    const tScope = analyticsScope.forTasks(user, "t");

    // 1. Search Work Requests
    const requests: any[] = await prisma.$queryRaw`
      SELECT
        wr.id,
        wr.title,
        wr.description,
        wr.status::text AS "status",
        wr.priority::text AS "priority",
        wr.category::text AS "category",
        to_char(wr."createdAt", 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "createdAt",
        u.name AS "requesterName"
      FROM "WorkRequest" wr
      JOIN "User" u ON u.id = wr."requesterId"
      WHERE (wr.title ILIKE ${pattern} ESCAPE '\' OR wr.description ILIKE ${pattern} ESCAPE '\')
        AND ${wrScope}
      ORDER BY wr."createdAt" DESC
      LIMIT 8;
    `;

    // 2. Search Tasks
    const tasks: any[] = await prisma.$queryRaw`
      SELECT
        t.id,
        t.title,
        t.description,
        t.status::text AS "status",
        t.priority::text AS "priority",
        to_char(t."dueDate", 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "dueDate",
        to_char(t."createdAt", 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "createdAt",
        COALESCE(u.name, 'Unassigned') AS "assigneeName",
        t."requestId"
      FROM "Task" t
      LEFT JOIN "User" u ON u.id = t."assigneeId"
      WHERE (t.title ILIKE ${pattern} ESCAPE '\' OR (t.description IS NOT NULL AND t.description ILIKE ${pattern} ESCAPE '\'))
        AND ${tScope}
      ORDER BY t."createdAt" DESC
      LIMIT 8;
    `;

    const formattedRequests: SearchRequestResult[] = requests.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      status: r.status,
      priority: r.priority,
      category: r.category,
      createdAt: r.createdAt,
      requesterName: r.requesterName,
    }));

    const formattedTasks: SearchTaskResult[] = tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      createdAt: t.createdAt,
      assigneeName: t.assigneeName,
      requestId: t.requestId,
    }));

    return {
      query: trimmed,
      requests: formattedRequests,
      tasks: formattedTasks,
      totalMatches: formattedRequests.length + formattedTasks.length,
    };
  }
}

export const searchService = new SearchService();
