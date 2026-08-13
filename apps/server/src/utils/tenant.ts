import type { Request } from "express";
import { prisma } from "@r2a/database";
import { AppError } from "./AppError";
import type { TenantContext } from "../types/tenant";

/** Require tenant context set by `tenantContext` middleware. */
export function requireTenantContext(req: Request): TenantContext {
  if (!req.ctx?.tenantId || !req.ctx.userId) {
    throw new AppError("Tenant context required", 401);
  }
  return req.ctx;
}

/** Prisma filter helper — always use JWT tenant, never body.tenantId. */
export function tenantWhere(req: Request): { tenantId: string } {
  return { tenantId: requireTenantContext(req).tenantId };
}

/**
 * Strip client-supplied tenantId so services cannot accidentally trust it.
 * Call after body parse on domain routes (tenantContext does this).
 */
export function stripClientTenantId(body: unknown): void {
  if (body && typeof body === "object" && !Array.isArray(body) && "tenantId" in body) {
    delete (body as Record<string, unknown>).tenantId;
  }
}

/**
 * If `storeId` is provided, it must belong to the JWT tenant.
 * Cashiers are store-scoped (body storeId must match JWT storeId when set).
 * OWNER/MANAGER may select any store under the tenant.
 */
export async function assertStoreAccess(
  ctx: TenantContext,
  storeId: string | null | undefined,
): Promise<void> {
  if (!storeId) {
    return;
  }

  const store = await prisma.store.findFirst({
    where: { id: storeId, tenantId: ctx.tenantId, isActive: true },
    select: { id: true },
  });

  if (!store) {
    throw new AppError("storeId is not part of your tenant", 400);
  }

  if (ctx.role === "CASHIER" && ctx.storeId && ctx.storeId !== storeId) {
    throw new AppError("storeId does not match your assigned store", 403);
  }
}
