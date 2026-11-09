import { describe, it, expect, beforeAll, vi } from "vitest";
import request from "supertest";
import { Role } from "@prisma/client";
import { app } from "../../src/app";
import { prisma } from "../../src/lib/prisma";
import { createUser, createDepartment } from "../helpers/factories";
import { emailService } from "../../src/lib/email.service";

describe("Integration: Weekly Analytics Digest APIs & Admin Permissions", () => {
  let adminToken: string | undefined;
  let managerToken: string | undefined;
  let employeeToken: string | undefined;
  let isDbAvailable = false;

  beforeAll(async () => {
    // Avoid real network calls in integration tests
    vi.spyOn(emailService, "sendEmail").mockResolvedValue();

    try {
      const dept = await createDepartment("Executive Operations");

      const adm = await createUser({ role: Role.ADMIN, departmentId: dept.id });
      adminToken = adm.token;

      const mgr = await createUser({ role: Role.MANAGER, departmentId: dept.id });
      managerToken = mgr.token;

      const emp = await createUser({ role: Role.EMPLOYEE, departmentId: dept.id });
      employeeToken = emp.token;
      isDbAvailable = true;
    } catch (err: any) {
      console.warn("[Integration: Digest] PostgreSQL not available on test port; skipping live DB queries.");
    }
  });

  beforeEach((context) => {
    if (!isDbAvailable) {
      context.skip();
    }
  });

  describe("GET /api/analytics/digest/schedule", () => {
    it("returns 401 Unauthorized when unauthenticated", async () => {
      const res = await request(app).get("/api/analytics/digest/schedule");
      expect(res.status).toBe(401);
    });

    it("returns 403 Forbidden for Employee", async () => {
      const res = await request(app)
        .get("/api/analytics/digest/schedule")
        .set("Authorization", `Bearer ${employeeToken}`);
      expect(res.status).toBe(403);
    });

    it("returns 403 Forbidden for Manager", async () => {
      const res = await request(app)
        .get("/api/analytics/digest/schedule")
        .set("Authorization", `Bearer ${managerToken}`);
      expect(res.status).toBe(403);
    });

    it("returns 200 with schedule data for Admin", async () => {
      const res = await request(app)
        .get("/api/analytics/digest/schedule")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
    });
  });

  describe("PUT /api/analytics/digest/schedule", () => {
    it("returns 403 Forbidden for Employee", async () => {
      const res = await request(app)
        .put("/api/analytics/digest/schedule")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({
          recipients: ["emp@company.com"],
          dayOfWeek: 1,
          hour: 9,
        });
      expect(res.status).toBe(403);
    });

    it("returns 403 Forbidden for Manager", async () => {
      const res = await request(app)
        .put("/api/analytics/digest/schedule")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({
          recipients: ["mgr@company.com"],
          dayOfWeek: 1,
          hour: 9,
        });
      expect(res.status).toBe(403);
    });

    it("returns 400 Bad Request if recipients list is empty", async () => {
      const res = await request(app)
        .put("/api/analytics/digest/schedule")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          recipients: [],
          dayOfWeek: 1,
          hour: 9,
        });
      expect(res.status).toBe(400);
    });

    it("returns 400 Bad Request if any email address is invalid", async () => {
      const res = await request(app)
        .put("/api/analytics/digest/schedule")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          recipients: ["not-a-valid-email"],
          dayOfWeek: 1,
          hour: 9,
        });
      expect(res.status).toBe(400);
    });

    it("returns 400 Bad Request if hour or dayOfWeek is out of range", async () => {
      const res = await request(app)
        .put("/api/analytics/digest/schedule")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          recipients: ["valid@company.com"],
          dayOfWeek: 8, // Out of range (0-6)
          hour: 25,     // Out of range (0-23)
        });
      expect(res.status).toBe(400);
    });

    it("successfully creates or updates schedule for Admin", async () => {
      const payload = {
        recipients: ["executive@nexusops.com", "board@nexusops.com"],
        dayOfWeek: 1, // Monday
        hour: 8,      // 8 AM
        timezone: "Asia/Kolkata",
        isActive: true,
      };

      const res = await request(app)
        .put("/api/analytics/digest/schedule")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.data.recipients).toEqual(
        expect.arrayContaining(["executive@nexusops.com", "board@nexusops.com"])
      );
      expect(res.body.data.dayOfWeek).toBe(1);
      expect(res.body.data.hour).toBe(8);
      expect(res.body.data.timezone).toBe("Asia/Kolkata");
      expect(res.body.data.isActive).toBe(true);
    });
  });

  describe("POST /api/analytics/digest/send-test", () => {
    it("returns 403 Forbidden for Manager and Employee", async () => {
      const res1 = await request(app)
        .post("/api/analytics/digest/send-test")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ recipients: ["emp@company.com"] });
      expect(res1.status).toBe(403);

      const res2 = await request(app)
        .post("/api/analytics/digest/send-test")
        .set("Authorization", `Bearer ${managerToken}`)
        .send({ recipients: ["mgr@company.com"] });
      expect(res2.status).toBe(403);
    });

    it("successfully sends test digest email for Admin", async () => {
      const res = await request(app)
        .post("/api/analytics/digest/send-test")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          recipients: ["admin-test@nexusops.com"],
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.data.success).toBe(true);
      expect(res.body.data.deliveryId).toBeDefined();
    });
  });

  describe("GET /api/analytics/digest/deliveries", () => {
    it("returns 403 Forbidden for Manager and Employee", async () => {
      const res1 = await request(app)
        .get("/api/analytics/digest/deliveries")
        .set("Authorization", `Bearer ${employeeToken}`);
      expect(res1.status).toBe(403);

      const res2 = await request(app)
        .get("/api/analytics/digest/deliveries")
        .set("Authorization", `Bearer ${managerToken}`);
      expect(res2.status).toBe(403);
    });

    it("returns paginated delivery history for Admin", async () => {
      const res = await request(app)
        .get("/api/analytics/digest/deliveries?page=1&limit=5")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(Array.isArray(res.body.data.deliveries)).toBe(true);
      expect(typeof res.body.data.total).toBe("number");
      expect(res.body.data.page).toBe(1);
    });
  });
});
