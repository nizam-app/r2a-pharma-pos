import type { BatchReturnStatus, Role } from "@r2a/shared-types";
import { AppError } from "./AppError";
import type { TenantContext } from "../types/tenant";

type DecimalLike = { toString(): string } | number | string;

function toNumber(value: DecimalLike): number {
  return typeof value === "number" ? value : Number(value.toString());
}

export type BatchPublic = {
  id: string;
  tenantId: string;
  storeId: string;
  productId: string;
  batchNumber: string;
  expiryDate: Date;
  quantityOnHand: number;
  costPerBase?: number;
  sellPerBase: number;
  supplierName: string | null;
  returnStatus: BatchReturnStatus;
  status: "ACTIVE" | "RETIRED" | "VOIDED";
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

/** Serialize Prisma batch; omit `costPerBase` for cashiers (sellPerBase kept). */
export function serializeBatch(
  batch: {
    id: string;
    tenantId: string;
    storeId: string;
    productId: string;
    batchNumber: string;
    expiryDate: Date;
    quantityOnHand: number;
    costPerBase: DecimalLike;
    sellPerBase: DecimalLike;
    supplierName: string | null;
    returnStatus: BatchReturnStatus;
    status: "ACTIVE" | "RETIRED" | "VOIDED";
    version: number;
    createdAt: Date;
    updatedAt: Date;
  },
  role: Role,
): BatchPublic {
  const base: BatchPublic = {
    id: batch.id,
    tenantId: batch.tenantId,
    storeId: batch.storeId,
    productId: batch.productId,
    batchNumber: batch.batchNumber,
    expiryDate: batch.expiryDate,
    quantityOnHand: batch.quantityOnHand,
    sellPerBase: toNumber(batch.sellPerBase),
    supplierName: batch.supplierName,
    returnStatus: batch.returnStatus,
    status: batch.status,
    version: batch.version,
    createdAt: batch.createdAt,
    updatedAt: batch.updatedAt,
  };

  if (role !== "CASHIER") {
    base.costPerBase = toNumber(batch.costPerBase);
  }

  return base;
}

/** Reject cashier attempts to mutate catalog economics. */
export function assertCanMutatePrices(
  ctx: TenantContext,
  body: { costPerBase?: unknown; sellPerBase?: unknown },
): void {
  const touchesPrices =
    Object.prototype.hasOwnProperty.call(body, "costPerBase") ||
    Object.prototype.hasOwnProperty.call(body, "sellPerBase");

  if (!touchesPrices) {
    return;
  }

  if (ctx.role === "CASHIER") {
    throw new AppError(
      "Cashiers cannot mutate costPerBase or sellPerBase",
      403,
    );
  }
}
