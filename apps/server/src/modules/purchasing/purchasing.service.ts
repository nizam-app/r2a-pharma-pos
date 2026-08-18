import { createHash } from "node:crypto";
import { Prisma, prisma } from "@r2a/database";
import type {
  GoodsReceiptCreateInput,
  PurchaseOrderCreateInput,
  PurchaseOrderDraftUpdateInput,
  PurchaseOrderLineInput,
  PurchaseOrderListQuery,
  ReturnManifestCompleteInput,
  ReturnManifestCreateInput,
  ReturnManifestDecisionInput,
  ReturnManifestDispatchInput,
  ReturnQueueQuery,
  SupplierCreateInput,
  SupplierListQuery,
  SupplierUpdateInput,
} from "@r2a/shared-types";
import type { TenantContext } from "../../types/tenant";
import { AppError } from "../../utils/AppError";

type DecimalLike = { toString(): string } | number;

function toNumber(value: DecimalLike): number {
  return typeof value === "number" ? value : Number(value.toString());
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

function purchaseOrderStoreScope(ctx: TenantContext): { storeId?: string } {
  return ctx.storeId ? { storeId: ctx.storeId } : {};
}

function serializeSupplier<T extends { minOrderValue: DecimalLike | null }>(
  supplier: T,
) {
  return {
    ...supplier,
    minOrderValue:
      supplier.minOrderValue == null ? null : toNumber(supplier.minOrderValue),
  };
}

function serializePurchaseOrder<T extends {
  estimatedSubtotal: DecimalLike;
  estimatedTax: DecimalLike;
  estimatedTotal: DecimalLike;
  lines?: Array<{ costPerBase: DecimalLike }>;
}>(purchaseOrder: T) {
  return {
    ...purchaseOrder,
    estimatedSubtotal: toNumber(purchaseOrder.estimatedSubtotal),
    estimatedTax: toNumber(purchaseOrder.estimatedTax),
    estimatedTotal: toNumber(purchaseOrder.estimatedTotal),
    ...(purchaseOrder.lines
      ? {
          lines: purchaseOrder.lines.map((line) => ({
            ...line,
            costPerBase: toNumber(line.costPerBase),
          })),
        }
      : {}),
  };
}

function serializeGoodsReceipt<T extends {
  lines: Array<{
    costPerBase: DecimalLike;
    sellPerBase: DecimalLike;
    batch?: {
      costPerBase: DecimalLike;
      sellPerBase: DecimalLike;
    };
  }>;
}>(receipt: T) {
  return {
    ...receipt,
    lines: receipt.lines.map((line) => ({
      ...line,
      costPerBase: toNumber(line.costPerBase),
      sellPerBase: toNumber(line.sellPerBase),
      ...(line.batch
        ? {
            batch: {
              ...line.batch,
              costPerBase: toNumber(line.batch.costPerBase),
              sellPerBase: toNumber(line.batch.sellPerBase),
            },
          }
        : {}),
    })),
  };
}

function serializeReturnManifest<T extends {
  lines: Array<{
    costPerBase: DecimalLike;
    batch: {
      costPerBase: DecimalLike;
      sellPerBase: DecimalLike;
    };
  }>;
}>(manifest: T) {
  return {
    ...manifest,
    lines: manifest.lines.map((line) => ({
      ...line,
      costPerBase: toNumber(line.costPerBase),
      batch: {
        ...line.batch,
        costPerBase: toNumber(line.batch.costPerBase),
        sellPerBase: toNumber(line.batch.sellPerBase),
      },
    })),
  };
}

const supplierCounts = {
  purchaseOrders: true,
  batches: true,
  returnManifests: true,
} as const;

const OPEN_PO_STATUSES: Array<"SENT" | "PARTIALLY_RECEIVED"> = [
  "SENT",
  "PARTIALLY_RECEIVED",
];

function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function startOfUtcMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

type SupplierStats = {
  activeProducts: number;
  lastPurchaseAt: string | null;
  openOrders: number;
  purchasesMtd: number;
};

async function supplierStatsBySupplier(
  ctx: TenantContext,
  supplierIds: string[],
): Promise<Map<string, SupplierStats>> {
  const stats = new Map<string, SupplierStats>();
  if (supplierIds.length === 0) return stats;
  for (const id of supplierIds) {
    stats.set(id, {
      activeProducts: 0,
      lastPurchaseAt: null,
      openOrders: 0,
      purchasesMtd: 0,
    });
  }
  const storeScope = purchaseOrderStoreScope(ctx);
  const monthStart = startOfUtcMonth(new Date());

  const [batchRows, lastPurchaseRows, openOrderRows, mtdRows] = await Promise.all([
    prisma.batch.findMany({
      where: {
        tenantId: ctx.tenantId,
        ...storeScope,
        supplierId: { in: supplierIds },
        status: "ACTIVE",
      },
      select: { supplierId: true, productId: true },
    }),
    prisma.purchaseOrder.groupBy({
      by: ["supplierId"],
      where: {
        tenantId: ctx.tenantId,
        ...storeScope,
        supplierId: { in: supplierIds },
      },
      _max: { createdAt: true },
    }),
    prisma.purchaseOrder.groupBy({
      by: ["supplierId"],
      where: {
        tenantId: ctx.tenantId,
        ...storeScope,
        supplierId: { in: supplierIds },
        status: { in: OPEN_PO_STATUSES },
      },
      _count: { _all: true },
    }),
    prisma.purchaseOrder.groupBy({
      by: ["supplierId"],
      where: {
        tenantId: ctx.tenantId,
        ...storeScope,
        supplierId: { in: supplierIds },
        createdAt: { gte: monthStart },
      },
      _sum: { estimatedTotal: true },
    }),
  ]);

  const productsBySupplier = new Map<string, Set<string>>();
  for (const row of batchRows) {
    if (!row.supplierId) continue;
    let products = productsBySupplier.get(row.supplierId);
    if (!products) {
      products = new Set();
      productsBySupplier.set(row.supplierId, products);
    }
    products.add(row.productId);
  }
  for (const [supplierId, products] of productsBySupplier) {
    const current = stats.get(supplierId);
    if (current) current.activeProducts = products.size;
  }
  for (const row of lastPurchaseRows) {
    const current = stats.get(row.supplierId);
    if (current && row._max.createdAt) {
      current.lastPurchaseAt = row._max.createdAt.toISOString();
    }
  }
  for (const row of openOrderRows) {
    const current = stats.get(row.supplierId);
    if (current) current.openOrders = row._count._all;
  }
  for (const row of mtdRows) {
    const current = stats.get(row.supplierId);
    if (current && row._sum.estimatedTotal != null) {
      current.purchasesMtd = roundMoney(toNumber(row._sum.estimatedTotal));
    }
  }
  return stats;
}

type SupplierOverview = {
  kpis: {
    activeSuppliers: number;
    onHoldSuppliers: number;
    openOrders: number;
    purchasesMtd: number;
    purchasesPrevMtd: number;
    avgDeliveryDays: number | null;
  };
  attention: {
    overdueOrders: Array<{
      id: string;
      poNumber: string;
      supplierId: string;
      supplierName: string | null;
      expectedDelivery: string | null;
      daysOverdue: number;
    }>;
    openOrders: number;
    returnQueue: number;
    onHoldSuppliers: Array<{ id: string; name: string }>;
  };
};

async function supplierOverview(ctx: TenantContext): Promise<SupplierOverview> {
  const storeScope = purchaseOrderStoreScope(ctx);
  const now = new Date();
  const dayStart = startOfUtcDay(now);
  const monthStart = startOfUtcMonth(now);
  const prevMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  );

  const [
    statusRows,
    openGrouped,
    mtdAgg,
    prevAgg,
    overdueRows,
    returnQueueCount,
    holdSuppliers,
    completedPos,
  ] = await Promise.all([
    prisma.supplier.groupBy({
      by: ["status"],
      where: { tenantId: ctx.tenantId },
      _count: { _all: true },
    }),
    prisma.purchaseOrder.groupBy({
      by: ["status"],
      where: {
        tenantId: ctx.tenantId,
        ...storeScope,
        status: { in: OPEN_PO_STATUSES },
      },
      _count: { _all: true },
    }),
    prisma.purchaseOrder.aggregate({
      where: {
        tenantId: ctx.tenantId,
        ...storeScope,
        createdAt: { gte: monthStart },
      },
      _sum: { estimatedTotal: true },
    }),
    prisma.purchaseOrder.aggregate({
      where: {
        tenantId: ctx.tenantId,
        ...storeScope,
        createdAt: { gte: prevMonthStart, lt: monthStart },
      },
      _sum: { estimatedTotal: true },
    }),
    prisma.purchaseOrder.findMany({
      where: {
        tenantId: ctx.tenantId,
        ...storeScope,
        status: { in: OPEN_PO_STATUSES },
        expectedDelivery: { not: null, lt: dayStart },
      },
      select: {
        id: true,
        poNumber: true,
        supplierId: true,
        supplier: { select: { name: true } },
        expectedDelivery: true,
      },
      orderBy: { expectedDelivery: "asc" as const },
      take: 3,
    }),
    prisma.batch.count({
      where: {
        tenantId: ctx.tenantId,
        ...storeScope,
        supplierId: { not: null },
        status: "ACTIVE",
        quantityOnHand: { gt: 0 },
        returnStatus: "ELIGIBLE",
      },
    }),
    prisma.supplier.findMany({
      where: { tenantId: ctx.tenantId, status: "HOLD" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 3,
    }),
    prisma.purchaseOrder.findMany({
      where: {
        tenantId: ctx.tenantId,
        ...storeScope,
        goodsReceipts: { some: {} },
      },
      select: {
        createdAt: true,
        goodsReceipts: {
          select: { receivedAt: true },
          orderBy: { receivedAt: "asc" as const },
          take: 1,
        },
      },
    }),
  ]);

  const statusCounts = new Map(
    statusRows.map((row) => [row.status, row._count._all] as const),
  );
  const openOrders = openGrouped.reduce((sum, row) => sum + row._count._all, 0);
  const purchasesMtd =
    mtdAgg._sum.estimatedTotal == null
      ? 0
      : roundMoney(toNumber(mtdAgg._sum.estimatedTotal));
  const purchasesPrevMtd =
    prevAgg._sum.estimatedTotal == null
      ? 0
      : roundMoney(toNumber(prevAgg._sum.estimatedTotal));

  let avgDeliveryDays: number | null = null;
  if (completedPos.length > 0) {
    const totalDays = completedPos.reduce((sum, po) => {
      const firstReceipt = po.goodsReceipts[0];
      if (!firstReceipt) return sum;
      const milliseconds = firstReceipt.receivedAt.getTime() - po.createdAt.getTime();
      return sum + Math.max(0, milliseconds) / 86_400_000;
    }, 0);
    avgDeliveryDays = Math.round((totalDays / completedPos.length) * 10) / 10;
  }

  return {
    kpis: {
      activeSuppliers: statusCounts.get("ACTIVE") ?? 0,
      onHoldSuppliers: statusCounts.get("HOLD") ?? 0,
      openOrders,
      purchasesMtd,
      purchasesPrevMtd,
      avgDeliveryDays,
    },
    attention: {
      overdueOrders: overdueRows.map((po) => ({
        id: po.id,
        poNumber: po.poNumber,
        supplierId: po.supplierId,
        supplierName: po.supplier?.name ?? null,
        expectedDelivery: po.expectedDelivery?.toISOString() ?? null,
        daysOverdue: po.expectedDelivery
          ? Math.max(
              1,
              Math.floor(
                (dayStart.getTime() - po.expectedDelivery.getTime()) / 86_400_000,
              ),
            )
          : 0,
      })),
      openOrders,
      returnQueue: returnQueueCount,
      onHoldSuppliers: holdSuppliers.map((supplier) => ({
        id: supplier.id,
        name: supplier.name,
      })),
    },
  };
}

const purchaseOrderListInclude = {
  supplier: {
    select: { id: true, name: true, status: true, phone: true },
  },
  createdBy: { select: { id: true, name: true } },
  _count: { select: { lines: true, goodsReceipts: true } },
} as const;

const purchaseOrderDetailInclude = {
  supplier: true,
  store: { select: { id: true, name: true, code: true } },
  createdBy: { select: { id: true, name: true } },
  lines: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          genericName: true,
          manufacturer: true,
          sku: true,
        },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
  goodsReceipts: {
    include: {
      receivedBy: { select: { id: true, name: true } },
      _count: { select: { lines: true } },
    },
    orderBy: { receivedAt: "desc" as const },
  },
} as const;

