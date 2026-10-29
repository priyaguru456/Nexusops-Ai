import crypto from "crypto";
import jwt, { SignOptions } from "jsonwebtoken";
import type { CookieOptions } from "express";
import { Role } from "@prisma/client";
import { env } from "../config/env";

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: Role;
}

export interface RefreshTokenPayload {
  sub: string;
  tokenId: string;
}

export const signAccessToken = (payload: AccessTokenPayload): string => {
  const options: SignOptions = {
    expiresIn: env.JWT_ACCESS_EXPIRES as SignOptions["expiresIn"],
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
};

export const signRefreshToken = (payload: RefreshTokenPayload): string => {
  const options: SignOptions = {
    expiresIn: env.JWT_REFRESH_EXPIRES as SignOptions["expiresIn"],
  };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, options);
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
};

export const hashToken = (token: string): string => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

export const REFRESH_COOKIE_NAME = "refreshToken";

export const getRefreshCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  path: "/api/auth",
});
