import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import type { JwtClaims, Role } from "@r2a/shared-types";
import { jwtClaimsSchema } from "@r2a/shared-types";
import { env } from "../config";
import { AppError } from "./AppError";

function requireJwtSecret(): string {
  if (!env.jwtSecret) {
    throw new AppError("JWT_SECRET is not configured", 500);
  }
  return env.jwtSecret;
}

export function signAccessToken(claims: JwtClaims): string {
  const secret = requireJwtSecret();
  return jwt.sign(
    {
      sub: claims.sub,
      role: claims.role,
      tenantId: claims.tenantId,
      storeId: claims.storeId,
    },
    secret,
    {
      expiresIn: env.jwtExpiresIn as jwt.SignOptions["expiresIn"],
    },
  );
}

export function verifyAccessToken(token: string): JwtClaims {
  try {
    const secret = requireJwtSecret();
    const decoded = jwt.verify(token, secret);
    const parsed = jwtClaimsSchema.safeParse(decoded);
    if (!parsed.success) {
      throw new AppError("Invalid token claims", 401);
    }
    return parsed.data;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("Invalid or expired access token", 401);
  }
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function generateRefreshTokenRaw(): string {
  return randomBytes(48).toString("base64url");
}

export function refreshExpiresAt(): Date {
  return new Date(Date.now() + env.refreshTokenExpiresMs);
}

export type AuthUserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  tenantId: string;
  storeId: string | null;
  isActive: boolean;
  createdAt: Date;
};

export function toSafeUser(user: AuthUserRow) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
    storeId: user.storeId,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

export function claimsFromUser(user: AuthUserRow): JwtClaims {
  return {
    sub: user.id,
    role: user.role,
    tenantId: user.tenantId,
    storeId: user.storeId,
  };
}