const goodsReceiptDetailInclude = {
  receivedBy: { select: { id: true, name: true } },
  lines: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          genericName: true,
          manufacturer: true,
          sku: true,
        },
      },
      batch: true,
    },
    orderBy: { createdAt: "asc" as const },
  },
} as const;

const returnManifestDetailInclude = {
  supplier: true,
  store: { select: { id: true, name: true, code: true } },
  preparedBy: { select: { id: true, name: true } },
  dispatchedBy: { select: { id: true, name: true } },
  decidedBy: { select: { id: true, name: true } },
  completedBy: { select: { id: true, name: true } },
  lines: {
    include: {
      batch: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              genericName: true,
              manufacturer: true,
              sku: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
} as const;

export async function listSuppliers(
  ctx: TenantContext,
  query: SupplierListQuery,
) {
  const where: Prisma.SupplierWhereInput = {
    tenantId: ctx.tenantId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: "insensitive" } },
            { contactPerson: { contains: query.q, mode: "insensitive" } },
            { phone: { contains: query.q, mode: "insensitive" } },
            { email: { contains: query.q, mode: "insensitive" } },
            { city: { contains: query.q, mode: "insensitive" } },
            {
              registrationNumber: {
                contains: query.q,
                mode: "insensitive",
              },
            },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.supplier.findMany({
      where,
      include: { _count: { select: supplierCounts } },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: query.limit,
      skip: query.offset,
    }),
    prisma.supplier.count({ where }),
  ]);

  const [stats, overview] = await Promise.all([
    supplierStatsBySupplier(
      ctx,
      items.map((supplier) => supplier.id),
    ),
    supplierOverview(ctx),
  ]);

  return {
    items: items.map((supplier) => ({
      ...serializeSupplier(supplier),
      stats: stats.get(supplier.id) ?? {
        activeProducts: 0,
        lastPurchaseAt: null,
        openOrders: 0,
        purchasesMtd: 0,
      },
    })),
    total,
    limit: query.limit,
    offset: query.offset,
    kpis: overview.kpis,
    attention: overview.attention,
  };
}

