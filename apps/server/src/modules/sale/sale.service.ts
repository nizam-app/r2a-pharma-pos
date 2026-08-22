import { prisma, Prisma } from "@r2a/database";
import type { Role, SaleIngestInput, SaleListQuery } from "@r2a/shared-types";
import { AppError } from "../../utils/AppError";
import { pickFefoBatch } from "../../utils/fefo";
import { serializeBatch } from "../../utils/margin";
import { assertStoreAccess } from "../../utils/tenant";
import type { TenantContext } from "../../types/tenant";

const saleInclude = {
  items: { include: { batch: true } },
  payments: true,
} satisfies Prisma.SaleInclude;

type SaleWithRelations = Prisma.SaleGetPayload<{ include: typeof saleInclude }>;

function moneyEqual(a: number, b: number): boolean {
  return Math.round(a * 100) === Math.round(b * 100);
}

function toNumber(value: { toString(): string } | number): number {
  return typeof value === "number" ? value : Number(value.toString());
}

/** M6 Batch C scalars — Prisma editor types can lag behind `prisma generate`. */
type SaleM6Fields = {
  receiptNo: string | null;
  loyaltyPrevious: number;
  loyaltyUsed: number;
  loyaltyEarned: number;
};

type SaleItemM6Fields = {
  fefoOverride: boolean;
  fefoAuthorizedByName: string | null;
  costPerBaseAtSale: { toString(): string } | number | null;
  productNameAtSale: string;
  productGenericNameAtSale: string | null;
  batchNumberAtSale: string;
  expiryDateAtSale: Date;
};

function withSaleM6<T>(sale: T): T & SaleM6Fields {
  return sale as T & SaleM6Fields;
}

