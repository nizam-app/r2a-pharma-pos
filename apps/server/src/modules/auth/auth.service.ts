import { prisma, type User } from "@r2a/database";
import type {
  LoginInput,
  RefreshTokenInput,
  RegisterInput,
} from "@r2a/shared-types";
import * as bcrypt from "bcryptjs";
import { AppError } from "../../utils/AppError";
import {
  claimsFromUser,
  generateRefreshTokenRaw,
  hashToken,
  refreshExpiresAt,
  signAccessToken,
  toSafeUser,
  type AuthUserRow,
} from "../../utils/jwt";
import { env } from "../../config";

const BCRYPT_ROUNDS = 12;

function asAuthUser(user: User): AuthUserRow {
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

async function issueTokenPair(user: AuthUserRow) {
  const accessToken = signAccessToken(claimsFromUser(user));
  const refreshToken = generateRefreshTokenRaw();
  const tokenHash = hashToken(refreshToken);

  await prisma.refreshToken.create({
    data: {
      tenantId: user.tenantId,
      userId: user.id,
      tokenHash,
      expiresAt: refreshExpiresAt(),
    },
  });

  return {
    user: toSafeUser(user),
    accessToken,
    refreshToken,
    expiresIn: env.jwtExpiresIn,
  };
}

async function revokeAllUserRefreshTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function register(input: RegisterInput) {
  const existingSlug = await prisma.tenant.findUnique({
    where: { slug: input.tenantSlug },
  });
  if (existingSlug) {
    throw new AppError("Tenant slug already taken", 409);
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const storeName = input.storeName?.trim() || "Main Store";

  const user = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: input.tenantName,
        slug: input.tenantSlug,
      },
    });

    const store = await tx.store.create({
      data: {
        tenantId: tenant.id,
        name: storeName,
        code: "MAIN",
      },
    });

    return tx.user.create({
      data: {
        tenantId: tenant.id,
        storeId: store.id,
        email: input.email.toLowerCase(),
        passwordHash,
        name: input.name,
        role: "OWNER",
      },
    });
  });

  return issueTokenPair(asAuthUser(user));
}

export async function login(input: LoginInput) {
  const email = input.email.toLowerCase();

  let user: User | null = null;

  if (input.tenantSlug) {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: input.tenantSlug },
    });
    if (!tenant || !tenant.isActive) {
      throw new AppError("Invalid email or password", 401);
    }
    user = await prisma.user.findUnique({
      where: {
        tenantId_email: { tenantId: tenant.id, email },
      },
    });
  } else {
    const matches = await prisma.user.findMany({
      where: { email },
      take: 2,
    });
    if (matches.length > 1) {
      throw new AppError(
        "tenantSlug is required when email exists in multiple tenants",
        400,
      );
    }
    user = matches[0] ?? null;
  }

  if (!user || !user.isActive) {
    throw new AppError("Invalid email or password", 401);
  }

  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) {
    throw new AppError("Invalid email or password", 401);
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } });
  if (!tenant?.isActive) {
    throw new AppError("Tenant is inactive", 403);
  }

  return issueTokenPair(asAuthUser(user));
}

export async function refresh(input: RefreshTokenInput) {
  const tokenHash = hashToken(input.refreshToken);
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!existing) {
    throw new AppError("Invalid refresh token", 401);
  }

  if (existing.revokedAt) {
    await revokeAllUserRefreshTokens(existing.userId);
    throw new AppError("Refresh token reuse detected — all sessions revoked", 401);
  }

  if (existing.expiresAt.getTime() <= Date.now()) {
    await prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });
    throw new AppError("Refresh token expired", 401);
  }

  if (!existing.user.isActive) {
    throw new AppError("User is inactive", 403);
  }

  const newRaw = generateRefreshTokenRaw();
  const newHash = hashToken(newRaw);

  await prisma.$transaction(async (tx) => {
    const created = await tx.refreshToken.create({
      data: {
        tenantId: existing.tenantId,
        userId: existing.userId,
        tokenHash: newHash,
        expiresAt: refreshExpiresAt(),
      },
    });

    await tx.refreshToken.update({
      where: { id: existing.id },
      data: {
        revokedAt: new Date(),
        replacedById: created.id,
      },
    });
  });

  const user = asAuthUser(existing.user);
  return {
    user: toSafeUser(user),
    accessToken: signAccessToken(claimsFromUser(user)),
    refreshToken: newRaw,
    expiresIn: env.jwtExpiresIn,
  };
}

export async function logout(input: RefreshTokenInput): Promise<void> {
  const tokenHash = hashToken(input.refreshToken);
  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!existing || existing.revokedAt) {
    return;
  }
  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() },
  });
}