export async function createSupplier(
  ctx: TenantContext,
  input: SupplierCreateInput,
) {
  try {
    const supplier = await prisma.supplier.create({
      data: {
        tenantId: ctx.tenantId,
        name: input.name,
        contactPerson: input.contactPerson,
        phone: input.phone,
        email: input.email,
        address: input.address,
        city: input.city,
        registrationNumber: input.registrationNumber,
        notes: input.notes,
        paymentTerms: input.paymentTerms,
        leadTimeDays: input.leadTimeDays,
        minOrderValue: input.minOrderValue,
        status: input.status,
        expiryReturnsAccepted: input.expiryReturnsAccepted,
        minDaysBeforeExpiry: input.minDaysBeforeExpiry,
        returnNotes: input.returnNotes,
        preferredContact: input.preferredContact,
        secondaryPhone: input.secondaryPhone,
        isActive: input.isActive,
      },
      include: { _count: { select: supplierCounts } },
    });
    return serializeSupplier(supplier);
  } catch (error: unknown) {
    if (isUniqueConstraintError(error)) {
      throw new AppError(
        "Supplier name or registration number already exists in this tenant",
        409,
      );
    }
    throw error;
  }
}

export async function getSupplier(ctx: TenantContext, supplierId: string) {
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, tenantId: ctx.tenantId },
    include: { _count: { select: supplierCounts } },
  });
  if (!supplier) throw new AppError("Supplier not found", 404);
  return {
    ...serializeSupplier(supplier),
    detail: await supplierDetail(ctx, supplierId, supplier),
  };
}

type SupplierDetailProducts = Array<{
  productId: string;
  name: string;
  genericName: string | null;
  manufacturer: string | null;
  quantityOnHand: number;
  costPerBase: number;
  status: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
}>;

const SUPPLIER_DETAIL_PO_LIMIT = 10;
const SUPPLIER_DETAIL_PRODUCT_LIMIT = 10;

/**
 * Batch Z — Supplier Details. Honest KPIs/performance: computed from what
 * exists; null (→ "—") when there is no underlying data. Nothing is invented.
 */
