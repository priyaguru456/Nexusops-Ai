import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { Role, RequestStatus, RequestCategory, Priority, TaskStatus } from "@prisma/client";
import { app } from "../../src/app";
import { prisma } from "../../src/lib/prisma";
import { analyticsService } from "../../src/modules/analytics/analytics.service";
import {
  createUser,
  createDepartment,
  createRequest,
} from "../helpers/factories";

describe("Integration: Analytics Scoping & Exact Metric Counts (Real Test DB)", () => {
  let deptA: { id: string };
  let deptB: { id: string };

  let empA: { id: string; email: string; role: Role; departmentId: string | null };
  let mgrA: { id: string; email: string; role: Role; departmentId: string | null };
  let admin: { id: string; email: string; role: Role; departmentId: string | null };

  let tokenEmpA: string;
  let tokenMgrA: string;
  let tokenAdmin: string;

  beforeAll(async () => {
    deptA = await createDepartment("Engineering");
    deptB = await createDepartment("Marketing");

    const a = await createUser({ role: Role.EMPLOYEE, departmentId: deptA.id });
    empA = a.user;
    tokenEmpA = a.token;

    const m = await createUser({ role: Role.MANAGER, departmentId: deptA.id });
    mgrA = m.user;
    tokenMgrA = m.token;

    const adm = await createUser({ role: Role.ADMIN, departmentId: null });
    admin = adm.user;
    tokenAdmin = adm.token;

    // Dept A - Emp A creates 2 requests
    await createRequest(empA, {
      title: "Emp A Draft Request",
      status: RequestStatus.DRAFT,
      category: RequestCategory.IT,
      departmentId: deptA.id,
    });
    await createRequest(empA, {
      title: "Emp A Submitted Request",
      status: RequestStatus.SUBMITTED,
      category: RequestCategory.IT,
      departmentId: deptA.id,
    });

    // Dept A - Mgr A creates 1 completed request
    await createRequest(mgrA, {
      title: "Mgr A Completed Request",
      status: RequestStatus.COMPLETED,
      category: RequestCategory.FINANCE,
      departmentId: deptA.id,
    });

    // Dept B - Emp B creates 1 request
    const { user: empB } = await createUser({ role: Role.EMPLOYEE, departmentId: deptB.id });
    await createRequest(empB, {
      title: "Dept B Marketing Request",
      status: RequestStatus.SUBMITTED,
      category: RequestCategory.OTHER,
      departmentId: deptB.id,
    });
  });

  it("admin overview returns exact total system-wide counts across all departments", async () => {
    const from = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const to = new Date(Date.now() + 24 * 3600 * 1000);

    const overview = await analyticsService.getOverview(admin as any, from, to);

    // Total requests across both departments = 4
    expect(overview.totals.totalRequests).toBe(4);
    expect(overview.totals.draft).toBe(1);
    expect(overview.totals.open).toBe(2); // 2 submitted
    expect(overview.totals.completed).toBe(1);
  });

  it("manager overview is scoped to own department (Dept A only, excludes Dept B)", async () => {
    const from = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const to = new Date(Date.now() + 24 * 3600 * 1000);

    const overview = await analyticsService.getOverview(mgrA as any, from, to);

    // Total requests in Dept A = 3 (excludes Dept B's 1 request)
    expect(overview.totals.totalRequests).toBe(3);
    expect(overview.totals.completed).toBe(1);
    expect(overview.totals.open).toBe(1);
  });

  it("employee overview is strictly scoped to own created requests", async () => {
    const from = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const to = new Date(Date.now() + 24 * 3600 * 1000);

    const overview = await analyticsService.getOverview(empA as any, from, to);

    // Emp A created 2 requests
    expect(overview.totals.totalRequests).toBe(2);
    expect(overview.totals.draft).toBe(1);
    expect(overview.totals.open).toBe(1);
    expect(overview.totals.completed).toBe(0);
  });
});
