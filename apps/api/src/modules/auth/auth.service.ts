import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { env } from "../../config/env";
import { AppError } from "../../lib/errors";
import { signAccessToken, hashToken } from "../../lib/jwt";
import { userRepository } from "../users/user.repository";
import { authRepository } from "./auth.repository";
import { auditService } from "../audit/audit.service";
import type { RegisterInput, LoginInput } from "./auth.schema";

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface AuthSessionResult {
  user: {
    id: string;
    name: string;
    email: string;
    role: Role;
    isActive: boolean;
    departmentId: string | null;
    managerId: string | null;
    createdAt: Date;
    updatedAt: Date;
    department?: { id: string; name: string } | null;
  };
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  private generateRefreshToken(): string {
    return crypto.randomBytes(40).toString("hex");
  }

  async register(input: RegisterInput): Promise<AuthSessionResult> {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) {
      throw AppError.conflict("An account with this email already exists");
    }

    const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);
    const user = await userRepository.createUser({
      name: input.name,
      email: input.email,
      passwordHash,
      departmentId: input.departmentId,
      role: Role.EMPLOYEE,
    });

    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
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

    // Write audit log entry for login
    await auditService.log({
      actorId: user.id,
      action: "USER_LOGIN",
      entityType: "User",
      entityId: user.id,
      metadata: {
        ip: meta.ip || "unknown",
        userAgent: meta.userAgent || "unknown",
      },
    });

    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
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
}

export const authService = new AuthService();
