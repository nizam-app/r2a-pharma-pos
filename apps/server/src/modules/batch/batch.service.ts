import { prisma } from "@r2a/database";
import type {
  BatchCreateInput,
  BatchListInput,
  BatchUpdateInput,
} from "@r2a/shared-types";
import { AppError } from "../../utils/AppError";
import { assertStoreAccess } from "../../utils/tenant";
import { serializeBatch } from "../../utils/margin";
import type { TenantContext } from "../../types/tenant";

export async function createBatch(ctx: TenantContext, input: BatchCreateInput) {
  const storeId = input.storeId ?? ctx.storeId;
  if (!storeId) {
    throw new AppError("storeId is required (or assign a store on the user)", 400);
  }
  await assertStoreAccess(ctx, storeId);

  const product = await prisma.product.findFirst({
    where: { id: input.productId, tenantId: ctx.tenantId },
  });
  if (!product) {
    throw new AppError("Product not found", 404);
  }

  try {
    const batch = await prisma.batch.create({
      data: {
        tenantId: ctx.tenantId,
        storeId,
        productId: input.productId,
        batchNumber: input.batchNumber,
        expiryDate: input.expiryDate,
        quantityOnHand: input.quantityOnHand,
        costPerBase: input.costPerBase,
        sellPerBase: input.sellPerBase,
      },
    });
    return serializeBatch(batch, ctx.role);
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      throw new AppError("Batch number already exists for this product/store", 409);
    }
    throw err;
  }
}

export async function updateBatch(
  ctx: TenantContext,
  batchId: string,
  input: BatchUpdateInput,
) {
  const existing = await prisma.batch.findFirst({
    where: { id: batchId, tenantId: ctx.tenantId },
  });
  if (!existing) {
    throw new AppError("Batch not found", 404);
  }

  try {
    const batch = await prisma.batch.update({
      where: { id: batchId },
      data: {
        batchNumber: input.batchNumber,
        expiryDate: input.expiryDate,
        quantityOnHand: input.quantityOnHand,
        costPerBase: input.costPerBase,
        sellPerBase: input.sellPerBase,
      },
    });
    return serializeBatch(batch, ctx.role);
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      throw new AppError("Batch number already exists for this product/store", 409);
    }
    throw err;
  }
}

export async function getBatch(ctx: TenantContext, batchId: string) {
  const batch = await prisma.batch.findFirst({
    where: { id: batchId, tenantId: ctx.tenantId },
  });
  if (!batch) {
    throw new AppError("Batch not found", 404);
  }
  return serializeBatch(batch, ctx.role);
}

export async function listBatches(ctx: TenantContext, query: BatchListInput) {
  if (query.storeId) {
    await assertStoreAccess(ctx, query.storeId);
  }

  const where = {
    tenantId: ctx.tenantId,
    ...(query.productId ? { productId: query.productId } : {}),
    ...(query.storeId
      ? { storeId: query.storeId }
      : ctx.role === "CASHIER" && ctx.storeId
        ? { storeId: ctx.storeId }
        : {}),
  };

  const [items, total] = await Promise.all([
    prisma.batch.findMany({
      where,
      orderBy: [{ expiryDate: "asc" }, { id: "asc" }],
      take: query.limit,
      skip: query.offset,
    }),
    prisma.batch.count({ where }),
  ]);

  return {
    items: items.map((b) => serializeBatch(b, ctx.role)),
    total,
    limit: query.limit,
    offset: query.offset,
  };
}
