import { prisma } from "@r2a/database";
import { AppError } from "./AppError";
import { serializeBatch } from "./margin";
import type { TenantContext } from "../types/tenant";

/**
 * FEFO: nearest expiryDate with quantityOnHand > 0.
 * Stable tie-break: expiryDate ASC, then batch id ASC.
 * Scoped by JWT tenant + store.
 */
export async function pickFefoBatch(params: {
  tenantId: string;
  storeId: string;
  productId: string;
}) {
  return prisma.batch.findFirst({
    where: {
      tenantId: params.tenantId,
      storeId: params.storeId,
      productId: params.productId,
      quantityOnHand: { gt: 0 },
    },
    orderBy: [{ expiryDate: "asc" }, { id: "asc" }],
  });
}

export function resolveStoreId(
  ctx: TenantContext,
  queryStoreId?: string,
): string {
  const storeId = queryStoreId ?? ctx.storeId ?? undefined;
  if (!storeId) {
    throw new AppError(
      "storeId is required (JWT store or ?storeId= for owners)",
      400,
    );
  }
  return storeId;
}

export async function getFefoBatchForProduct(
  ctx: TenantContext,
  productId: string,
  storeId: string,
) {
  const product = await prisma.product.findFirst({
    where: { id: productId, tenantId: ctx.tenantId },
    select: { id: true },
  });
  if (!product) {
    throw new AppError("Product not found", 404);
  }

  const batch = await pickFefoBatch({
    tenantId: ctx.tenantId,
    storeId,
    productId,
  });

  if (!batch) {
    throw new AppError("No in-stock batch available for FEFO", 404);
  }

  return serializeBatch(batch, ctx.role);
}
