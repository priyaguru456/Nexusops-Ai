import { describe, it, expect } from "vitest";
import request from "supertest";
import { Role, LeaveType, LeaveStatus } from "@prisma/client";
import { app } from "../../src/app";
import { createUser, createDepartment } from "../helpers/factories";
import { prisma } from "../../src/lib/prisma";

describe("Integration: Leave Management APIs & Role Permissions (Real Test DB)", () => {
  it("executes the full lifecycle: apply -> manager approve -> balance deducted", async () => {
    const dept = await createDepartment("Engineering Leaves");
    const { user: mgr, token: mgrToken } = await createUser({
      role: Role.MANAGER,
      departmentId: dept.id,
    });
    const { user: emp, token: empToken } = await createUser({
      role: Role.EMPLOYEE,
      departmentId: dept.id,
      managerId: mgr.id,
    });

    // 1. Initial balance check
    const balanceRes = await request(app)
      .get("/api/leaves/balance")
      .set("Authorization", `Bearer ${empToken}`);

    expect(balanceRes.status).toBe(200);
    expect(balanceRes.body.balance.usedCasual).toBe(0);
    expect(balanceRes.body.balance.remainingCasual).toBe(12);

    // 2. Submit Leave Request for Monday Nov 9 to Tuesday Nov 10, 2026 (2 working days)
    const applyRes = await request(app)
      .post("/api/leaves")
      .set("Authorization", `Bearer ${empToken}`)
      .send({
        type: LeaveType.CASUAL,
        startDate: "2026-11-09",
        endDate: "2026-11-10",
        reason: "Personal family event",
      });

    expect(applyRes.status).toBe(201);
    expect(applyRes.body.leave.status).toBe(LeaveStatus.PENDING);
    expect(applyRes.body.leave.daysCount).toBe(2);
    const leaveId = applyRes.body.leave.id;

    // 3. Manager approves leave request
    const approveRes = await request(app)
      .post(`/api/leaves/${leaveId}/approve`)
      .set("Authorization", `Bearer ${mgrToken}`)
      .send({ comment: "Approved by manager" });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.leave.status).toBe(LeaveStatus.APPROVED);
    expect(approveRes.body.leave.approverId).toBe(mgr.id);

    // 4. Verify balance is deducted: usedCasual should now be 2, remainingCasual should be 10
    const balanceAfterApprove = await request(app)
      .get("/api/leaves/balance")
      .set("Authorization", `Bearer ${empToken}`);

    expect(balanceAfterApprove.status).toBe(200);
    expect(balanceAfterApprove.body.balance.usedCasual).toBe(2);
    expect(balanceAfterApprove.body.balance.remainingCasual).toBe(10);

    // 5. Cancel approved leave -> balance should be restored!
    const cancelRes = await request(app)
      .post(`/api/leaves/${leaveId}/cancel`)
      .set("Authorization", `Bearer ${empToken}`)
      .send({ reason: "Event rescheduled" });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.leave.status).toBe(LeaveStatus.CANCELLED);

    // 6. Verify restored balance: usedCasual back to 0, remainingCasual back to 12
    const balanceAfterCancel = await request(app)
      .get("/api/leaves/balance")
      .set("Authorization", `Bearer ${empToken}`);

    expect(balanceAfterCancel.status).toBe(200);
    expect(balanceAfterCancel.body.balance.usedCasual).toBe(0);
    expect(balanceAfterCancel.body.balance.remainingCasual).toBe(12);
  });

  it("enforces RBAC permissions and rejects unauthorized actions", async () => {
    const deptA = await createDepartment("Dept A");
    const deptB = await createDepartment("Dept B");

    const { user: mgrA, token: mgrAToken } = await createUser({
      role: Role.MANAGER,
      departmentId: deptA.id,
    });
    const { user: empA, token: empAToken } = await createUser({
      role: Role.EMPLOYEE,
      departmentId: deptA.id,
      managerId: mgrA.id,
    });
    const { user: empB, token: empBToken } = await createUser({
      role: Role.EMPLOYEE,
      departmentId: deptB.id,
    });

    // 1. Employee A applies for leave
    const applyRes = await request(app)
      .post("/api/leaves")
      .set("Authorization", `Bearer ${empAToken}`)
      .send({
        type: LeaveType.SICK,
        startDate: "2026-11-16",
        endDate: "2026-11-17",
        reason: "Flu symptoms",
      });
    expect(applyRes.status).toBe(201);
    const leaveId = applyRes.body.leave.id;

    // 2. Unauthenticated request rejected with 401
    const unauthRes = await request(app).get("/api/leaves");
    expect(unauthRes.status).toBe(401);

    // 3. Employee A cannot approve their own leave (403 Forbidden)
    const selfApproveRes = await request(app)
      .post(`/api/leaves/${leaveId}/approve`)
      .set("Authorization", `Bearer ${empAToken}`);
    expect(selfApproveRes.status).toBe(403);

    // 4. Employee B cannot approve Employee A's leave (403 Forbidden)
    const otherEmpApprove = await request(app)
      .post(`/api/leaves/${leaveId}/approve`)
      .set("Authorization", `Bearer ${empBToken}`);
    expect(otherEmpApprove.status).toBe(403);

    // 5. Employee B cannot view Employee A's leave details (403 Forbidden)
    const otherEmpView = await request(app)
      .get(`/api/leaves/${leaveId}`)
      .set("Authorization", `Bearer ${empBToken}`);
    expect(otherEmpView.status).toBe(403);

    // 6. Employee B cannot query Employee A's leaves list (403 Forbidden)
    const otherEmpList = await request(app)
      .get(`/api/leaves?userId=${empA.id}`)
      .set("Authorization", `Bearer ${empBToken}`);
    expect(otherEmpList.status).toBe(403);

    // 7. Employee B cannot register company holidays (Admin only, 403 Forbidden)
    const addHolidayForbidden = await request(app)
      .post("/api/leaves/holidays")
      .set("Authorization", `Bearer ${empBToken}`)
      .send({ name: "Unauthorized Holiday", date: "2026-12-31" });
    expect(addHolidayForbidden.status).toBe(403);
  });
});
