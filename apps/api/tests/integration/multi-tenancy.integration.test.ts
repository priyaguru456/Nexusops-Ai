import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { Role, DocVisibility, DocStatus, Priority, RequestCategory } from "@prisma/client";
import { app } from "../../src/app";
import { prisma } from "../../src/lib/prisma";
import {
  createOrganization,
  createDepartment,
  createUser,
  createRequest,
  createDocument,
} from "../helpers/factories";

describe("Integration: Multi-Tenancy & SUPER_ADMIN Isolation (Real Test DB)", () => {
  let orgA: { id: string; slug: string };
  let orgB: { id: string; slug: string };
  let superToken: string;
  let adminAToken: string;
  let adminBToken: string;
  let empA: { id: string; organizationId: string | null };
  let empB: { id: string; organizationId: string | null };
  let empAToken: string;
  let empBToken: string;

  beforeEach(async () => {
    orgA = await createOrganization({ name: "Tenant Alpha", slug: `alpha-${Date.now()}` });
    orgB = await createOrganization({ name: "Tenant Beta", slug: `beta-${Date.now()}` });

    const deptA = await createDepartment("Engineering", orgA.id);
    const deptB = await createDepartment("Engineering", orgB.id); // Same name in Org B succeeds via composite unique

    const sup = await createUser({
      role: Role.SUPER_ADMIN,
      organizationId: null,
      departmentId: null,
    });
    superToken = sup.token;

    const admA = await createUser({
      role: Role.ADMIN,
      organizationId: orgA.id,
      departmentId: deptA.id,
    });
    adminAToken = admA.token;

    const admB = await createUser({
      role: Role.ADMIN,
      organizationId: orgB.id,
      departmentId: deptB.id,
    });
    adminBToken = admB.token;

    const uA = await createUser({
      role: Role.EMPLOYEE,
      organizationId: orgA.id,
      departmentId: deptA.id,
    });
    empA = uA.user;
    empAToken = uA.token;

    const uB = await createUser({
      role: Role.EMPLOYEE,
      organizationId: orgB.id,
      departmentId: deptB.id,
    });
    empB = uB.user;
    empBToken = uB.token;
  });

  it("isolates WorkRequests and Tasks across organizations", async () => {
    const reqA = await createRequest(empA, {
      title: "Alpha Secret Hardware Request",
      category: RequestCategory.IT,
      priority: Priority.HIGH,
      organizationId: orgA.id,
    });

    const taskA = await prisma.task.create({
      data: {
        organizationId: orgA.id,
        title: "Alpha Confidential Task",
        assignedById: empA.id,
        assigneeId: empA.id,
      },
    });

    // Org B Admin must NOT see Org A's request or task in lists
    const listReqB = await request(app)
      .get("/api/requests")
      .set("Authorization", `Bearer ${adminBToken}`);
    expect(listReqB.status).toBe(200);
    expect(listReqB.body.items.some((r: { id: string }) => r.id === reqA.id)).toBe(false);

    // Direct ID fetch by Org B Admin must be blocked (403/404)
    const getReqB = await request(app)
      .get(`/api/requests/${reqA.id}`)
      .set("Authorization", `Bearer ${adminBToken}`);
    expect([403, 404]).toContain(getReqB.status);

    const listTaskB = await request(app)
      .get("/api/tasks")
      .set("Authorization", `Bearer ${adminBToken}`);
    expect(listTaskB.status).toBe(200);
    expect(listTaskB.body.items.some((t: { id: string }) => t.id === taskA.id)).toBe(false);

    // SUPER_ADMIN can inspect across organizations
    const getReqSuper = await request(app)
      .get(`/api/requests/${reqA.id}`)
      .set("Authorization", `Bearer ${superToken}`);
    expect(getReqSuper.status).toBe(200);
  });

  it("isolates Knowledge Base documents even when DocVisibility is ALL", async () => {
    const docA = await createDocument(empA, {
      title: "Alpha Handbook ALL Visibility",
      visibility: DocVisibility.ALL,
      status: DocStatus.READY,
      organizationId: orgA.id,
    });

    const listDocsB = await request(app)
      .get("/api/documents")
      .set("Authorization", `Bearer ${empBToken}`);
    expect(listDocsB.status).toBe(200);
    expect(listDocsB.body.documents.some((d: { id: string }) => d.id === docA.id)).toBe(false);

    const getDocB = await request(app)
      .get(`/api/documents/${docA.id}`)
      .set("Authorization", `Bearer ${adminBToken}`);
    expect([403, 404]).toContain(getDocB.status);

    const listDocsA = await request(app)
      .get("/api/documents")
      .set("Authorization", `Bearer ${empAToken}`);
    expect(listDocsA.status).toBe(200);
    expect(listDocsA.body.documents.some((d: { id: string }) => d.id === docA.id)).toBe(true);
  });

  it("restricts /api/organizations exclusively to SUPER_ADMIN and immediately blocks suspended tenants", async () => {
    // Tenant Admin cannot access /api/organizations
    const forbiddenList = await request(app)
      .get("/api/organizations")
      .set("Authorization", `Bearer ${adminAToken}`);
    expect(forbiddenList.status).toBe(403);

    // SUPER_ADMIN can list organizations
    const superList = await request(app)
      .get("/api/organizations")
      .set("Authorization", `Bearer ${superToken}`);
    expect(superList.status).toBe(200);
    expect(superList.body.items.length).toBeGreaterThanOrEqual(2);

    // SUPER_ADMIN suspends Org B
    const suspendRes = await request(app)
      .patch(`/api/organizations/${orgB.id}`)
      .set("Authorization", `Bearer ${superToken}`)
      .send({ isActive: false });
    expect(suspendRes.status).toBe(200);
    expect(suspendRes.body.organization.isActive).toBe(false);

    // Org B employee is immediately rejected with 403
    const blockedMe = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${empBToken}`);
    expect(blockedMe.status).toBe(403);
    expect(blockedMe.body.error).toMatch(/suspended or inactive/i);
  });
});