async function supplierDetail(
  ctx: TenantContext,
  supplierId: string,
  supplier: { expiryReturnsAccepted: boolean },
) {
  const storeScope = purchaseOrderStoreScope(ctx);
  const now = new Date();
  const twelveMonthsAgo = new Date(
    Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), now.getUTCDate()),
  );

  const [
    purchases12mAgg,
    receiptRows,
    poRows,
    lineRows,
    returnLines,
    poValueAgg,
    lastPurchaseAgg,
    openOrders,
    creditRows,
    supplierBatches,
    poSourceLines,
  ] = await Promise.all([
    prisma.purchaseOrder.aggregate({
      where: {
        tenantId: ctx.tenantId,
        ...storeScope,
        supplierId,
        createdAt: { gte: twelveMonthsAgo },
      },
      _sum: { estimatedTotal: true },
    }),
    prisma.purchaseOrder.findMany({
      where: {
        tenantId: ctx.tenantId,
        ...storeScope,
        supplierId,
        goodsReceipts: { some: {} },
      },
      select: {
        createdAt: true,
        expectedDelivery: true,
        goodsReceipts: {
          select: { receivedAt: true },
          orderBy: { receivedAt: "asc" as const },
          take: 1,
        },
      },
    }),
    prisma.purchaseOrder.findMany({
      where: { tenantId: ctx.tenantId, ...storeScope, supplierId },
      select: {
        id: true,
        poNumber: true,
        createdAt: true,
        expectedDelivery: true,
        estimatedTotal: true,
        status: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: SUPPLIER_DETAIL_PO_LIMIT,
    }),
    prisma.purchaseOrderLine.findMany({
      where: {
        purchaseOrder: {
          tenantId: ctx.tenantId,
          ...storeScope,
          supplierId,
        },
      },
      select: { qtyOrdered: true, qtyReceived: true },
    }),
    prisma.returnManifestLine.findMany({
      where: {
        returnManifest: {
          tenantId: ctx.tenantId,
          ...storeScope,
          supplierId,
          status: { in: ["DISPATCHED", "ACCEPTED", "COMPLETED"] },
        },
      },
      select: { costPerBase: true, returnQty: true },
    }),
    prisma.purchaseOrder.aggregate({
      where: { tenantId: ctx.tenantId, ...storeScope, supplierId },
      _sum: { estimatedTotal: true },
    }),
    prisma.purchaseOrder.aggregate({
      where: { tenantId: ctx.tenantId, ...storeScope, supplierId },
      _max: { createdAt: true },
    }),
    prisma.purchaseOrder.count({
      where: {
        tenantId: ctx.tenantId,
        ...storeScope,
        supplierId,
        status: { in: OPEN_PO_STATUSES },
      },
    }),
    prisma.returnManifest.findMany({
      where: {
        tenantId: ctx.tenantId,
        ...storeScope,
        supplierId,
        status: { in: ["ACCEPTED", "COMPLETED"] },
        decidedAt: { not: null },
        dispatchedAt: { not: null },
      },
      select: { decidedAt: true, dispatchedAt: true },
    }),
    prisma.batch.findMany({
      where: {
        tenantId: ctx.tenantId,
        ...storeScope,
        supplierId,
        status: "ACTIVE",
      },
      select: {
        productId: true,
        costPerBase: true,
        product: {
          select: {
            id: true,
            name: true,
            genericName: true,
            manufacturer: true,
          },
        },
      },
      orderBy: { createdAt: "desc" as const },
    }),
    prisma.purchaseOrderLine.findMany({
      where: {
        purchaseOrder: {
          tenantId: ctx.tenantId,
          ...storeScope,
          supplierId,
        },
      },
      select: {
        productId: true,
        costPerBase: true,
        createdAt: true,
        product: {
          select: {
            id: true,
            name: true,
            genericName: true,
            manufacturer: true,
          },
        },
      },
      orderBy: { createdAt: "desc" as const },
    }),
  ]);

  const purchases12m =
    purchases12mAgg._sum.estimatedTotal == null
      ? 0
      : roundMoney(toNumber(purchases12mAgg._sum.estimatedTotal));

  let avgDeliveryDays: number | null = null;
  if (receiptRows.length > 0) {
    const totalDays = receiptRows.reduce((sum, po) => {
      const firstReceipt = po.goodsReceipts[0];
      if (!firstReceipt) return sum;
      const milliseconds =
        firstReceipt.receivedAt.getTime() - po.createdAt.getTime();
      return sum + Math.max(0, milliseconds) / 86_400_000;
    }, 0);
    avgDeliveryDays = Math.round((totalDays / receiptRows.length) * 10) / 10;
  }

  let onTimeEligible = 0;
  let onTimeCount = 0;
  for (const po of receiptRows) {
    const firstReceipt = po.goodsReceipts[0];
    if (!firstReceipt || !po.expectedDelivery) continue;
    onTimeEligible += 1;
    if (
      firstReceipt.receivedAt.getTime() <
      po.expectedDelivery.getTime() + 86_400_000
    ) {
      onTimeCount += 1;
    }
  }
  const onTimeDeliveryPct =
    onTimeEligible > 0
      ? Math.round((onTimeCount / onTimeEligible) * 1000) / 10
      : null;

  const deliveredLines = lineRows.filter((line) => line.qtyReceived > 0);
  const shortLines = deliveredLines.filter(
    (line) => line.qtyReceived < line.qtyOrdered,
  );
  const shortSupplyPct =
    deliveredLines.length > 0
      ? Math.round((shortLines.length / deliveredLines.length) * 1000) / 10
      : null;

  const returnValue = returnLines.reduce(
    (sum, line) => sum + toNumber(line.costPerBase) * line.returnQty,
    0,
  );
  const poValue =
    poValueAgg._sum.estimatedTotal == null
      ? 0
      : toNumber(poValueAgg._sum.estimatedTotal);
  const expiryReturnRatePct =
    returnLines.length > 0 && poValue > 0
      ? Math.round((returnValue / poValue) * 1000) / 10
      : null;

  let avgCreditNoteDays: number | null = null;
  if (creditRows.length > 0) {
    const totalDays = creditRows.reduce((sum, manifest) => {
      if (!manifest.decidedAt || !manifest.dispatchedAt) return sum;
      const milliseconds =
        manifest.decidedAt.getTime() - manifest.dispatchedAt.getTime();
      return sum + Math.max(0, milliseconds) / 86_400_000;
    }, 0);
    avgCreditNoteDays = Math.round((totalDays / creditRows.length) * 10) / 10;
  }

  const [stockRows, reorderRows] = await Promise.all([
    prisma.batch.groupBy({
      by: ["productId"],
      where: {
        tenantId: ctx.tenantId,
        ...storeScope,
        status: "ACTIVE",
      },
      _sum: { quantityOnHand: true },
    }),
    prisma.product.findMany({
      where: {
        tenantId: ctx.tenantId,
        id: {
          in: [...new Set([
            ...supplierBatches.map((batch) => batch.productId),
            ...poSourceLines.map((line) => line.productId),
          ])],
        },
      },
      select: { id: true, reorderLevel: true },
    }),
  ]);
  const stockByProduct = new Map<string, number>();
  for (const row of stockRows) {
    if (row._sum.quantityOnHand != null) {
      stockByProduct.set(row.productId, row._sum.quantityOnHand);
    }
  }
  const reorderByProduct = new Map<string, number | null>(
    reorderRows.map((row) => [row.id, row.reorderLevel] as const),
  );

  const productEntries = new Map<
    string,
    {
      productId: string;
      name: string;
      genericName: string | null;
      manufacturer: string | null;
      costPerBase: number;
    }
  >();
  for (const batch of supplierBatches) {
    if (productEntries.has(batch.productId)) continue;
    productEntries.set(batch.productId, {
      productId: batch.productId,
      name: batch.product.name,
      genericName: batch.product.genericName,
      manufacturer: batch.product.manufacturer,
      costPerBase: toNumber(batch.costPerBase),
    });
  }
  for (const line of poSourceLines) {
    if (productEntries.has(line.productId)) continue;
    productEntries.set(line.productId, {
      productId: line.productId,
      name: line.product.name,
      genericName: line.product.genericName,
      manufacturer: line.product.manufacturer,
      costPerBase: toNumber(line.costPerBase),
    });
  }

  const products: SupplierDetailProducts = [...productEntries.values()]
    .map((entry) => {
      const quantityOnHand = stockByProduct.get(entry.productId) ?? 0;
      const reorderLevel = reorderByProduct.get(entry.productId) ?? null;
      const status: SupplierDetailProducts[number]["status"] =
        quantityOnHand <= 0
          ? "OUT_OF_STOCK"
          : reorderLevel != null && quantityOnHand <= reorderLevel
            ? "LOW_STOCK"
            : "IN_STOCK";
      return { ...entry, quantityOnHand, status };
    })
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, SUPPLIER_DETAIL_PRODUCT_LIMIT);

  return {
    kpis: {
      purchases12m,
      avgDeliveryDays,
      expiryReturnRatePct,
      activeProducts: productEntries.size,
      openOrders,
      lastPurchaseAt: lastPurchaseAgg._max.createdAt?.toISOString() ?? null,
    },
    performance: {
      onTimeDeliveryPct,
      shortSupplyPct,
      expiryReturnsAcceptedPct: supplier.expiryReturnsAccepted ? 100 : 0,
      avgCreditNoteDays,
    },
    purchaseOrders: poRows.map((po) => ({
      id: po.id,
      poNumber: po.poNumber,
      createdAt: po.createdAt.toISOString(),
      expectedDelivery: po.expectedDelivery?.toISOString() ?? null,
      estimatedTotal: toNumber(po.estimatedTotal),
      status: po.status,
    })),
    products,
  };
}

export async function updateSupplier(
  ctx: TenantContext,
  supplierId: string,
  input: SupplierUpdateInput,
) {
  const existing = await prisma.supplier.findFirst({
    where: { id: supplierId, tenantId: ctx.tenantId },
    select: { id: true },
  });
  if (!existing) throw new AppError("Supplier not found", 404);

  try {
    const supplier = await prisma.supplier.update({
      where: { id: supplierId, tenantId: ctx.tenantId },
      data: input,
      include: { _count: { select: supplierCounts } },
    });
    return serializeSupplier(supplier);
  } catch (error: unknown) {
    if (isUniqueConstraintError(error)) {
      throw new AppError(
        "Supplier name or registration number already exists in this tenant",
        409,
      );
    }
    throw error;
  }
}

