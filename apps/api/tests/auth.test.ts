import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { signAccessToken } from "../src/lib/jwt";

vi.mock("../src/lib/prisma", () => {
  return {
    prisma: {
      user: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
      },
      refreshToken: {
        create: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      $queryRaw: vi.fn(),
    },
  };
});

describe("Auth Module Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/auth/register", () => {
    it("successfully registers a new employee and returns accessToken and httpOnly cookie", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

      const createdUser = {
        id: "11111111-1111-1111-1111-111111111111",
        name: "Test User",
        email: "test@nexusops.com",
        role: Role.EMPLOYEE,
        isActive: true,
        departmentId: null,
        managerId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        department: null,
      };

      vi.mocked(prisma.user.create).mockResolvedValueOnce(createdUser as any);
      vi.mocked(prisma.refreshToken.create).mockResolvedValueOnce({
        id: "token-1",
        userId: createdUser.id,
        tokenHash: "hash123",
        expiresAt: new Date(Date.now() + 7 * 86400000),
        revoked: false,
        createdAt: new Date(),
      } as any);

      const res = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Test User",
          email: "test@nexusops.com",
          password: "SecurePassword123!",
        });

      expect(res.status).toBe(201);
      expect(res.body.user).toMatchObject({
        id: createdUser.id,
        name: createdUser.name,
        email: createdUser.email,
        role: "EMPLOYEE",
      });
      expect(res.body.accessToken).toBeDefined();
      expect(res.headers["set-cookie"]).toBeDefined();
      expect(res.headers["set-cookie"][0]).toContain("refreshToken=");
      expect(res.headers["set-cookie"][0]).toContain("HttpOnly");
    });

    it("returns 409 Conflict if email is already registered", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: "existing-id",
        email: "existing@nexusops.com",
      } as any);

      const res = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Existing User",
          email: "existing@nexusops.com",
          password: "SecurePassword123!",
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain("already exists");
    });

    it("returns 400 Validation failed if password is too short", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Short Pass",
          email: "short@nexusops.com",
          password: "123",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Validation failed");
      expect(res.body.details.fieldErrors.password).toBeDefined();
    });
  });

  describe("POST /api/auth/login", () => {
    it("successfully logs in, writes audit log, and sets refresh token cookie", async () => {
      const passwordHash = await bcrypt.hash("MySecretPassword", 10);
      const user = {
        id: "22222222-2222-2222-2222-222222222222",
        name: "Login User",
        email: "login@nexusops.com",
        passwordHash,
        role: Role.MANAGER,
        isActive: true,
        departmentId: null,
        managerId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        department: null,
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(user as any);
      vi.mocked(prisma.refreshToken.create).mockResolvedValueOnce({} as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValueOnce({} as any);

      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: "login@nexusops.com",
          password: "MySecretPassword",
        });

      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({
        id: user.id,
        email: user.email,
        role: Role.MANAGER,
      });
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(res.body.accessToken).toBeDefined();
      expect(res.headers["set-cookie"][0]).toContain("refreshToken=");

      // Verify audit log call
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorId: user.id,
            action: "USER_LOGIN",
            entityType: "User",
            entityId: user.id,
          }),
        })
      );
    });

    it("returns 401 Unauthorized on wrong password", async () => {
      const passwordHash = await bcrypt.hash("CorrectPassword", 10);
      const user = {
        id: "33333333-3333-3333-3333-333333333333",
        email: "wrongpass@nexusops.com",
        passwordHash,
        isActive: true,
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(user as any);

      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: "wrongpass@nexusops.com",
          password: "IncorrectPassword",
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Invalid email or password");
    });

    it("returns 403 Forbidden if user account is deactivated", async () => {
      const passwordHash = await bcrypt.hash("AnyPassword", 10);
      const user = {
        id: "44444444-4444-4444-4444-444444444444",
        email: "deactivated@nexusops.com",
        passwordHash,
        isActive: false,
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(user as any);

      const res = await request(app)
        .post("/api/auth/login")
        .send({
          email: "deactivated@nexusops.com",
          password: "AnyPassword",
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("deactivated");
    });
  });

  describe("POST /api/auth/refresh", () => {
    it("successfully rotates refresh token and returns new accessToken", async () => {
      const user = {
        id: "55555555-5555-5555-5555-555555555555",
        email: "refresh@nexusops.com",
        role: Role.EMPLOYEE,
        isActive: true,
        department: null,
      };

      vi.mocked(prisma.refreshToken.findFirst).mockResolvedValueOnce({
        id: "old-token-id",
        userId: user.id,
        user,
        tokenHash: "somehash",
        expiresAt: new Date(Date.now() + 1000000),
        revoked: false,
        createdAt: new Date(),
      } as any);

      vi.mocked(prisma.refreshToken.update).mockResolvedValueOnce({} as any);
      vi.mocked(prisma.refreshToken.create).mockResolvedValueOnce({} as any);

      const res = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", ["refreshToken=sample_refresh_token_string"]);

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.headers["set-cookie"]).toBeDefined();
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: "old-token-id" },
        data: { revoked: true },
      });
      expect(prisma.refreshToken.create).toHaveBeenCalled();
    });

    it("returns 401 Unauthorized when no cookie is sent", async () => {
      const res = await request(app).post("/api/auth/refresh");
      expect(res.status).toBe(401);
      expect(res.body.error).toContain("Refresh token is required");
    });

    it("returns 401 Unauthorized if refresh token is revoked or expired", async () => {
      vi.mocked(prisma.refreshToken.findFirst).mockResolvedValueOnce({
        id: "revoked-token-id",
        revoked: true,
        expiresAt: new Date(Date.now() + 1000000),
      } as any);

      const res = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", ["refreshToken=revoked_token_string"]);

      expect(res.status).toBe(401);
      expect(res.body.error).toContain("Invalid or expired refresh token");
    });
  });

  describe("POST /api/auth/logout", () => {
    it("revokes token in DB and clears cookie", async () => {
      vi.mocked(prisma.refreshToken.updateMany).mockResolvedValueOnce({ count: 1 });

      const res = await request(app)
        .post("/api/auth/logout")
        .set("Cookie", ["refreshToken=some_token_to_revoke"]);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain("Logged out");
      expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
    });
  });

  describe("GET /api/auth/me", () => {
    it("returns current user when valid accessToken is supplied", async () => {
      const user = {
        id: "66666666-6666-6666-6666-666666666666",
        name: "Current User",
        email: "me@nexusops.com",
        role: Role.MANAGER,
        isActive: true,
        departmentId: null,
        managerId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        department: null,
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(user as any);

      const token = signAccessToken({
        sub: user.id,
        email: user.email,
        role: user.role,
      });

      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({
        id: user.id,
        email: user.email,
        name: user.name,
      });
    });

    it("returns 401 Unauthorized when authorization header is missing", async () => {
      const res = await request(app).get("/api/auth/me");
      expect(res.status).toBe(401);
    });
  });

  describe("Rate Limiting on /api/auth/login", () => {
    it("returns 429 Too Many Requests after 5 attempts from the same IP+email", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const targetEmail = "ratelimit@nexusops.com";

      // 5 requests within the limit
      for (let i = 0; i < 5; i++) {
        const res = await request(app)
          .post("/api/auth/login")
          .set("x-test-rate-limit", "true")
          .send({ email: targetEmail, password: "test" });
        expect(res.status).toBe(401);
      }

      // 6th request exceeds the limit
      const blockedRes = await request(app)
        .post("/api/auth/login")
        .set("x-test-rate-limit", "true")
        .send({ email: targetEmail, password: "test" });

      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.error).toContain("Too many login attempts");
    });
  });
});
