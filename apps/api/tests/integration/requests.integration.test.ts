import { describe, it, expect } from "vitest";
import request from "supertest";
import { Role, RequestStatus, RequestCategory, Priority } from "@prisma/client";
import { app } from "../../src/app";
import { createUser, createRequest, createDepartment } from "../helpers/factories";

describe("Integration: Work Requests Lifecycle & State Machine (Real Test DB)", () => {
  it("executes the full legitimate lifecycle: DRAFT -> SUBMITTED -> IN_REVIEW -> APPROVED -> IN_PROGRESS -> COMPLETED", async () => {
    const dept = await createDepartment("Engineering");
    const { user: emp, token: empToken } = await createUser({
      role: Role.EMPLOYEE,
      departmentId: dept.id,
    });
    const { user: mgr, token: mgrToken } = await createUser({
      role: Role.MANAGER,
      departmentId: dept.id,
    });

    // 1. Employee creates a DRAFT request
    const createRes = await request(app)
      .post("/api/requests")
      .set("Authorization", `Bearer ${empToken}`)
      .send({
        title: "Upgrade developer laptop",
        description: "Need 64GB RAM for local model testing",
        category: RequestCategory.IT,
        priority: Priority.HIGH,
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.status).toBe(RequestStatus.DRAFT);
    const reqId = createRes.body.id;

    // 2. Employee submits the request: DRAFT -> SUBMITTED
    const submitRes = await request(app)
      .patch(`/api/requests/${reqId}/status`)
      .set("Authorization", `Bearer ${empToken}`)
      .send({ status: RequestStatus.SUBMITTED });

    expect(submitRes.status).toBe(200);
    expect(submitRes.body.status).toBe(RequestStatus.SUBMITTED);

    // 3. Manager reviews: SUBMITTED -> IN_REVIEW
    const reviewRes = await request(app)
      .patch(`/api/requests/${reqId}/status`)
      .set("Authorization", `Bearer ${mgrToken}`)
      .send({ status: RequestStatus.IN_REVIEW });

    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.status).toBe(RequestStatus.IN_REVIEW);

    // 4. Manager approves: IN_REVIEW -> APPROVED
    const approveRes = await request(app)
      .patch(`/api/requests/${reqId}/status`)
      .set("Authorization", `Bearer ${mgrToken}`)
      .send({ status: RequestStatus.APPROVED });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.status).toBe(RequestStatus.APPROVED);

    // 5. Manager moves to execution: APPROVED -> IN_PROGRESS
    const progressRes = await request(app)
      .patch(`/api/requests/${reqId}/status`)
      .set("Authorization", `Bearer ${mgrToken}`)
      .send({ status: RequestStatus.IN_PROGRESS });

    expect(progressRes.status).toBe(200);
    expect(progressRes.body.status).toBe(RequestStatus.IN_PROGRESS);

    // 6. Request completed: IN_PROGRESS -> COMPLETED
    const completeRes = await request(app)
      .patch(`/api/requests/${reqId}/status`)
      .set("Authorization", `Bearer ${mgrToken}`)
      .send({ status: RequestStatus.COMPLETED });

    expect(completeRes.status).toBe(200);
    expect(completeRes.body.status).toBe(RequestStatus.COMPLETED);
  });

  describe("Illegal Status Transitions (HTTP 409 Conflict)", () => {
    it("rejects illegal skip transition from DRAFT directly to COMPLETED with 409", async () => {
      const { user: emp, token: empToken } = await createUser({ role: Role.EMPLOYEE });
      const req = await createRequest(emp, { status: RequestStatus.DRAFT });

      const res = await request(app)
        .patch(`/api/requests/${req.id}/status`)
        .set("Authorization", `Bearer ${empToken}`)
        .send({ status: RequestStatus.COMPLETED });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/Invalid status transition/i);
    });

    it("rejects transition from DRAFT directly to IN_PROGRESS with 409", async () => {
      const { user: emp, token: empToken } = await createUser({ role: Role.EMPLOYEE });
      const req = await createRequest(emp, { status: RequestStatus.DRAFT });

      const res = await request(app)
        .patch(`/api/requests/${req.id}/status`)
        .set("Authorization", `Bearer ${empToken}`)
        .send({ status: RequestStatus.IN_PROGRESS });

      expect(res.status).toBe(409);
    });

    it("rejects editing request body when request is not in DRAFT status with 409", async () => {
      const { user: emp, token: empToken } = await createUser({ role: Role.EMPLOYEE });
      const req = await createRequest(emp, { status: RequestStatus.SUBMITTED });

      const res = await request(app)
        .patch(`/api/requests/${req.id}`)
        .set("Authorization", `Bearer ${empToken}`)
        .send({ title: "Updated Title" });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/Only requests in DRAFT status can be modified/i);
    });

    it("rejects cancelling a COMPLETED request with 409 Conflict", async () => {
      const { user: emp, token: empToken } = await createUser({ role: Role.EMPLOYEE });
      const req = await createRequest(emp, { status: RequestStatus.COMPLETED });

      const res = await request(app)
        .patch(`/api/requests/${req.id}/cancel`)
        .set("Authorization", `Bearer ${empToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/Cannot cancel/i);
    });
  });
});