async function resolvePurchaseOrderStore(
  tx: Prisma.TransactionClient,
  ctx: TenantContext,
): Promise<string> {
  const store = ctx.storeId
    ? await tx.store.findFirst({
        where: { id: ctx.storeId, tenantId: ctx.tenantId, isActive: true },
        select: { id: true },
      })
    : await tx.store.findFirst({
        where: { tenantId: ctx.tenantId, isActive: true },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
  if (!store) throw new AppError("An active store is required", 400);
  return store.id;
}

async function validateSupplierAndLines(
  tx: Prisma.TransactionClient,
  tenantId: string,
  supplierId: string,
  lines: PurchaseOrderLineInput[],
): Promise<void> {
  const productIds = lines.map((line) => line.productId);
  if (new Set(productIds).size !== productIds.length) {
    throw new AppError("Each product may appear only once on a purchase order", 400);
  }

  const [supplier, productCount] = await Promise.all([
    tx.supplier.findFirst({
      where: { id: supplierId, tenantId },
      select: { id: true },
    }),
    tx.product.count({ where: { tenantId, id: { in: productIds } } }),
  ]);
  if (!supplier) throw new AppError("Supplier not found", 404);
  if (productCount !== productIds.length) {
    throw new AppError("One or more products were not found", 400);
  }
}

function calculatePurchaseOrderTotals(
  lines: PurchaseOrderLineInput[],
  estimatedTax: number,
) {
  const estimatedSubtotal = roundMoney(
    lines.reduce(
      (total, line) => total + line.qtyOrdered * line.costPerBase,
      0,
    ),
  );
  const tax = roundMoney(estimatedTax);
  return {
    estimatedSubtotal,
    estimatedTax: tax,
    estimatedTotal: roundMoney(estimatedSubtotal + tax),
  };
}

function poDatePrefix(now: Date): string {
  const yy = String(now.getUTCFullYear()).slice(-2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  return `PO-${yy}${mm}${dd}-`;
}

async function nextPurchaseOrderNumber(
  tx: Prisma.TransactionClient,
  tenantId: string,
  now: Date,
): Promise<string> {
  const prefix = poDatePrefix(now);
  await tx.$queryRaw<Array<{ locked: number }>>(
    Prisma.sql`SELECT 1::int AS "locked" FROM (SELECT pg_advisory_xact_lock(hashtext(${tenantId}), hashtext(${prefix}))) AS "po_lock"`,
  );
  const last = await tx.purchaseOrder.findFirst({
    where: { tenantId, poNumber: { startsWith: prefix } },
    orderBy: { poNumber: "desc" },
    select: { poNumber: true },
  });
  const previous = last ? Number(last.poNumber.slice(prefix.length)) : 0;
  const sequence = Number.isInteger(previous) ? previous + 1 : 1;
  if (sequence > 9999) {
    throw new AppError("Daily purchase order number limit reached", 409);
  }
  return `${prefix}${String(sequence).padStart(4, "0")}`;
}

async function createPurchaseOrderOnce(
  ctx: TenantContext,
  input: PurchaseOrderCreateInput,
) {
  return prisma.$transaction(async (tx) => {
    const storeId = await resolvePurchaseOrderStore(tx, ctx);
    await validateSupplierAndLines(
      tx,
      ctx.tenantId,
      input.supplierId,
      input.lines,
    );
    const totals = calculatePurchaseOrderTotals(
      input.lines,
      input.estimatedTax,
    );
    const poNumber = await nextPurchaseOrderNumber(tx, ctx.tenantId, new Date());

    return tx.purchaseOrder.create({
      data: {
        tenantId: ctx.tenantId,
        storeId,
        supplierId: input.supplierId,
        createdByUserId: ctx.userId,
        poNumber,
        status: input.status,
        reference: input.reference,
        expectedDelivery: input.expectedDelivery,
        ...totals,
        lines: {
          create: input.lines.map((line) => ({
            tenantId: ctx.tenantId,
            productId: line.productId,
            qtyOrdered: line.qtyOrdered,
            costPerBase: line.costPerBase,
          })),
        },
      },
      include: purchaseOrderDetailInclude,
    });
  });
}

export async function createPurchaseOrder(
  ctx: TenantContext,
  input: PurchaseOrderCreateInput,
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return serializePurchaseOrder(await createPurchaseOrderOnce(ctx, input));
    } catch (error: unknown) {
      if (isUniqueConstraintError(error) && attempt < 2) continue;
      if (isUniqueConstraintError(error)) {
        throw new AppError("Could not allocate a purchase order number", 409);
      }
      throw error;
    }
  }
  throw new AppError("Could not allocate a purchase order number", 409);
}

export async function listPurchaseOrders(
  ctx: TenantContext,
  query: PurchaseOrderListQuery,
) {
  const baseWhere: Prisma.PurchaseOrderWhereInput = {
    tenantId: ctx.tenantId,
    ...purchaseOrderStoreScope(ctx),
  };
  const where: Prisma.PurchaseOrderWhereInput = {
    ...baseWhere,
    ...(query.status ? { status: query.status } : {}),
    ...(query.supplierId ? { supplierId: query.supplierId } : {}),
    ...(query.q
      ? {
          OR: [
            { poNumber: { contains: query.q, mode: "insensitive" } },
            { reference: { contains: query.q, mode: "insensitive" } },
            {
              supplier: {
                name: { contains: query.q, mode: "insensitive" },
              },
            },
          ],
        }
      : {}),
  };

  const [items, total, grouped] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      include: purchaseOrderListInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit,
      skip: query.offset,
    }),
    prisma.purchaseOrder.count({ where }),
    prisma.purchaseOrder.groupBy({
      by: ["status"],
      where: baseWhere,
      _count: { _all: true },
      _sum: { estimatedTotal: true },
    }),
  ]);

  const byStatus = {
    DRAFT: 0,
    SENT: 0,
    PARTIALLY_RECEIVED: 0,
    RECEIVED: 0,
  };
  let openValue = 0;
  for (const row of grouped) {
    byStatus[row.status] = row._count._all;
    if (row.status === "SENT" || row.status === "PARTIALLY_RECEIVED") {
      openValue = roundMoney(
        openValue +
          (row._sum.estimatedTotal == null
            ? 0
            : toNumber(row._sum.estimatedTotal)),
      );
    }
  }

  return {
    items: items.map(serializePurchaseOrder),
    total,
    limit: query.limit,
    offset: query.offset,
    kpis: {
      total: Object.values(byStatus).reduce((sum, count) => sum + count, 0),
      byStatus,
      openValue,
    },
  };
}

export async function getPurchaseOrder(ctx: TenantContext, poId: string) {
  const purchaseOrder = await prisma.purchaseOrder.findFirst({
    where: {
      id: poId,
      tenantId: ctx.tenantId,
      ...purchaseOrderStoreScope(ctx),
    },
    include: purchaseOrderDetailInclude,
  });
  if (!purchaseOrder) throw new AppError("Purchase order not found", 404);
  return serializePurchaseOrder(purchaseOrder);
}

