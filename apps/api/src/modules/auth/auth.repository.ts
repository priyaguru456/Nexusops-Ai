import { prisma } from "../../lib/prisma";

export interface CreateRefreshTokenData {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

export class AuthRepository {
  async createRefreshToken(data: CreateRefreshTokenData) {
    return prisma.refreshToken.create({
      data: {
        userId: data.userId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
        revoked: false,
      },
    });
  }

  async findRefreshToken(tokenHash: string) {
    return prisma.refreshToken.findFirst({
      where: {
        tokenHash,
      },
      include: {
        user: {
          include: {
            department: true,
          },
        },
      },
    });
  }

  async revokeRefreshToken(id: string) {
    return prisma.refreshToken.update({
      where: { id },
      data: { revoked: true },
    });
  }

  async revokeRefreshTokenByHash(tokenHash: string) {
    return prisma.refreshToken.updateMany({
      where: { tokenHash, revoked: false },
      data: { revoked: true },
    });
  }

  async revokeAllUserRefreshTokens(userId: string) {
    return prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });
  }
}

export const authRepository = new AuthRepository();