function withSaleItemM6<T>(item: T): T & SaleItemM6Fields {
  return item as T & SaleItemM6Fields;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** `TXN-YYMMDD-HHmm` from soldAt (UTC). Suffix = last 2 alnum of eventId when needed. */
export function formatReceiptNo(
  soldAt: Date,
  eventId: string,
  withEventSuffix: boolean,
): string {
  const yy = pad2(soldAt.getUTCFullYear() % 100);
  const mo = pad2(soldAt.getUTCMonth() + 1);
  const dd = pad2(soldAt.getUTCDate());
  const hh = pad2(soldAt.getUTCHours());
  const mm = pad2(soldAt.getUTCMinutes());
  const base = `TXN-${yy}${mo}${dd}-${hh}${mm}`;
  if (!withEventSuffix) return base;
  const alnum = eventId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const tail = (alnum.slice(-2) || "XX").padStart(2, "X");
  return `${base}-${tail}`;
}

async function allocateReceiptNo(
  tx: Prisma.TransactionClient,
  tenantId: string,
  soldAt: Date,
  eventId: string,
): Promise<string> {
  const base = formatReceiptNo(soldAt, eventId, false);
  const taken = await tx.sale.findFirst({
    where: { tenantId, receiptNo: base },
    select: { id: true },
  });
  if (!taken) return base;

  const suffixed = formatReceiptNo(soldAt, eventId, true);
  const suffixTaken = await tx.sale.findFirst({
    where: { tenantId, receiptNo: suffixed },
    select: { id: true },
  });
  if (!suffixTaken) return suffixed;

  const alnum = eventId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const longTail = (alnum.slice(-16) || Date.now().toString(36)).toUpperCase();
  return `${base}-${longTail}`;
}

function p2002Target(err: unknown): string[] | null {
  if (!err || typeof err !== "object" || !("code" in err)) return null;
  if ((err as { code: string }).code !== "P2002") return null;
  const target = (err as { meta?: { target?: string | string[] } }).meta?.target;
  if (!target) return [];
  return Array.isArray(target) ? target : [target];
}

function isEventIdConflict(target: string[] | null): boolean {
  return Boolean(target && target.includes("eventId"));
}

function isReceiptNoConflict(target: string[] | null): boolean {
  return Boolean(target && target.includes("receiptNo"));
}

function serializeSale(sale: SaleWithRelations, role: Role) {
  const header = withSaleM6(sale);
  return {
    id: header.id,
    eventId: header.eventId,
    receiptNo: header.receiptNo,
    tenantId: header.tenantId,
    storeId: header.storeId,
    userId: header.userId,
    customerId: header.customerId,
    soldAt: header.soldAt,
    subtotal: toNumber(header.subtotal),
    discount: toNumber(header.discount),
    total: toNumber(header.total),
    notes: header.notes,
    loyaltyPrevious: header.loyaltyPrevious,
    loyaltyUsed: header.loyaltyUsed,
    loyaltyEarned: header.loyaltyEarned,
    createdAt: header.createdAt,
    items: header.items.map((item) => {
      const line = withSaleItemM6(item);
      const row: Record<string, unknown> = {
        id: line.id,
        productId: line.productId,
        batchId: line.batchId,
        unitType: line.unitType,
        unitQty: line.unitQty,
        quantityBase: line.quantityBase,
        unitPrice: toNumber(line.unitPrice),
        lineTotal: toNumber(line.lineTotal),
        fefoOverride: line.fefoOverride,
        fefoAuthorizedByName: line.fefoAuthorizedByName,
        productNameAtSale: line.productNameAtSale,
        productGenericNameAtSale: line.productGenericNameAtSale,
        batchNumberAtSale: line.batchNumberAtSale,
        expiryDateAtSale: line.expiryDateAtSale,
        batch: {
          ...serializeBatch(line.batch, role),
          batchNumber: line.batchNumberAtSale,
          expiryDate: line.expiryDateAtSale,
        },
      };
      if (role !== "CASHIER" && line.costPerBaseAtSale != null) {
        row.costPerBaseAtSale = toNumber(line.costPerBaseAtSale);
      }
      return row;
    }),
    payments: sale.payments.map((p) => ({
      id: p.id,
      method: p.method,
      amount: toNumber(p.amount),
      reference: p.reference,
      createdAt: p.createdAt,
    })),
  };
}

async function loadSaleByEventId(eventId: string, tenantId: string) {
  return prisma.sale.findFirst({
    where: { eventId, tenantId },
    include: saleInclude,
  });
}

export type IngestResult = {
  sale: ReturnType<typeof serializeSale>;
  idempotent: boolean;
};

export async function ingestSale(
  ctx: TenantContext,
  input: SaleIngestInput,
): Promise<IngestResult> {
  const existing = await loadSaleByEventId(input.eventId, ctx.tenantId);
  if (existing) {
    return {
      sale: serializeSale(existing, ctx.role),
      idempotent: true,
    };
  }

  await assertStoreAccess(ctx, input.storeId);

  const paymentSum = input.payments.reduce((sum, p) => sum + p.amount, 0);
  if (!moneyEqual(paymentSum, input.total)) {
    throw new AppError("Payment amounts must sum exactly to sale total", 400);
  }

  if (input.customerId) {
    const customer = await prisma.customer.findFirst({
      where: { id: input.customerId, tenantId: ctx.tenantId },
      select: { id: true, status: true },
    });
    if (!customer) {
      throw new AppError("Customer not found", 404);
    }
    if (customer.status !== "ACTIVE") {
      throw new AppError("Customer is not active", 400);
    }
  }

  // M6 Batch AX — validate shift if provided
  let shiftIdToLink: string | null = null;
  if (input.shiftId) {
    const shift = await prisma.shift.findFirst({
      where: {
        id: input.shiftId,
        tenantId: ctx.tenantId,
        storeId: input.storeId,
        userId: ctx.userId,
        status: "OPEN",
      },
      select: { id: true },
    });
    if (!shift) {
      throw new AppError(
        "No active shift found for this cashier/store — open a shift before recording sales",
        400,
      );
    }
    shiftIdToLink = shift.id;
  }

  type ResolvedLine = {
    productId: string;
    batchId: string;
    unitType: SaleIngestInput["items"][number]["unitType"];
    unitQty: number;
    quantityBase: number;
    unitPrice: number;
    lineTotal: number;
    fefoOverride: boolean;
    fefoAuthorizedByName: string | null;
    skippedBatchId: string | null;
  };

  const resolvedLines: ResolvedLine[] = [];

  for (const line of input.items) {
    const product = await prisma.product.findFirst({
      where: { id: line.productId, tenantId: ctx.tenantId, isActive: true },
      include: { units: true },
    });
    if (!product) {
      throw new AppError(`Product not found: ${line.productId}`, 404);
    }

    const unit = product.units.find((u) => u.unitType === line.unitType);
    if (!unit) {
      throw new AppError(
        `Unit type ${line.unitType} is not configured for product ${product.name}`,
        400,
      );
    }

    const expectedBase = line.unitQty * unit.factorToBase;
    if (expectedBase !== line.quantityBase) {
      throw new AppError(
        `quantityBase must equal unitQty × factorToBase (${expectedBase}) for product ${product.name}`,
        400,
      );
    }

    const expectedLineTotal = line.unitQty * line.unitPrice;
    if (!moneyEqual(expectedLineTotal, line.lineTotal)) {
      throw new AppError(
        `lineTotal must equal unitQty × unitPrice for product ${product.name}`,
        400,
      );
    }

    let batchId = line.batchId;

    if (batchId) {
      const batch = await prisma.batch.findFirst({
        where: {
          id: batchId,
          tenantId: ctx.tenantId,
          storeId: input.storeId,
          productId: line.productId,
        },
      });
      if (!batch) {
        throw new AppError(
          `Batch not found for product/store: ${batchId}`,
          404,
        );
      }
      if (batch.status !== "ACTIVE") {
        throw new AppError(
          `Batch ${batch.batchNumber} is ${batch.status.toLowerCase()} and cannot be sold; refresh catalog and select an active batch`,
          409,
        );
      }
      if (batch.quantityOnHand < line.quantityBase) {
        throw new AppError(
          `Insufficient stock on batch ${batch.batchNumber}`,
          409,
        );
      }
    } else {
      const fefo = await pickFefoBatch({
        tenantId: ctx.tenantId,
        storeId: input.storeId,
        productId: line.productId,
      });
      if (!fefo) {
        throw new AppError(
          `No in-stock FEFO batch for product ${product.name}`,
          409,
        );
      }
      if (fefo.quantityOnHand < line.quantityBase) {
        throw new AppError(
          `Insufficient stock on FEFO batch ${fefo.batchNumber}`,
          409,
        );
      }
      batchId = fefo.id;
    }

    const fefoOverride = line.fefoOverride === true;
    let skippedBatchId: string | null = null;
    if (fefoOverride) {
      const fefo = await pickFefoBatch({
        tenantId: ctx.tenantId,
        storeId: input.storeId,
        productId: line.productId,
      });
      if (fefo && fefo.id !== batchId) {
        skippedBatchId = fefo.id;
      }
    }
    resolvedLines.push({
      productId: line.productId,
      batchId,
      unitType: line.unitType,
      unitQty: line.unitQty,
      quantityBase: line.quantityBase,
      unitPrice: line.unitPrice,
      lineTotal: line.lineTotal,
      fefoOverride,
      fefoAuthorizedByName: fefoOverride
        ? (line.fefoAuthorizedByName ?? null)
        : null,
      skippedBatchId,
    });
  }

  const linesSubtotal = resolvedLines.reduce((s, l) => s + l.lineTotal, 0);
  if (!moneyEqual(linesSubtotal, input.subtotal)) {
    throw new AppError("subtotal must equal the sum of lineTotals", 400);
  }
  if (!moneyEqual(input.subtotal - input.discount, input.total)) {
    throw new AppError("total must equal subtotal − discount", 400);
  }

  const loyaltyFieldsPresent =
    input.loyaltyUsed !== undefined || input.loyaltyEarned !== undefined;

  let receiptRetry = 0;
  while (true) {
    try {
      const created = await prisma.$transaction(async (tx) => {
        // Re-check idempotency inside txn (race with concurrent ingest)
        const raced = await tx.sale.findFirst({
          where: { eventId: input.eventId, tenantId: ctx.tenantId },
          include: saleInclude,
        });
        if (raced) {
          return { sale: raced, idempotent: true as const };
        }

        const itemCreates: Array<{
          tenantId: string;
          productId: string;
          batchId: string;
          unitType: ResolvedLine["unitType"];
          unitQty: number;
          quantityBase: number;
          unitPrice: number;
          lineTotal: number;
          fefoOverride: boolean;
          fefoAuthorizedByName: string | null;
          costPerBaseAtSale: { toString(): string } | number;
          productNameAtSale: string;
          productGenericNameAtSale: string | null;
          batchNumberAtSale: string;
          expiryDateAtSale: Date;
        }> = [];
        const eventCreates: Array<{
          tenantId: string;
          storeId: string;
          productId: string;
          batchId: string;
          actorUserId: string;
          type: "SALE";
          quantityBaseChange: number;
          quantityAfter: number;
        }> = [];
        const fefoViolationCreates: Array<{
          productId: string;
          skippedBatchId: string;
          pickedBatchId: string;
          observedIssue: string;
          recommendedAction: string;
        }> = [];

        for (const line of resolvedLines) {
          const updated = await tx.batch.updateMany({
            where: {
              id: line.batchId,
              tenantId: ctx.tenantId,
              storeId: input.storeId,
              status: "ACTIVE",
              quantityOnHand: { gte: line.quantityBase },
            },
            data: {
              quantityOnHand: { decrement: line.quantityBase },
              version: { increment: 1 },
            },
          });
          if (updated.count !== 1) {
            const latest = await tx.batch.findFirst({
              where: { id: line.batchId, tenantId: ctx.tenantId },
              select: { batchNumber: true, status: true },
            });
            if (latest && latest.status !== "ACTIVE") {
              throw new AppError(
                `Batch ${latest.batchNumber} is ${latest.status.toLowerCase()} and cannot be sold; refresh catalog and select an active batch`,
                409,
              );
            }
            throw new AppError("Insufficient stock during sale commit", 409);
          }

          const batch = await tx.batch.findFirst({
            where: { id: line.batchId, tenantId: ctx.tenantId },
            select: {
              costPerBase: true,
              quantityOnHand: true,
              batchNumber: true,
              expiryDate: true,
              product: {
                select: { name: true, genericName: true },
              },
            },
          });
          if (!batch) {
            throw new AppError("Insufficient stock during sale commit", 409);
          }

          itemCreates.push({
            tenantId: ctx.tenantId,
            productId: line.productId,
            batchId: line.batchId,
            unitType: line.unitType,
            unitQty: line.unitQty,
            quantityBase: line.quantityBase,
            unitPrice: line.unitPrice,
            lineTotal: line.lineTotal,
            fefoOverride: line.fefoOverride,
            fefoAuthorizedByName: line.fefoAuthorizedByName,
            costPerBaseAtSale: batch.costPerBase,
            productNameAtSale: batch.product.name,
            productGenericNameAtSale: batch.product.genericName,
            batchNumberAtSale: batch.batchNumber,
            expiryDateAtSale: batch.expiryDate,
          });
          eventCreates.push({
            tenantId: ctx.tenantId,
            storeId: input.storeId,
            productId: line.productId,
            batchId: line.batchId,
            actorUserId: ctx.userId,
            type: "SALE",
            quantityBaseChange: -line.quantityBase,
            quantityAfter: batch.quantityOnHand,
          });

          if (line.fefoOverride && line.skippedBatchId) {
            fefoViolationCreates.push({
              productId: line.productId,
              skippedBatchId: line.skippedBatchId,
              pickedBatchId: line.batchId,
              observedIssue: "Sale used a non-FEFO batch override",
              recommendedAction: "Review authorization and coach cashier to pick the earliest eligible batch",
            });
          }
        }

        let loyaltyPrevious = 0;
        let loyaltyUsed = 0;
        let loyaltyEarned = 0;
        if (input.customerId && loyaltyFieldsPresent) {
          const customer = await tx.customer.findFirst({
            where: { id: input.customerId, tenantId: ctx.tenantId },
            select: { id: true, loyaltyPoints: true },
          });
          if (!customer) {
            throw new AppError("Customer not found", 404);
          }
          loyaltyPrevious = customer.loyaltyPoints;
          loyaltyUsed = input.loyaltyUsed ?? 0;
          loyaltyEarned = input.loyaltyEarned ?? 0;
          await tx.customer.update({
            where: { id: customer.id },
            data: {
              loyaltyPoints: Math.max(
                0,
                loyaltyPrevious - loyaltyUsed + loyaltyEarned,
              ),
            },
          });
        }

        const soldAt = input.soldAt ?? new Date();
        const receiptNo = await allocateReceiptNo(
          tx,
          ctx.tenantId,
          soldAt,
          input.eventId,
        );

        const sale = await tx.sale.create({
          data: {
            tenantId: ctx.tenantId,
            storeId: input.storeId,
            userId: ctx.userId,
            customerId: input.customerId,
            eventId: input.eventId,
            receiptNo,
            soldAt,
            subtotal: input.subtotal,
            discount: input.discount,
            total: input.total,
            notes: input.notes,
            loyaltyPrevious,
            loyaltyUsed,
            loyaltyEarned,
            shiftId: shiftIdToLink,
            items: { create: itemCreates },
            payments: {
              create: input.payments.map((p) => ({
                tenantId: ctx.tenantId,
                method: p.method,
                amount: p.amount,
                reference: p.reference,
              })),
            },
            inventoryEvents: { create: eventCreates },
          } as Prisma.SaleUncheckedCreateInput,
          include: saleInclude,
        });

        for (const violation of fefoViolationCreates) {
          const saleItem = sale.items.find(
            (item) =>
              item.productId === violation.productId &&
              item.batchId === violation.pickedBatchId,
          );
          await tx.fefoViolationRecord.create({
            data: {
              tenantId: ctx.tenantId,
              storeId: input.storeId,
              saleId: sale.id,
              saleItemId: saleItem?.id ?? null,
              productId: violation.productId,
              skippedBatchId: violation.skippedBatchId,
              pickedBatchId: violation.pickedBatchId,
              observedIssue: violation.observedIssue,
              recommendedAction: violation.recommendedAction,
              status: "OPEN",
            },
          });
        }

        return { sale, idempotent: false as const };
      });

      return {
        sale: serializeSale(created.sale, ctx.role),
        idempotent: created.idempotent,
      };
    } catch (err: unknown) {
      const target = p2002Target(err);
      if (isEventIdConflict(target)) {
        const again = await loadSaleByEventId(input.eventId, ctx.tenantId);
        if (again) {
          return {
            sale: serializeSale(again, ctx.role),
            idempotent: true,
          };
        }
      }
      if (isReceiptNoConflict(target) && receiptRetry < 2) {
        receiptRetry += 1;
        continue;
      }
      throw err;
    }
  }
}

const saleReadInclude = {
  items: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          genericName: true,
          sku: true,
          manufacturer: true,
          strength: true,
          form: true,
        },
      },
      batch: {
        select: {
          id: true,
          batchNumber: true,
          expiryDate: true,
        },
      },
    },
  },
  payments: true,
  customer: { select: { id: true, name: true, phone: true } },
  user: { select: { id: true, name: true } },
} satisfies Prisma.SaleInclude;

