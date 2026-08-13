import { prisma, type User } from "@r2a/database";
import type { StaffCreateInput } from "@r2a/shared-types";
import * as bcrypt from "bcryptjs";
import { AppError } from "../../utils/AppError";
import { toSafeUser, type AuthUserRow } from "../../utils/jwt";

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

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) {
    throw new AppError("User not found", 404);
  }
  return toSafeUser(asAuthUser(user));
}

export async function createStaff(
  actor: { tenantId: string },
  input: StaffCreateInput,
) {
  if (input.storeId) {
    const store = await prisma.store.findFirst({
      where: { id: input.storeId, tenantId: actor.tenantId },
    });
    if (!store) {
      throw new AppError("storeId is not part of your tenant", 400);
    }
  }

  const email = input.email.toLowerCase();
  const existing = await prisma.user.findUnique({
    where: {
      tenantId_email: { tenantId: actor.tenantId, email },
    },
  });
  if (existing) {
    throw new AppError("Email already registered in this tenant", 409);
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      tenantId: actor.tenantId,
      storeId: input.storeId ?? null,
      email,
      passwordHash,
      name: input.name?.trim() || email.split("@")[0] || "Staff",
      role: input.role,
    },
  });

  return toSafeUser(asAuthUser(user));
}