export async function updateDraftPurchaseOrder(
  ctx: TenantContext,
  poId: string,
  input: PurchaseOrderDraftUpdateInput,
) {
  const updated = await prisma.$transaction(async (tx) => {
    // Claim the row first so all reads and replacements use the latest draft.
    const claimed = await tx.purchaseOrder.updateMany({
      where: {
        id: poId,
        tenantId: ctx.tenantId,
        ...purchaseOrderStoreScope(ctx),
        status: "DRAFT",
      },
      data: { updatedAt: new Date() },
    });
    if (claimed.count !== 1) {
      const existing = await tx.purchaseOrder.findFirst({
        where: {
          id: poId,
          tenantId: ctx.tenantId,
          ...purchaseOrderStoreScope(ctx),
        },
        select: { id: true },
      });
      if (!existing) throw new AppError("Purchase order not found", 404);
      throw new AppError("Only draft purchase orders can be updated", 409);
    }

    const purchaseOrder = await tx.purchaseOrder.findFirst({
      where: {
        id: poId,
        tenantId: ctx.tenantId,
        ...purchaseOrderStoreScope(ctx),
      },
      include: { lines: true },
    });
    if (!purchaseOrder) throw new AppError("Purchase order not found", 404);

    const supplierId = input.supplierId ?? purchaseOrder.supplierId;
    const lines = input.lines ?? purchaseOrder.lines.map((line) => ({
      productId: line.productId,
      qtyOrdered: line.qtyOrdered,
      costPerBase: toNumber(line.costPerBase),
    }));
    await validateSupplierAndLines(tx, ctx.tenantId, supplierId, lines);
    const totals = calculatePurchaseOrderTotals(
      lines,
      input.estimatedTax ?? toNumber(purchaseOrder.estimatedTax),
    );

    if (input.lines) {
      await tx.purchaseOrderLine.deleteMany({
        where: { purchaseOrderId: poId, tenantId: ctx.tenantId },
      });
      await tx.purchaseOrderLine.createMany({
        data: input.lines.map((line) => ({
          tenantId: ctx.tenantId,
          purchaseOrderId: poId,
          productId: line.productId,
          qtyOrdered: line.qtyOrdered,
          costPerBase: line.costPerBase,
        })),
      });
    }

    return tx.purchaseOrder.update({
      where: { id: poId, tenantId: ctx.tenantId },
      data: {
        supplierId: input.supplierId,
        status: input.status,
        reference: input.reference,
        expectedDelivery: input.expectedDelivery,
        ...totals,
      },
      include: purchaseOrderDetailInclude,
    });
  });

  return serializePurchaseOrder(updated);
}

function grnDatePrefix(now: Date): string {
  const yy = String(now.getUTCFullYear()).slice(-2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `GRN-${yy}${mm}-`;
}

function returnManifestDatePrefix(now: Date): string {
  const yy = String(now.getUTCFullYear()).slice(-2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  return `SRM-${yy}${mm}${dd}-`;
}

async function nextGoodsReceiptNumber(
  tx: Prisma.TransactionClient,
  tenantId: string,
  now: Date,
): Promise<string> {
  const prefix = grnDatePrefix(now);
  await tx.$queryRaw<Array<{ locked: number }>>(
    Prisma.sql`SELECT 1::int AS "locked" FROM (SELECT pg_advisory_xact_lock(hashtext(${tenantId}), hashtext(${prefix}))) AS "grn_lock"`,
  );
  const last = await tx.goodsReceipt.findFirst({
    where: { tenantId, grnNumber: { startsWith: prefix } },
    orderBy: { grnNumber: "desc" },
    select: { grnNumber: true },
  });
  const previous = last ? Number(last.grnNumber.slice(prefix.length)) : 0;
  const sequence = Number.isInteger(previous) ? previous + 1 : 1;
  if (sequence > 9999) {
    throw new AppError("Monthly goods receipt number limit reached", 409);
  }
  return `${prefix}${String(sequence).padStart(4, "0")}`;
}

async function nextReturnManifestNumber(
  tx: Prisma.TransactionClient,
  tenantId: string,
  now: Date,
): Promise<string> {
  const prefix = returnManifestDatePrefix(now);
  await tx.$queryRaw<Array<{ locked: number }>>(
    Prisma.sql`SELECT 1::int AS "locked" FROM (SELECT pg_advisory_xact_lock(hashtext(${tenantId}), hashtext(${prefix}))) AS "srm_lock"`,
  );
  const last = await tx.returnManifest.findFirst({
    where: { tenantId, srmNumber: { startsWith: prefix } },
    orderBy: { srmNumber: "desc" },
    select: { srmNumber: true },
  });
  const previous = last ? Number(last.srmNumber.slice(prefix.length)) : 0;
  const sequence = Number.isInteger(previous) ? previous + 1 : 1;
  if (sequence > 9999) {
    throw new AppError("Daily return manifest number limit reached", 409);
  }
  return `${prefix}${String(sequence).padStart(4, "0")}`;
}

export async function createGoodsReceipt(
  ctx: TenantContext,
  poId: string,
  input: GoodsReceiptCreateInput,
) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ locked: number }>>(
        Prisma.sql`SELECT 1::int AS "locked" FROM (SELECT pg_advisory_xact_lock(hashtext(${ctx.tenantId}), hashtext(${poId}))) AS "receipt_lock"`,
      );
      const purchaseOrder = await tx.purchaseOrder.findFirst({
        where: {
          id: poId,
          tenantId: ctx.tenantId,
          ...purchaseOrderStoreScope(ctx),
        },
        include: { supplier: true, lines: true },
      });
      if (!purchaseOrder) throw new AppError("Purchase order not found", 404);
      if (
        purchaseOrder.status !== "SENT" &&
        purchaseOrder.status !== "PARTIALLY_RECEIVED"
      ) {
        throw new AppError("Only sent purchase orders can receive stock", 409);
      }

      const poLineById = new Map(
        purchaseOrder.lines.map((line) => [line.id, line]),
      );
      const receivedByLine = new Map<string, number>();
      const batchKeys = new Set<string>();
      for (const line of input.lines) {
        const poLine = poLineById.get(line.purchaseOrderLineId);
        if (!poLine || poLine.productId !== line.productId) {
          throw new AppError(
            "Each receipt line must match a product on this purchase order",
            400,
          );
        }
        receivedByLine.set(
          poLine.id,
          (receivedByLine.get(poLine.id) ?? 0) + line.qty,
        );
        const batchKey = `${line.productId}\u0000${line.batchNumber}`;
        if (batchKeys.has(batchKey)) {
          throw new AppError(
            "A batch number may appear only once per product in a receipt",
            400,
          );
        }
        batchKeys.add(batchKey);
      }
      for (const [lineId, qty] of receivedByLine) {
        const poLine = poLineById.get(lineId)!;
        if (poLine.qtyReceived + qty > poLine.qtyOrdered) {
          throw new AppError("Receipt quantity exceeds the purchase order", 409);
        }
      }

      const receivedAt = input.receivedAt ?? new Date();
      const grnNumber = await nextGoodsReceiptNumber(
        tx,
        ctx.tenantId,
        receivedAt,
      );
      const receipt = await tx.goodsReceipt.create({
        data: {
          tenantId: ctx.tenantId,
          storeId: purchaseOrder.storeId,
          purchaseOrderId: purchaseOrder.id,
          receivedByUserId: ctx.userId,
          grnNumber,
          supplierInvoiceRef: input.supplierInvoiceRef,
          deliveryNote: input.deliveryNote,
          receivedAt,
        },
      });

      for (const line of input.lines) {
        const batch = await tx.batch.create({
          data: {
            tenantId: ctx.tenantId,
            storeId: purchaseOrder.storeId,
            productId: line.productId,
            supplierId: purchaseOrder.supplierId,
            batchNumber: line.batchNumber,
            expiryDate: line.expiryDate,
            quantityOnHand: line.qty,
            costPerBase: line.costPerBase,
            sellPerBase: line.sellPerBase,
            supplierName: purchaseOrder.supplier.name,
            returnStatus: purchaseOrder.supplier.expiryReturnsAccepted
              ? "ELIGIBLE"
              : "NOT_ELIGIBLE",
          },
        });
        await tx.inventoryEvent.create({
          data: {
            tenantId: ctx.tenantId,
            storeId: purchaseOrder.storeId,
            productId: line.productId,
            batchId: batch.id,
            actorUserId: ctx.userId,
            type: "RECEIVE",
            quantityBaseChange: line.qty,
            quantityAfter: line.qty,
            reasonCode: "PURCHASE_ORDER_RECEIPT",
            note: grnNumber,
          },
        });
        await tx.goodsReceiptLine.create({
          data: {
            tenantId: ctx.tenantId,
            goodsReceiptId: receipt.id,
            purchaseOrderLineId: line.purchaseOrderLineId,
            productId: line.productId,
            batchId: batch.id,
            qty: line.qty,
            batchNumber: line.batchNumber,
            expiryDate: line.expiryDate,
            costPerBase: line.costPerBase,
            sellPerBase: line.sellPerBase,
          },
        });
      }

      for (const [lineId, qty] of receivedByLine) {
        await tx.purchaseOrderLine.update({
          where: { id: lineId },
          data: { qtyReceived: { increment: qty } },
        });
      }
      const allReceived = purchaseOrder.lines.every(
        (line) =>
          line.qtyReceived + (receivedByLine.get(line.id) ?? 0) >=
          line.qtyOrdered,
      );
      await tx.purchaseOrder.update({
        where: { id: purchaseOrder.id },
        data: { status: allReceived ? "RECEIVED" : "PARTIALLY_RECEIVED" },
      });

      const [createdReceipt, updatedPurchaseOrder] = await Promise.all([
        tx.goodsReceipt.findUniqueOrThrow({
          where: { id: receipt.id },
          include: goodsReceiptDetailInclude,
        }),
        tx.purchaseOrder.findUniqueOrThrow({
          where: { id: purchaseOrder.id },
          include: purchaseOrderDetailInclude,
        }),
      ]);
      return { receipt: createdReceipt, purchaseOrder: updatedPurchaseOrder };
    });
    return {
      receipt: serializeGoodsReceipt(result.receipt),
      purchaseOrder: serializePurchaseOrder(result.purchaseOrder),
    };
  } catch (error: unknown) {
    if (isUniqueConstraintError(error)) {
      throw new AppError(
        "A received batch number already exists for this product/store",
        409,
      );
    }
    throw error;
  }
}

