import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { authService } from "../../src/modules/auth/auth.service";
import { userRepository } from "../../src/modules/users/user.repository";
import { authRepository } from "../../src/modules/auth/auth.repository";
import { emailService } from "../../src/lib/email.service";
import { auditService } from "../../src/modules/audit/audit.service";
import { prisma } from "../../src/lib/prisma";
import { hashToken } from "../../src/lib/jwt";

vi.mock("../../src/modules/users/user.repository", () => ({
  userRepository: {
    findByEmail: vi.fn(),
    findById: vi.fn(),
  },
}));

vi.mock("../../src/modules/auth/auth.repository", () => ({
  authRepository: {
    invalidateUnusedPasswordResetTokens: vi.fn(),
    createPasswordResetToken: vi.fn(),
    findPasswordResetTokenByHash: vi.fn(),
    revokeAllUserRefreshTokens: vi.fn(),
    createRefreshToken: vi.fn(),
    findRefreshTokenByHash: vi.fn(),
    revokeRefreshTokenById: vi.fn(),
    revokeRefreshTokenByHash: vi.fn(),
  },
}));

vi.mock("../../src/lib/email.service", () => ({
  emailService: {
    sendEmail: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../src/modules/audit/audit.service", () => ({
  auditService: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../src/lib/prisma", () => {
  const txMock = {
    passwordResetToken: {
      updateMany: vi.fn(),
    },
    user: {
      update: vi.fn(),
    },
  };
  return {
    prisma: {
      $transaction: vi.fn(async (cb: (tx: typeof txMock) => Promise<unknown>) => cb(txMock)),
      __txMock: txMock,
    },
  };
});

describe("AuthService - Forgot & Reset Password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns generic success without sending email when user does not exist", async () => {
    vi.mocked(userRepository.findByEmail).mockResolvedValue(null);

    const res = await authService.forgotPassword(
      { email: "missing@nexusops.com" },
      { ip: "127.0.0.1" }
    );

    expect(res.message).toContain("If an account with that email exists");
    expect(authRepository.createPasswordResetToken).not.toHaveBeenCalled();
    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });

  it("invalidates prior unused tokens, stores hashed token, and emails reset URL for active users", async () => {
    vi.mocked(userRepository.findByEmail).mockResolvedValue({
      id: "user-1",
      name: "Alice",
      email: "alice@nexusops.com",
      role: Role.EMPLOYEE,
      isActive: true,
      passwordHash: "hash",
      departmentId: null,
      managerId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const res = await authService.forgotPassword(
      { email: "Alice@NexusOps.com" },
      { ip: "127.0.0.1" }
    );

    expect(res.message).toContain("If an account with that email exists");
    expect(authRepository.invalidateUnusedPasswordResetTokens).toHaveBeenCalledWith(
      "user-1",
      expect.anything()
    );
    expect(authRepository.createPasswordResetToken).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        tokenHash: expect.any(String),
        expiresAt: expect.any(Date),
      }),
      expect.anything()
    );
    expect(emailService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "alice@nexusops.com",
        subject: "Reset your NexusOps AI password",
        text: expect.stringContaining("/reset-password?token="),
      })
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "user-1",
        action: "PASSWORD_RESET_REQUESTED",
      })
    );
  });

  it("resets password, claims reset token atomically, and revokes all refresh tokens", async () => {
    const rawToken = "a".repeat(64);
    const txMock = (prisma as unknown as { __txMock: any }).__txMock;
    txMock.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });
    txMock.user.update.mockResolvedValue({ id: "user-1" });

    vi.mocked(authRepository.findPasswordResetTokenByHash).mockResolvedValue({
      id: "prt-1",
      userId: "user-1",
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + 10 * 60_000),
      usedAt: null,
      createdAt: new Date(),
      user: {
        id: "user-1",
        email: "alice@nexusops.com",
        name: "Alice",
        isActive: true,
      },
    } as never);

    const res = await authService.resetPassword(
      { token: rawToken, newPassword: "NewSecurePassword123!" },
      { ip: "127.0.0.1" }
    );

    expect(res.message).toContain("Password has been reset successfully");
    expect(txMock.passwordResetToken.updateMany).toHaveBeenCalledWith({
      where: { id: "prt-1", usedAt: null },
      data: { usedAt: expect.any(Date) },
    });

    const updateCall = txMock.user.update.mock.calls[0][0];
    expect(updateCall.where).toEqual({ id: "user-1" });
    expect(await bcrypt.compare("NewSecurePassword123!", updateCall.data.passwordHash)).toBe(true);
    expect(authRepository.revokeAllUserRefreshTokens).toHaveBeenCalledWith("user-1", txMock);
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "user-1",
        action: "PASSWORD_RESET",
      })
    );
  });

  it("rejects expired or already-used tokens", async () => {
    vi.mocked(authRepository.findPasswordResetTokenByHash).mockResolvedValue({
      id: "prt-expired",
      userId: "user-1",
      tokenHash: "hash",
      expiresAt: new Date(Date.now() - 1000),
      usedAt: null,
      createdAt: new Date(),
      user: { id: "user-1", email: "alice@nexusops.com", name: "Alice", isActive: true },
    } as never);

    await expect(
      authService.resetPassword({ token: "b".repeat(64), newPassword: "NewSecurePassword123!" })
    ).rejects.toThrow("Invalid or expired password reset token");

    vi.mocked(authRepository.findPasswordResetTokenByHash).mockResolvedValue({
      id: "prt-used",
      userId: "user-1",
      tokenHash: "hash",
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: new Date(),
      createdAt: new Date(),
      user: { id: "user-1", email: "alice@nexusops.com", name: "Alice", isActive: true },
    } as never);

    await expect(
      authService.resetPassword({ token: "c".repeat(64), newPassword: "NewSecurePassword123!" })
    ).rejects.toThrow("Invalid or expired password reset token");
  });
});
