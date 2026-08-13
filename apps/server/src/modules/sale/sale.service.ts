import { prisma, type Prisma } from "@r2a/database";
import type { Role, SaleIngestInput } from "@r2a/shared-types";
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

function serializeSale(sale: SaleWithRelations, role: Role) {
  return {
    id: sale.id,
    eventId: sale.eventId,
    tenantId: sale.tenantId,
    storeId: sale.storeId,
    userId: sale.userId,
    customerId: sale.customerId,
    soldAt: sale.soldAt,
    subtotal: toNumber(sale.subtotal),
    discount: toNumber(sale.discount),
    total: toNumber(sale.total),
    notes: sale.notes,
    createdAt: sale.createdAt,
    items: sale.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      batchId: item.batchId,
      unitType: item.unitType,
      unitQty: item.unitQty,
      quantityBase: item.quantityBase,
      unitPrice: toNumber(item.unitPrice),
      lineTotal: toNumber(item.lineTotal),
      batch: serializeBatch(item.batch, role),
    })),
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
      select: { id: true },
    });
    if (!customer) {
      throw new AppError("Customer not found", 404);
    }
  }

  type ResolvedLine = {
    productId: string;
    batchId: string;
    unitType: SaleIngestInput["items"][number]["unitType"];
    unitQty: number;
    quantityBase: number;
    unitPrice: number;
    lineTotal: number;
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

    resolvedLines.push({
      productId: line.productId,
      batchId,
      unitType: line.unitType,
      unitQty: line.unitQty,
      quantityBase: line.quantityBase,
      unitPrice: line.unitPrice,
      lineTotal: line.lineTotal,
    });
  }

  const linesSubtotal = resolvedLines.reduce((s, l) => s + l.lineTotal, 0);
  if (!moneyEqual(linesSubtotal, input.subtotal)) {
    throw new AppError("subtotal must equal the sum of lineTotals", 400);
  }
  if (!moneyEqual(input.subtotal - input.discount, input.total)) {
    throw new AppError("total must equal subtotal − discount", 400);
  }

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

      for (const line of resolvedLines) {
        const updated = await tx.batch.updateMany({
          where: {
            id: line.batchId,
            tenantId: ctx.tenantId,
            storeId: input.storeId,
            quantityOnHand: { gte: line.quantityBase },
          },
          data: {
            quantityOnHand: { decrement: line.quantityBase },
          },
        });
        if (updated.count !== 1) {
          throw new AppError("Insufficient stock during sale commit", 409);
        }
      }

      const sale = await tx.sale.create({
        data: {
          tenantId: ctx.tenantId,
          storeId: input.storeId,
          userId: ctx.userId,
          customerId: input.customerId,
          eventId: input.eventId,
          soldAt: input.soldAt ?? new Date(),
          subtotal: input.subtotal,
          discount: input.discount,
          total: input.total,
          notes: input.notes,
          items: {
            create: resolvedLines.map((line) => ({
              tenantId: ctx.tenantId,
              productId: line.productId,
              batchId: line.batchId,
              unitType: line.unitType,
              unitQty: line.unitQty,
              quantityBase: line.quantityBase,
              unitPrice: line.unitPrice,
              lineTotal: line.lineTotal,
            })),
          },
          payments: {
            create: input.payments.map((p) => ({
              tenantId: ctx.tenantId,
              method: p.method,
              amount: p.amount,
              reference: p.reference,
            })),
          },
        },
        include: saleInclude,
      });

      return { sale, idempotent: false as const };
    });

    return {
      sale: serializeSale(created.sale, ctx.role),
      idempotent: created.idempotent,
    };
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      const again = await loadSaleByEventId(input.eventId, ctx.tenantId);
      if (again) {
        return {
          sale: serializeSale(again, ctx.role),
          idempotent: true,
        };
      }
    }
    throw err;
  }
}