export async function listReturnQueue(
  ctx: TenantContext,
  query: ReturnQueueQuery,
) {
  const where: Prisma.BatchWhereInput = {
    tenantId: ctx.tenantId,
    ...purchaseOrderStoreScope(ctx),
    supplierId: { not: null },
    status: "ACTIVE",
    quantityOnHand: { gt: 0 },
    ...(query.supplierId ? { supplierId: query.supplierId } : {}),
    ...(query.returnStatus ? { returnStatus: query.returnStatus } : {}),
    ...(query.q
      ? {
          OR: [
            { batchNumber: { contains: query.q, mode: "insensitive" } },
            { supplierName: { contains: query.q, mode: "insensitive" } },
            {
              product: { name: { contains: query.q, mode: "insensitive" } },
            },
            {
              product: {
                genericName: { contains: query.q, mode: "insensitive" },
              },
            },
            {
              supplier: { name: { contains: query.q, mode: "insensitive" } },
            },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.batch.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            genericName: true,
            manufacturer: true,
            sku: true,
          },
        },
        supplier: true,
      },
      orderBy: [{ expiryDate: "asc" }, { id: "asc" }],
      take: query.limit,
      skip: query.offset,
    }),
    prisma.batch.count({ where }),
  ]);
  return {
    items: items.map((batch) => ({
      ...batch,
      costPerBase: toNumber(batch.costPerBase),
      sellPerBase: toNumber(batch.sellPerBase),
      costValue: roundMoney(batch.quantityOnHand * toNumber(batch.costPerBase)),
      supplier: batch.supplier ? serializeSupplier(batch.supplier) : null,
    })),
    total,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function createReturnManifest(
  ctx: TenantContext,
  input: ReturnManifestCreateInput,
) {
  const manifest = await prisma.$transaction(async (tx) => {
    const supplier = await tx.supplier.findFirst({
      where: { id: input.supplierId, tenantId: ctx.tenantId },
    });
    if (!supplier) throw new AppError("Supplier not found", 404);
    if (!supplier.expiryReturnsAccepted) {
      throw new AppError("Supplier does not accept expiry returns", 409);
    }

    const batchIds = input.lines.map((line) => line.batchId);
    if (new Set(batchIds).size !== batchIds.length) {
      throw new AppError("Each batch may appear only once on a manifest", 400);
    }
    const batches = await tx.batch.findMany({
      where: {
        id: { in: batchIds },
        tenantId: ctx.tenantId,
        ...purchaseOrderStoreScope(ctx),
      },
    });
    if (batches.length !== batchIds.length) {
      throw new AppError("One or more return batches were not found", 400);
    }
    const batchById = new Map(batches.map((batch) => [batch.id, batch]));
    const storeIds = new Set(batches.map((batch) => batch.storeId));
    if (storeIds.size !== 1) {
      throw new AppError("All manifest batches must belong to one store", 400);
    }
    for (const line of input.lines) {
      const batch = batchById.get(line.batchId)!;
      if (batch.supplierId !== input.supplierId) {
        throw new AppError("All manifest batches must use the same supplier", 400);
      }
      if (batch.status !== "ACTIVE" || batch.returnStatus !== "ELIGIBLE") {
        throw new AppError("Only eligible active batches can be prepared", 409);
      }
      if (line.returnQty > batch.quantityOnHand) {
        throw new AppError("Return quantity exceeds stock on hand", 409);
      }
    }

    const now = new Date();
    const srmNumber = await nextReturnManifestNumber(tx, ctx.tenantId, now);
    const created = await tx.returnManifest.create({
      data: {
        tenantId: ctx.tenantId,
        storeId: batches[0]!.storeId,
        supplierId: input.supplierId,
        preparedByUserId: ctx.userId,
        srmNumber,
        preparedAt: now,
        notes: input.notes,
        lines: {
          create: input.lines.map((line) => ({
            tenantId: ctx.tenantId,
            batchId: line.batchId,
            returnQty: line.returnQty,
            costPerBase: batchById.get(line.batchId)!.costPerBase,
          })),
        },
      },
      select: { id: true },
    });
    for (const batch of batches) {
      const updated = await tx.batch.updateMany({
        where: {
          id: batch.id,
          tenantId: ctx.tenantId,
          status: "ACTIVE",
          returnStatus: "ELIGIBLE",
          version: batch.version,
        },
        data: {
          returnStatus: "MANIFEST_PREPARED",
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        throw new AppError("A return batch changed while preparing the manifest", 409);
      }
    }
    return tx.returnManifest.findUniqueOrThrow({
      where: { id: created.id },
      include: returnManifestDetailInclude,
    });
  });
  return serializeReturnManifest(manifest);
}

export async function getReturnManifest(
  ctx: TenantContext,
  manifestId: string,
) {
  const manifest = await prisma.returnManifest.findFirst({
    where: {
      id: manifestId,
      tenantId: ctx.tenantId,
      ...purchaseOrderStoreScope(ctx),
    },
    include: returnManifestDetailInclude,
  });
  if (!manifest) throw new AppError("Return manifest not found", 404);
  return serializeReturnManifest(manifest);
}

function dispatchEventId(operationId: string, lineId: string): string {
  const digest = createHash("sha256")
    .update(`${operationId}\u0000${lineId}`)
    .digest("hex");
  return `return-dispatch:${digest}`;
}

async function dispatchReplay(
  ctx: TenantContext,
  manifestId: string,
  operationId: string,
) {
  const manifest = await prisma.returnManifest.findUnique({
    where: { dispatchOperationId: operationId },
    include: returnManifestDetailInclude,
  });
  if (!manifest) return null;
  if (
    manifest.id !== manifestId ||
    manifest.tenantId !== ctx.tenantId ||
    manifest.status === "PREPARED"
  ) {
    throw new AppError("operationId is already used for another dispatch", 409);
  }
  return { manifest: serializeReturnManifest(manifest), idempotent: true };
}

export async function dispatchReturnManifest(
  ctx: TenantContext,
  manifestId: string,
  input: ReturnManifestDispatchInput,
) {
  const replay = await dispatchReplay(ctx, manifestId, input.operationId);
  if (replay) return replay;

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ locked: number }>>(
        Prisma.sql`SELECT 1::int AS "locked" FROM (SELECT pg_advisory_xact_lock(hashtext(${ctx.tenantId}), hashtext(${manifestId}))) AS "dispatch_lock"`,
      );
      const current = await tx.returnManifest.findFirst({
        where: {
          id: manifestId,
          tenantId: ctx.tenantId,
          ...purchaseOrderStoreScope(ctx),
        },
        include: { lines: { include: { batch: true } } },
      });
      if (!current) throw new AppError("Return manifest not found", 404);
      if (
        current.status === "DISPATCHED" &&
        current.dispatchOperationId === input.operationId
      ) {
        const existing = await tx.returnManifest.findUniqueOrThrow({
          where: { id: manifestId },
          include: returnManifestDetailInclude,
        });
        return { manifest: existing, idempotent: true };
      }
      if (current.status !== "PREPARED") {
        throw new AppError("Only prepared manifests can be dispatched", 409);
      }

      for (const line of current.lines) {
        const updated = await tx.batch.updateMany({
          where: {
            id: line.batchId,
            tenantId: ctx.tenantId,
            storeId: current.storeId,
            status: "ACTIVE",
            returnStatus: "MANIFEST_PREPARED",
            version: line.batch.version,
            quantityOnHand: { gte: line.returnQty },
          },
          data: {
            quantityOnHand: { decrement: line.returnQty },
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) {
          const latest = await tx.batch.findFirst({
            where: { id: line.batchId, tenantId: ctx.tenantId },
            select: { quantityOnHand: true, version: true },
          });
          if (latest && latest.quantityOnHand < line.returnQty) {
            throw new AppError("Insufficient stock to dispatch this return", 409);
          }
          throw new AppError("A return batch changed before dispatch", 409);
        }
        const updatedBatch = await tx.batch.findUniqueOrThrow({
          where: { id: line.batchId },
        });
        await tx.inventoryEvent.create({
          data: {
            tenantId: ctx.tenantId,
            storeId: current.storeId,
            productId: line.batch.productId,
            batchId: line.batchId,
            actorUserId: ctx.userId,
            eventId: dispatchEventId(input.operationId, line.id),
            type: "ADJUST",
            quantityBaseChange: -line.returnQty,
            quantityAfter: updatedBatch.quantityOnHand,
            reasonCode: "SUPPLIER_RETURN_DISPATCH",
            note: input.dispatchNotes,
          },
        });
      }
      await tx.returnManifest.update({
        where: { id: manifestId },
        data: {
          status: "DISPATCHED",
          dispatchOperationId: input.operationId,
          dispatchReference: input.dispatchReference,
          dispatchNotes: input.dispatchNotes,
          dispatchedAt: input.dispatchedAt ?? new Date(),
          dispatchedByUserId: ctx.userId,
        },
      });
      const dispatched = await tx.returnManifest.findUniqueOrThrow({
        where: { id: manifestId },
        include: returnManifestDetailInclude,
      });
      return { manifest: dispatched, idempotent: false };
    });
    return {
      manifest: serializeReturnManifest(result.manifest),
      idempotent: result.idempotent,
    };
  } catch (error: unknown) {
    if (
      isUniqueConstraintError(error) ||
      (error instanceof AppError && error.statusCode === 409)
    ) {
      const raced = await dispatchReplay(ctx, manifestId, input.operationId);
      if (raced) return raced;
    }
    throw error;
  }
}

export async function decideReturnManifest(
  ctx: TenantContext,
  manifestId: string,
  input: ReturnManifestDecisionInput,
) {
  const updated = await prisma.returnManifest.updateMany({
    where: {
      id: manifestId,
      tenantId: ctx.tenantId,
      ...purchaseOrderStoreScope(ctx),
      status: "DISPATCHED",
    },
    data: {
      status: input.decision,
      supplierReference: input.supplierReference,
      decisionNotes: input.notes,
      decidedAt: input.decidedAt ?? new Date(),
      decidedByUserId: ctx.userId,
    },
  });
  if (updated.count !== 1) {
    const existing = await prisma.returnManifest.findFirst({
      where: {
        id: manifestId,
        tenantId: ctx.tenantId,
        ...purchaseOrderStoreScope(ctx),
      },
      select: { status: true },
    });
    if (!existing) throw new AppError("Return manifest not found", 404);
    throw new AppError("Only dispatched manifests can record a decision", 409);
  }
  return getReturnManifest(ctx, manifestId);
}

export async function completeReturnManifest(
  ctx: TenantContext,
  manifestId: string,
  input: ReturnManifestCompleteInput,
) {
  const updated = await prisma.returnManifest.updateMany({
    where: {
      id: manifestId,
      tenantId: ctx.tenantId,
      ...purchaseOrderStoreScope(ctx),
      status: "ACCEPTED",
    },
    data: {
      status: "COMPLETED",
      completedAt: input.completedAt ?? new Date(),
      completedByUserId: ctx.userId,
    },
  });
  if (updated.count !== 1) {
    const existing = await prisma.returnManifest.findFirst({
      where: {
        id: manifestId,
        tenantId: ctx.tenantId,
        ...purchaseOrderStoreScope(ctx),
      },
      select: { status: true },
    });
    if (!existing) throw new AppError("Return manifest not found", 404);
    throw new AppError("Only accepted manifests can be completed", 409);
  }
  return getReturnManifest(ctx, manifestId);
}
