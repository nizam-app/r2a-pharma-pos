import { prisma } from "@r2a/database";
import { AppError } from "../../utils/AppError";
import { pickFefoBatch } from "../../utils/fefo";
import type { TenantContext } from "../../types/tenant";

export type SubstituteItem = {
  id: string;
  name: string;
  genericName: string | null;
  sku: string | null;
  barcode: string | null;
  inStock: boolean;
  availableQuantityBase: number;
  /** Nearest in-stock (or overall nearest) sell price for POS — no cost/margin. */
  nearestSellPerBase: number | null;
  nearestExpiryDate: string | null;
  isExpired: boolean;
};

function startOfTodayUtc(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Products sharing the same genericName (active ingredient), excluding self.
 * POS-oriented fields: stock, sell price, nearest expiry / expired flag.
 * Empty/missing genericName → empty list (not an error).
 */
export async function listSubstitutes(
  ctx: TenantContext,
  productId: string,
  storeId: string,
): Promise<SubstituteItem[]> {
  const product = await prisma.product.findFirst({
    where: { id: productId, tenantId: ctx.tenantId },
  });
  if (!product) {
    throw new AppError("Product not found", 404);
  }

  const generic = product.genericName?.trim();
  if (!generic) {
    return [];
  }

  const others = await prisma.product.findMany({
    where: {
      tenantId: ctx.tenantId,
      id: { not: productId },
      isActive: true,
      genericName: generic,
    },
    orderBy: { name: "asc" },
  });

  const today = startOfTodayUtc();

  const items: SubstituteItem[] = [];

  for (const other of others) {
    const stockAgg = await prisma.batch.aggregate({
      where: {
        tenantId: ctx.tenantId,
        storeId,
        productId: other.id,
        quantityOnHand: { gt: 0 },
      },
      _sum: { quantityOnHand: true },
    });

    const availableQuantityBase = stockAgg._sum.quantityOnHand ?? 0;
    const inStock = availableQuantityBase > 0;

    const fefo = inStock
      ? await pickFefoBatch({
          tenantId: ctx.tenantId,
          storeId,
          productId: other.id,
        })
      : await prisma.batch.findFirst({
          where: {
            tenantId: ctx.tenantId,
            storeId,
            productId: other.id,
          },
          orderBy: [{ expiryDate: "asc" }, { id: "asc" }],
        });

    const nearestExpiryDate = fefo?.expiryDate
      ? fefo.expiryDate.toISOString().slice(0, 10)
      : null;
    const isExpired = fefo
      ? fefo.expiryDate.getTime() < today.getTime()
      : false;

    items.push({
      id: other.id,
      name: other.name,
      genericName: other.genericName,
      sku: other.sku,
      barcode: other.barcode,
      inStock,
      availableQuantityBase,
      nearestSellPerBase: fefo
        ? Number(fefo.sellPerBase.toString())
        : null,
      nearestExpiryDate,
      isExpired,
    });
  }

  // In-stock preferred (POS list), then name
  items.sort((a, b) => {
    if (a.inStock !== b.inStock) {
      return a.inStock ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return items;
}