type SaleReadRow = Prisma.SaleGetPayload<{ include: typeof saleReadInclude }>;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function canSeeSaleCost(role: Role): boolean {
  return role === "OWNER";
}

function isUtcMidnight(d: Date): boolean {
  return (
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0
  );
}

function endOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
}

function saleStoreScope(ctx: TenantContext): Prisma.SaleWhereInput {
  if (ctx.role === "CASHIER" && ctx.storeId) {
    return { storeId: ctx.storeId };
  }
  return {};
}

function serializeSaleRead(sale: SaleReadRow, role: Role) {
  const header = withSaleM6(sale);
  const showCost = canSeeSaleCost(role);
  let cogs = 0;

  const items = header.items.map((item) => {
    const line = withSaleItemM6(item);
    const lineTotal = toNumber(line.lineTotal);
    const costSnapshot =
      line.costPerBaseAtSale != null ? toNumber(line.costPerBaseAtSale) : null;
    const lineCogs =
      costSnapshot == null ? 0 : round2(costSnapshot * line.quantityBase);
    cogs = round2(cogs + lineCogs);

    const row: Record<string, unknown> = {
      id: line.id,
      productId: line.productId,
      batchId: line.batchId,
      unitType: line.unitType,
      unitQty: line.unitQty,
      quantityBase: line.quantityBase,
      unitPrice: toNumber(line.unitPrice),
      lineTotal,
      fefoOverride: line.fefoOverride,
      fefoAuthorizedByName: line.fefoAuthorizedByName,
      product: {
        id: line.product.id,
        name: line.productNameAtSale,
        genericName: line.productGenericNameAtSale,
        sku: line.product.sku,
        manufacturer: line.product.manufacturer,
        strength: line.product.strength,
        form: line.product.form,
      },
      batch: {
        id: line.batch.id,
        batchNumber: line.batchNumberAtSale,
        expiryDate: line.expiryDateAtSale,
      },
    };

    if (showCost) {
      row.costPerBaseAtSale = costSnapshot;
      row.lineCogs = lineCogs;
      row.lineMargin = round2(lineTotal - lineCogs);
    }

    return row;
  });

  const total = toNumber(header.total);
  const result: Record<string, unknown> = {
    id: header.id,
    eventId: header.eventId,
    receiptNo: header.receiptNo,
    tenantId: header.tenantId,
    storeId: header.storeId,
    userId: header.userId,
    customerId: header.customerId,
    soldAt: header.soldAt,
    subtotal: toNumber(header.subtotal),
    discount: toNumber(header.discount),
    total,
    notes: header.notes,
    loyaltyPrevious: header.loyaltyPrevious,
    loyaltyUsed: header.loyaltyUsed,
    loyaltyEarned: header.loyaltyEarned,
    createdAt: header.createdAt,
    customer: header.customer
      ? {
          id: header.customer.id,
          name: header.customer.name,
          phone: header.customer.phone,
        }
      : null,
    cashier: {
      id: header.user.id,
      name: header.user.name,
    },
    items,
    payments: header.payments.map((p) => ({
      id: p.id,
      method: p.method,
      amount: toNumber(p.amount),
      reference: p.reference,
      createdAt: p.createdAt,
    })),
  };

  if (showCost) {
    result.cogs = cogs;
    result.netProfit = round2(total - cogs);
  }

  return result;
}

