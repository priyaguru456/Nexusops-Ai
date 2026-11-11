import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { signAccessToken, hashToken } from "../../lib/jwt";
import { emailService } from "../../lib/email.service";
import { logger } from "../../lib/logger";
import { DEFAULT_ORGANIZATION_SLUG } from "../../lib/tenant";
import { userRepository } from "../users/user.repository";
import { authRepository } from "./auth.repository";
import { auditService } from "../audit/audit.service";
import type {
  RegisterInput,
  LoginInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from "./auth.schema";

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const PASSWORD_RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

export interface AuthSessionResult {
  user: {
    id: string;
    name: string;
    email: string;
    role: Role;
    isActive: boolean;
    organizationId: string | null;
    departmentId: string | null;
    managerId: string | null;
    createdAt: Date;
    updatedAt: Date;
    department?: { id: string; name: string } | null;
    organization?: {
      id: string;
      name: string;
      slug: string;
      isActive: boolean;
    } | null;
  };
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  private generateRefreshToken(): string {
    return crypto.randomBytes(40).toString("hex");
  }

  private assertActiveOrganization(user: {
    role: Role;
    organizationId: string | null;
    organization?: { isActive: boolean } | null;
  }): void {
    if (user.role !== Role.SUPER_ADMIN) {
      if (!user.organizationId || (user.organization && !user.organization.isActive)) {
        throw AppError.forbidden("Organization is suspended or inactive");
      }
    } else if (user.organization && !user.organization.isActive) {
      throw AppError.forbidden("Organization is suspended or inactive");
    }
  }

  async register(input: RegisterInput): Promise<AuthSessionResult> {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) {
      throw AppError.conflict("An account with this email already exists");
    }

    const slug = input.organizationSlug?.toLowerCase().trim() || DEFAULT_ORGANIZATION_SLUG;
    const organization = await prisma.organization.findUnique({ where: { slug } });
    if (!organization) {
      throw AppError.notFound("Organization not found");
    }
    if (!organization.isActive) {
      throw AppError.forbidden("Organization is suspended or inactive");
    }

    if (input.departmentId) {
      const dept = await prisma.department.findFirst({
        where: { id: input.departmentId, organizationId: organization.id },
      });
      if (!dept) {
        throw AppError.badRequest("Selected department does not belong to this organization");
      }
    }

    const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);
    const user = await userRepository.createUser({
      name: input.name,
      email: input.email,
      passwordHash,
      organizationId: organization.id,
      departmentId: input.departmentId,
      role: Role.EMPLOYEE,
    });

    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId ?? null,
    });

    const rawRefreshToken = this.generateRefreshToken();
    const tokenHash = hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    await authRepository.createRefreshToken({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    return {
      user,
      accessToken,
      refreshToken: rawRefreshToken,
    };
  }

  async login(
    input: LoginInput,
    meta: { ip?: string; userAgent?: string } = {}
  ): Promise<AuthSessionResult> {
    const user = await userRepository.findByEmail(input.email);
    if (!user) {
      throw AppError.unauthorized("Invalid email or password");
    }

    const isMatch = await bcrypt.compare(input.password, user.passwordHash);
    if (!isMatch) {
      throw AppError.unauthorized("Invalid email or password");
    }

    if (!user.isActive) {
      throw AppError.forbidden("Account is deactivated. Please contact an administrator.");
    }

    this.assertActiveOrganization(user);

    // Write audit log entry for login
    await auditService.log({
      actorId: user.id,
      organizationId: user.organizationId ?? null,
      action: "USER_LOGIN",
      entityType: "User",
      entityId: user.id,
      summary: `User ${user.email} logged in`,
      ipAddress: meta.ip || null,
      metadata: {
        ip: meta.ip || "unknown",
        userAgent: meta.userAgent || "unknown",
      },
    });

    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId ?? null,
    });

    const rawRefreshToken = this.generateRefreshToken();
    const tokenHash = hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    await authRepository.createRefreshToken({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    const { passwordHash: _hash, ...safeUser } = user;

    return {
      user: safeUser,
      accessToken,
      refreshToken: rawRefreshToken,
    };
  }

  async refresh(rawRefreshToken?: string): Promise<{ accessToken: string; refreshToken: string }> {
    if (!rawRefreshToken) {
      throw AppError.unauthorized("Refresh token is required");
    }

    const tokenHash = hashToken(rawRefreshToken);
    const existingToken = await authRepository.findRefreshToken(tokenHash);

    if (!existingToken || existingToken.revoked || new Date() > existingToken.expiresAt) {
      throw AppError.unauthorized("Invalid or expired refresh token");
    }

    if (!existingToken.user || !existingToken.user.isActive) {
      throw AppError.unauthorized("User account is inactive or no longer exists");
    }

    this.assertActiveOrganization(existingToken.user);

    // Rotate: Revoke old refresh token and issue a new one
    await authRepository.revokeRefreshToken(existingToken.id);

    const newRawRefreshToken = this.generateRefreshToken();
    const newTokenHash = hashToken(newRawRefreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    await authRepository.createRefreshToken({
      userId: existingToken.user.id,
      tokenHash: newTokenHash,
      expiresAt,
    });

    const accessToken = signAccessToken({
      sub: existingToken.user.id,
      email: existingToken.user.email,
      role: existingToken.user.role,
      organizationId: existingToken.user.organizationId ?? null,
    });

    return {
      accessToken,
      refreshToken: newRawRefreshToken,
    };
  }

  async logout(rawRefreshToken?: string): Promise<{ message: string }> {
    if (rawRefreshToken) {
      const tokenHash = hashToken(rawRefreshToken);
      await authRepository.revokeRefreshTokenByHash(tokenHash);
    }
    return { message: "Logged out successfully" };
  }

  async getMe(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user || !user.isActive) {
      throw AppError.unauthorized("User account not found or inactive");
    }
    return user;
  }

  async forgotPassword(
    input: ForgotPasswordInput,
    meta: { ip?: string } = {}
  ): Promise<{ message: string }> {
    const genericMessage =
      "If an account with that email exists, a password reset link has been sent.";

    const email = input.email.toLowerCase().trim();
    const user = await userRepository.findByEmail(email);

    if (!user || !user.isActive) {
      return { message: genericMessage };
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);

    await prisma.$transaction(async (tx) => {
      await authRepository.invalidateUnusedPasswordResetTokens(user.id, tx);
      await authRepository.createPasswordResetToken(
        {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
        tx
      );
    });

    const baseClientUrl = env.CLIENT_URL.replace(/\/+$/, "");
    const resetUrl = `${baseClientUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;

    try {
      await emailService.sendEmail({
        to: user.email,
        subject: "Reset your NexusOps AI password",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #0f172a;">
            <h2 style="color: #4f46e5;">NexusOps AI Password Reset</h2>
            <p>Hi ${user.name},</p>
            <p>We received a request to reset your password. Click the button below to choose a new password. This link expires in 30 minutes.</p>
            <p style="margin: 24px 0;">
              <a href="${resetUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">
                Reset Password
              </a>
            </p>
            <p style="font-size: 13px; color: #475569;">If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="font-size: 12px; color: #64748b; word-break: break-all;">${resetUrl}</p>
            <p style="font-size: 12px; color: #64748b;">If you did not request a password reset, you can safely ignore this email.</p>
          </div>
        `,
        text: `Hi ${user.name},\n\nReset your NexusOps AI password using the link below (valid for 30 minutes):\n${resetUrl}\n\nIf you did not request this, you can safely ignore this email.`,
      });
    } catch (err) {
      logger.error({ err, userId: user.id }, "Failed to send password reset email");
    }

    await auditService.log({
      actorId: user.id,
      organizationId: user.organizationId ?? null,
      action: "PASSWORD_RESET_REQUESTED",
      entityType: "User",
      entityId: user.id,
      summary: `Password reset requested for ${user.email}`,
      ipAddress: meta.ip || null,
    });

    return { message: genericMessage };
  }

  async resetPassword(
    input: ResetPasswordInput,
    meta: { ip?: string } = {}
  ): Promise<{ message: string }> {
    const tokenHash = hashToken(input.token);
    const resetRecord = await authRepository.findPasswordResetTokenByHash(tokenHash);

    if (
      !resetRecord ||
      resetRecord.usedAt !== null ||
      new Date() > resetRecord.expiresAt
    ) {
      throw AppError.badRequest("Invalid or expired password reset token");
    }

    if (!resetRecord.user || !resetRecord.user.isActive) {
      throw AppError.forbidden("Account is deactivated or no longer exists");
    }

    const newPasswordHash = await bcrypt.hash(input.newPassword, env.BCRYPT_ROUNDS);

    await prisma.$transaction(async (tx) => {
      const claimResult = await tx.passwordResetToken.updateMany({
        where: {
          id: resetRecord.id,
          usedAt: null,
        },
        data: {
          usedAt: new Date(),
        },
      });

      if (claimResult.count === 0) {
        throw AppError.badRequest("Invalid or expired password reset token");
      }

      await tx.user.update({
        where: { id: resetRecord.userId },
        data: { passwordHash: newPasswordHash },
      });

      await authRepository.revokeAllUserRefreshTokens(resetRecord.userId, tx);
    });

    await auditService.log({
      actorId: resetRecord.userId,
      organizationId: resetRecord.user.organizationId ?? null,
      action: "PASSWORD_RESET",
      entityType: "User",
      entityId: resetRecord.userId,
      summary: `Password reset completed via email token for ${resetRecord.user.email}`,
      ipAddress: meta.ip || null,
    });

    return {
      message: "Password has been reset successfully. You can now sign in with your new password.",
    };
  }
}

export const authService = new AuthService();
