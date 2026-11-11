import { describe, it, expect } from "vitest";
import request from "supertest";
import {
  Role,
  RequestStatus,
  ApprovalStatus,
  Priority,
  RequestCategory,
} from "@prisma/client";
import { app } from "../../src/app";
import { prisma } from "../../src/lib/prisma";
import {
  createUser,
  createDepartment,
  createRequest,
} from "../helpers/factories";

describe("Integration: Approvals Workflow (Real Test DB)", () => {
  it("happy path: 2-step approval completes and transitions request to APPROVED", async () => {
    const dept = await createDepartment("Finance");
    const { user: emp, token: empToken } = await createUser({
      role: Role.EMPLOYEE,
      departmentId: dept.id,
    });
    const { user: mgr, token: mgrToken } = await createUser({
      role: Role.MANAGER,
      departmentId: dept.id,
    });
    const { user: admin, token: adminToken } = await createUser({
      role: Role.ADMIN,
    });

    const workReq = await createRequest(emp, {
      category: RequestCategory.FINANCE,
      priority: Priority.HIGH,
      status: RequestStatus.SUBMITTED,
      departmentId: dept.id,
    });

    // Create 2-step approval sequence for this request
    const step1 = await prisma.approvalStep.create({
      data: {
        organizationId: emp.organizationId!,
        entityId: workReq.id,
        requestId: workReq.id,
        stepOrder: 1,
        approverRole: Role.MANAGER,
        status: ApprovalStatus.PENDING,
        activatedAt: new Date(),
      },
    });

    const step2 = await prisma.approvalStep.create({
      data: {
        organizationId: emp.organizationId!,
        entityId: workReq.id,
        requestId: workReq.id,
        stepOrder: 2,
        approverRole: Role.ADMIN,
        status: ApprovalStatus.PENDING,
      },
    });

    // 1. Manager approves Step 1
    const res1 = await request(app)
      .post(`/api/approvals/${step1.id}/approve`)
      .set("Authorization", `Bearer ${mgrToken}`)
      .send({ comment: "Manager initial approval" });

    expect(res1.status).toBe(200);
    expect(res1.body.step.status).toBe(ApprovalStatus.APPROVED);

    // 2. Admin approves Step 2
    const res2 = await request(app)
      .post(`/api/approvals/${step2.id}/approve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ comment: "Admin final approval" });

    expect(res2.status).toBe(200);
    expect(res2.body.step.status).toBe(ApprovalStatus.APPROVED);
    expect(res2.body.request.status).toBe(RequestStatus.APPROVED);

    // Verify in database that workRequest is now APPROVED and task was auto-created
    const updatedReq = await prisma.workRequest.findUnique({
      where: { id: workReq.id },
    });
    expect(updatedReq?.status).toBe(RequestStatus.APPROVED);

    const autoTask = await prisma.task.findFirst({
      where: { requestId: workReq.id },
    });
    expect(autoTask).not.toBeNull();
  });

  it("rejection requires a non-empty comment and terminates the approval chain", async () => {
    const dept = await createDepartment("Finance");
    const { user: emp } = await createUser({ role: Role.EMPLOYEE, departmentId: dept.id });
    const { user: mgr, token: mgrToken } = await createUser({
      role: Role.MANAGER,
      departmentId: dept.id,
    });

    const workReq = await createRequest(emp, {
      status: RequestStatus.SUBMITTED,
      departmentId: dept.id,
    });

    const step1 = await prisma.approvalStep.create({
      data: {
        organizationId: emp.organizationId!,
        entityId: workReq.id,
        requestId: workReq.id,
        stepOrder: 1,
        approverRole: Role.MANAGER,
        status: ApprovalStatus.PENDING,
        activatedAt: new Date(),
      },
    });

    const step2 = await prisma.approvalStep.create({
      data: {
        organizationId: emp.organizationId!,
        entityId: workReq.id,
        requestId: workReq.id,
        stepOrder: 2,
        approverRole: Role.ADMIN,
        status: ApprovalStatus.PENDING,
      },
    });

    // Rejecting without a comment must return 400 Bad Request
    const noCommentRes = await request(app)
      .post(`/api/approvals/${step1.id}/reject`)
      .set("Authorization", `Bearer ${mgrToken}`)
      .send({ comment: "   " });

    expect(noCommentRes.status).toBe(400);

    // Rejecting with a valid comment terminates the chain
    const rejectRes = await request(app)
      .post(`/api/approvals/${step1.id}/reject`)
      .set("Authorization", `Bearer ${mgrToken}`)
      .send({ comment: "Budget exceeded quarterly threshold" });

    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.step.status).toBe(ApprovalStatus.REJECTED);
    expect(rejectRes.body.request.status).toBe(RequestStatus.REJECTED);

    // Subsequent steps must be SKIPPED
    const dbStep2 = await prisma.approvalStep.findUnique({ where: { id: step2.id } });
    expect(dbStep2?.status).toBe(ApprovalStatus.SKIPPED);
  });

  it("self-approval is blocked: requester cannot approve their own request even if they hold the manager role", async () => {
    const dept = await createDepartment("Sales");
    // User is a MANAGER who submits their own request
    const { user: requesterMgr, token: requesterToken } = await createUser({
      role: Role.MANAGER,
      departmentId: dept.id,
    });

    const workReq = await createRequest(requesterMgr, {
      status: RequestStatus.SUBMITTED,
      departmentId: dept.id,
    });

    const step = await prisma.approvalStep.create({
      data: {
        organizationId: requesterMgr.organizationId!,
        entityId: workReq.id,
        requestId: workReq.id,
        stepOrder: 1,
        approverRole: Role.MANAGER,
        status: ApprovalStatus.PENDING,
        activatedAt: new Date(),
      },
    });

    const res = await request(app)
      .post(`/api/approvals/${step.id}/approve`)
      .set("Authorization", `Bearer ${requesterToken}`)
      .send({ comment: "Self-approving my own request" });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Requesters cannot approve their own requests/i);
  });

  it("out-of-order approval is blocked when preceding steps are still PENDING", async () => {
    const dept = await createDepartment("Legal");
    const { user: emp } = await createUser({ role: Role.EMPLOYEE, departmentId: dept.id });
    const { token: adminToken } = await createUser({ role: Role.ADMIN });

    const workReq = await createRequest(emp, {
      status: RequestStatus.SUBMITTED,
      departmentId: dept.id,
    });

    await prisma.approvalStep.create({
      data: {
        organizationId: emp.organizationId!,
        entityId: workReq.id,
        requestId: workReq.id,
        stepOrder: 1,
        approverRole: Role.MANAGER,
        status: ApprovalStatus.PENDING,
        activatedAt: new Date(),
      },
    });

    const step2 = await prisma.approvalStep.create({
      data: {
        organizationId: emp.organizationId!,
        entityId: workReq.id,
        requestId: workReq.id,
        stepOrder: 2,
        approverRole: Role.ADMIN,
        status: ApprovalStatus.PENDING,
      },
    });

    // Try approving Step 2 before Step 1 is decided
    const res = await request(app)
      .post(`/api/approvals/${step2.id}/approve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ comment: "Skipping step 1" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/preceding approval steps must be approved/i);
  });

  it("concurrent double-approve of the same step results in exactly ONE success and one 409 Conflict", async () => {
    const dept = await createDepartment("Ops");
    const { user: emp } = await createUser({ role: Role.EMPLOYEE, departmentId: dept.id });
    const { token: admin1Token } = await createUser({ role: Role.ADMIN });
    const { token: admin2Token } = await createUser({ role: Role.ADMIN });

    const workReq = await createRequest(emp, {
      status: RequestStatus.SUBMITTED,
      departmentId: dept.id,
    });

    const step = await prisma.approvalStep.create({
      data: {
        organizationId: emp.organizationId!,
        entityId: workReq.id,
        requestId: workReq.id,
        stepOrder: 1,
        approverRole: Role.ADMIN,
        status: ApprovalStatus.PENDING,
        activatedAt: new Date(),
      },
    });

    // Launch two approve calls concurrently via Promise.all
    const [resA, resB] = await Promise.all([
      request(app)
        .post(`/api/approvals/${step.id}/approve`)
        .set("Authorization", `Bearer ${admin1Token}`)
        .send({ comment: "Approval from Admin 1" }),
      request(app)
        .post(`/api/approvals/${step.id}/approve`)
        .set("Authorization", `Bearer ${admin2Token}`)
        .send({ comment: "Approval from Admin 2" }),
    ]);

    const statuses = [resA.status, resB.status];
    // Exactly one must be 200 and the other must be 409 Conflict (or 400/409)
    const successCount = statuses.filter((s) => s === 200).length;
    const conflictCount = statuses.filter((s) => s === 409).length;

    expect(successCount).toBe(1);
    expect(conflictCount).toBe(1);
  });
});