function listWhere(
  ctx: TenantContext,
  query: SaleListQuery,
): Prisma.SaleWhereInput {
  const q = query.q?.trim();
  const from = query.from;
  const to =
    query.to && isUtcMidnight(query.to) ? endOfUtcDay(query.to) : query.to;
  return {
    tenantId: ctx.tenantId,
    ...saleStoreScope(ctx),
    ...(query.userId ? { userId: query.userId } : {}),
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(from || to
      ? {
          soldAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
    ...(query.paymentMethod
      ? { payments: { some: { method: query.paymentMethod } } }
      : {}),
    ...(q
      ? {
          OR: [
            { receiptNo: { contains: q, mode: "insensitive" } },
            { eventId: { contains: q, mode: "insensitive" } },
            { customer: { name: { contains: q, mode: "insensitive" } } },
            { customer: { phone: { contains: q, mode: "insensitive" } } },
            { user: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  } as Prisma.SaleWhereInput;
}

export async function listSales(ctx: TenantContext, query: SaleListQuery) {
  const where = listWhere(ctx, query);
  const [rows, total] = await Promise.all([
    prisma.sale.findMany({
      where,
      include: saleReadInclude,
      orderBy: { soldAt: "desc" },
      take: query.limit,
      skip: query.offset,
    }),
    prisma.sale.count({ where }),
  ]);

  return {
    items: rows.map((row) => serializeSaleRead(row, ctx.role)),
    total,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function getSale(ctx: TenantContext, saleId: string) {
  const sale = await prisma.sale.findFirst({
    where: {
      id: saleId,
      tenantId: ctx.tenantId,
      ...saleStoreScope(ctx),
    },
    include: saleReadInclude,
  });
  if (!sale) {
    throw new AppError("Sale not found", 404);
  }
  return serializeSaleRead(sale, ctx.role);
}
