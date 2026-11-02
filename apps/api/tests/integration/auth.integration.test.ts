import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { Role } from "@prisma/client";
import { app } from "../../src/app";
import { prisma } from "../../src/lib/prisma";
import { createUser, DEFAULT_PASSWORD } from "../helpers/factories";

describe("Integration: Auth Module (Real Test DB)", () => {
  describe("POST /api/auth/register", () => {
    it("successfully registers a new employee with accessToken and httpOnly cookie", async () => {
      const email = `reg-${Date.now()}@nexusops.com`;
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          name: "New Hire",
          email,
          password: "SecurePassword123!",
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        user: {
          email,
          role: Role.EMPLOYEE,
        },
      });
      expect(res.body.accessToken).toBeDefined();

      // Check httpOnly cookie
      const cookies = res.headers["set-cookie"] as string[] | undefined;
      expect(cookies).toBeDefined();
      expect(cookies?.some((c) => c.includes("refreshToken="))).toBe(true);

      // Verify in DB
      const dbUser = await prisma.user.findUnique({ where: { email } });
      expect(dbUser).not.toBeNull();
      expect(dbUser?.role).toBe(Role.EMPLOYEE);
    });

    it("prevents privilege escalation: cannot set role to ADMIN or MANAGER during registration", async () => {
      const email = `escalate-${Date.now()}@nexusops.com`;
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Sneaky User",
          email,
          password: "SecurePassword123!",
          role: "ADMIN", // Attacker attempts to become admin
        });

      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe(Role.EMPLOYEE);

      const dbUser = await prisma.user.findUnique({ where: { email } });
      expect(dbUser?.role).toBe(Role.EMPLOYEE);
    });

    it("rejects duplicate email with 409 Conflict", async () => {
      const { user } = await createUser();

      const res = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Duplicate User",
          email: user.email,
          password: "Password123!",
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain("already in use");
    });
  });

  describe("POST /api/auth/login", () => {
    it("successfully logs in with valid credentials", async () => {
      const { user } = await createUser();

      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: user.email,
          password: DEFAULT_PASSWORD,
        });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.email).toBe(user.email);
    });

    it("returns 401 on incorrect password", async () => {
      const { user } = await createUser();

      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: user.email,
          password: "WrongPassword!",
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain("Invalid email or password");
    });

    it("immediately rejects a deactivated user with 403 Forbidden", async () => {
      const { user } = await createUser({ isActive: false });

      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: user.email,
          password: DEFAULT_PASSWORD,
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("Account is deactivated");
    });
  });

  describe("POST /api/auth/refresh & Token Rotation", () => {
    it("rotates refresh token and returns new access/refresh pair", async () => {
      const { user } = await createUser();

      // Login to obtain initial refreshToken cookie
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: user.email, password: DEFAULT_PASSWORD });

      const rawCookie = (loginRes.headers["set-cookie"] as string[])[0];

      // Refresh
      const refreshRes = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", rawCookie);

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.accessToken).toBeDefined();

      const newCookies = refreshRes.headers["set-cookie"] as string[];
      expect(newCookies).toBeDefined();
      expect(newCookies[0]).toContain("refreshToken=");
    });

    it("detects reuse of revoked refresh token and rejects with 401", async () => {
      const { user } = await createUser();

      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: user.email, password: DEFAULT_PASSWORD });

      const oldCookie = (loginRes.headers["set-cookie"] as string[])[0];

      // Legitimate first refresh
      const firstRefresh = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", oldCookie);

      expect(firstRefresh.status).toBe(200);

      // Malicious reuse attempt with old rotated token
      const reuseRes = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", oldCookie);

      expect(reuseRes.status).toBe(401);
    });
  });

  describe("POST /api/auth/logout", () => {
    it("logs out user, clears cookie, and invalidates session", async () => {
      const { user } = await createUser();

      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: user.email, password: DEFAULT_PASSWORD });

      const cookie = (loginRes.headers["set-cookie"] as string[])[0];

      const logoutRes = await request(app)
        .post("/api/auth/logout")
        .set("Cookie", cookie);

      expect(logoutRes.status).toBe(200);

      // After logout, refreshing with old cookie must fail
      const refreshAfterLogout = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", cookie);

      expect(refreshAfterLogout.status).toBe(401);
    });
  });
});
