import { prisma } from "@r2a/database";
import type {
  ExpiryBucket,
  OwnerDashboardQuery,
  OwnerExpiryQuery,
  OwnerInventoryQuery,
  OwnerInventoryTab,
} from "@r2a/shared-types";
import { AppError } from "../../utils/AppError";
import type { TenantContext } from "../../types/tenant";

type DecimalLike = { toString(): string } | number;

function toNumber(value: DecimalLike): number {
  return typeof value === "number" ? value : Number(value.toString());
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function startOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
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

function addUtcDays(d: Date, n: number): Date {
  const next = startOfUtcDay(d);
  next.setUTCDate(next.getUTCDate() + n);
  return next;
}

function isUtcMidnight(d: Date): boolean {
  return (
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0
  );
}

function utcDateKey(d: Date): string {
  return startOfUtcDay(d).toISOString().slice(0, 10);
}

function daysUntilExpiry(expiry: Date, today: Date): number {
  const e = startOfUtcDay(expiry).getTime();
  const t = startOfUtcDay(today).getTime();
  return Math.round((e - t) / 86_400_000);
}

function bucketForDays(days: number): ExpiryBucket | null {
  if (days < 0) return "expired";
  if (days <= 30) return "0_30";
  if (days <= 60) return "31_60";
  if (days <= 90) return "61_90";
  return null;
}

function storeScope(ctx: TenantContext): { storeId?: string } {
  return ctx.storeId ? { storeId: ctx.storeId } : {};
}

const MFS_PROVIDERS = ["BKASH", "NAGAD", "ROCKET"] as const;
type MfsProviderId = (typeof MFS_PROVIDERS)[number];

/** POS ingest stores `mfs:provider=BKASH` (etc.) in sale.notes. */
function parseMfsProvider(notes: string | null | undefined): MfsProviderId | null {
  if (!notes) return null;
  const match = /mfs:provider=(BKASH|NAGAD|ROCKET)\b/i.exec(notes);
  const id = match?.[1]?.toUpperCase();
  return MFS_PROVIDERS.find((p) => p === id) ?? null;
}

/** Inclusive calendar range. Default = last 7 UTC days including today. */
export function resolveDashboardRange(query: OwnerDashboardQuery): {
  from: Date;
  to: Date;
} {
  const now = new Date();
  const to = query.to
    ? isUtcMidnight(query.to)
      ? endOfUtcDay(query.to)
      : query.to
    : now;
  const from = query.from
    ? startOfUtcDay(query.from)
    : startOfUtcDay(addUtcDays(query.to ?? now, -6));

  if (from.getTime() > to.getTime()) {
    throw new AppError("from must be before to", 400);
  }
  const spanDays =
    (startOfUtcDay(to).getTime() - startOfUtcDay(from).getTime()) /
      86_400_000 +
    1;
  if (spanDays > 366) {
    throw new AppError("date range cannot exceed 366 days", 400);
  }
  return { from, to };
}

type Trend = "up" | "down" | "steady";

function kpiBlock(sales: number, netProfit: number, txnCount: number) {
  return {
    sales: round2(sales),
    netProfit: round2(netProfit),
    txnCount,
    avgSale: txnCount > 0 ? round2(sales / txnCount) : 0,
  };
}

function vsYesterday(
  today: ReturnType<typeof kpiBlock>,
  yesterday: ReturnType<typeof kpiBlock>,
) {
  const field = (a: number, b: number) => {
    const delta = round2(a - b);
    const deltaPct = b === 0 ? (a === 0 ? 0 : null) : round2((delta / b) * 100);
    let trend: Trend = "steady";
    if (deltaPct === null) {
      trend = a > 0 ? "up" : "steady";
    } else if (Math.abs(deltaPct) >= 1) {
      trend = deltaPct > 0 ? "up" : "down";
    }
    return { delta, deltaPct, trend };
  };
  return {
    sales: field(today.sales, yesterday.sales),
    netProfit: field(today.netProfit, yesterday.netProfit),
    txnCount: field(today.txnCount, yesterday.txnCount),
    avgSale: field(today.avgSale, yesterday.avgSale),
  };
}

function vsPrevGross(gross: number, prevGross: number) {
  const delta = round2(gross - prevGross);
  const deltaPct =
    prevGross === 0 ? (gross === 0 ? 0 : null) : round2((delta / prevGross) * 100);
  let trend: Trend = "steady";
  if (deltaPct === null) {
    trend = gross > 0 ? "up" : "steady";
  } else if (Math.abs(deltaPct) >= 1) {
    trend = deltaPct > 0 ? "up" : "down";
  }
  return { delta, deltaPct, trend };
}

function pickTopCashier(
  cashiers: Map<string, { name: string; sales: number; txnCount: number }>,
): { userId: string; name: string; sales: number; txnCount: number } | null {
  let top: { userId: string; name: string; sales: number; txnCount: number } | null =
    null;
  for (const [userId, row] of cashiers) {
    const candidate = {
      userId,
      name: row.name,
      sales: round2(row.sales),
      txnCount: row.txnCount,
    };
    if (
      !top ||
      candidate.sales > top.sales ||
      (candidate.sales === top.sales && candidate.txnCount > top.txnCount)
    ) {
      top = candidate;
    }
  }
  return top;
}

function mergeCashiers(
  staff: Array<{ id: string; name: string }>,
  sold: Map<string, { name: string; sales: number; txnCount: number }>,
): Array<{ id: string; name: string }> {
  const byId = new Map<string, string>();
  for (const u of staff) byId.set(u.id, u.name);
  for (const [id, row] of sold) {
    if (!byId.has(id)) byId.set(id, row.name);
  }
  return [...byId.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Net profit = sum(sale.total) − sum(costPerBaseAtSale * quantityBase). */
function saleCogs(items: Array<{
  quantityBase: number;
  costPerBaseAtSale: DecimalLike | null;
}>): number {
  let cogs = 0;
  for (const item of items) {
    if (item.costPerBaseAtSale == null) continue;
    cogs = round2(cogs + toNumber(item.costPerBaseAtSale) * item.quantityBase);
  }
  return cogs;
}

type InventoryCounts = {
  productCount: number;
  onHandPieces: number;
  costValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  expiring30dCount: number;
  expiring90dCount: number;
  expiredCount: number;
  expiringStockValue90d: number;
};

async function inventoryCounts(
  ctx: TenantContext,
  today: Date,
): Promise<InventoryCounts> {
  const scope = storeScope(ctx);
  const [products, lots] = await Promise.all([
    prisma.product.findMany({
      where: { tenantId: ctx.tenantId, isActive: true },
      select: { id: true, reorderLevel: true },
    }),
    prisma.batch.findMany({
      where: { tenantId: ctx.tenantId, ...scope },
      select: {
        productId: true,
        quantityOnHand: true,
        costPerBase: true,
        expiryDate: true,
      },
    }),
  ]);

  const onHandByProduct = new Map<string, number>();
  let onHandPieces = 0;
  let costValue = 0;
  let expiringStockValue90d = 0;
  const expiring30d = new Set<string>();
  const expiring90d = new Set<string>();
  const expired = new Set<string>();

  for (const lot of lots) {
    const qty = lot.quantityOnHand;
    onHandByProduct.set(
      lot.productId,
      (onHandByProduct.get(lot.productId) ?? 0) + qty,
    );
    if (qty <= 0) continue;
    onHandPieces += qty;
    const cost = round2(qty * toNumber(lot.costPerBase));
    costValue = round2(costValue + cost);
    const days = daysUntilExpiry(lot.expiryDate, today);
    if (days < 0) {
      expired.add(lot.productId);
    } else if (days <= 90) {
      expiring90d.add(lot.productId);
      expiringStockValue90d = round2(expiringStockValue90d + cost);
      if (days <= 30) expiring30d.add(lot.productId);
    }
  }

  let lowStockCount = 0;
  let outOfStockCount = 0;
  for (const product of products) {
    const onHand = onHandByProduct.get(product.id) ?? 0;
    if (onHand === 0) outOfStockCount += 1;
    if (
      product.reorderLevel != null &&
      onHand > 0 &&
      onHand <= product.reorderLevel
    ) {
      lowStockCount += 1;
    }
  }

  return {
    productCount: products.length,
    onHandPieces,
    costValue,
    lowStockCount,
    outOfStockCount,
    expiring30dCount: expiring30d.size,
    expiring90dCount: expiring90d.size,
    expiredCount: expired.size,
    expiringStockValue90d,
  };
}

export async function getDashboard(
  ctx: TenantContext,
  query: OwnerDashboardQuery,
) {
  const range = resolveDashboardRange(query);
  const now = new Date();
  const todayStart = startOfUtcDay(now);
  const todayEnd = endOfUtcDay(now);
  const yesterdayStart = addUtcDays(todayStart, -1);
  const yesterdayEnd = endOfUtcDay(yesterdayStart);
  const weekStart = addUtcDays(todayStart, -6);

  const spanDays =
    (startOfUtcDay(range.to).getTime() - startOfUtcDay(range.from).getTime()) /
      86_400_000 +
    1;
  const prevFrom = addUtcDays(startOfUtcDay(range.from), -spanDays);
  const prevTo = endOfUtcDay(addUtcDays(startOfUtcDay(range.from), -1));

  const fetchFrom = new Date(
    Math.min(
      range.from.getTime(),
      yesterdayStart.getTime(),
      prevFrom.getTime(),
    ),
  );
  const fetchTo = new Date(Math.max(range.to.getTime(), todayEnd.getTime()));
  const scope = storeScope(ctx);

  const [
    sales,
    recentSales,
    inventory,
    fefoToday,
    fefoWeek,
    activeCashiers,
    staffUsers,
  ] = await Promise.all([
      prisma.sale.findMany({
        where: {
          tenantId: ctx.tenantId,
          ...scope,
          soldAt: { gte: fetchFrom, lte: fetchTo },
        },
        select: {
          id: true,
          soldAt: true,
          total: true,
          subtotal: true,
          discount: true,
          userId: true,
          user: { select: { id: true, name: true } },
          items: {
            select: { quantityBase: true, costPerBaseAtSale: true },
          },
          payments: { select: { method: true, amount: true } },
        },
      }),
      prisma.sale.findMany({
        where: {
          tenantId: ctx.tenantId,
          ...scope,
          soldAt: { gte: range.from, lte: range.to },
        },
        orderBy: { soldAt: "desc" },
        take: 8,
        select: {
          id: true,
          receiptNo: true,
          soldAt: true,
          total: true,
          customer: { select: { name: true } },
          user: { select: { name: true } },
          notes: true,
          loyaltyUsed: true,
          payments: { select: { method: true, amount: true } },
          items: {
            select: { quantityBase: true, costPerBaseAtSale: true },
          },
        },
      }),
      inventoryCounts(ctx, now),
      prisma.saleItem.count({
        where: {
          tenantId: ctx.tenantId,
          fefoOverride: true,
          sale: {
            soldAt: { gte: todayStart, lte: now },
            ...(scope.storeId ? { storeId: scope.storeId } : {}),
          },
        },
      }),
      prisma.saleItem.count({
        where: {
          tenantId: ctx.tenantId,
          fefoOverride: true,
          sale: {
            soldAt: { gte: weekStart, lte: now },
            ...(scope.storeId ? { storeId: scope.storeId } : {}),
          },
        },
      }),
      prisma.user.count({
        where: {
          tenantId: ctx.tenantId,
          role: "CASHIER",
          isActive: true,
          ...(scope.storeId ? { storeId: scope.storeId } : {}),
        },
      }),
      prisma.user.findMany({
        where: {
          tenantId: ctx.tenantId,
          isActive: true,
          role: { in: ["CASHIER", "MANAGER", "OWNER"] },
          ...(scope.storeId ? { storeId: scope.storeId } : {}),
        },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

  const acc = {
    today: { sales: 0, cogs: 0, txnCount: 0 },
    yesterday: { sales: 0, cogs: 0, txnCount: 0 },
    period: { sales: 0, cogs: 0, txnCount: 0, gross: 0, discount: 0 },
    prev: { sales: 0, gross: 0, txnCount: 0 },
    byDay: new Map<string, { sales: number; cogs: number; txnCount: number }>(),
    paymentMix: { CASH: 0, CARD: 0, MFS: 0 },
    cashiers: new Map<string, { name: string; sales: number; txnCount: number }>(),
  };

  for (const sale of sales) {
    const total = toNumber(sale.total);
    const subtotal = toNumber(sale.subtotal);
    const discount = toNumber(sale.discount);
    const cogs = saleCogs(sale.items);
    const t = sale.soldAt.getTime();
    const inToday = t >= todayStart.getTime() && t <= todayEnd.getTime();
    const inYesterday =
      t >= yesterdayStart.getTime() && t <= yesterdayEnd.getTime();
    const inRange = t >= range.from.getTime() && t <= range.to.getTime();
    const inPrev = t >= prevFrom.getTime() && t <= prevTo.getTime();

    if (inToday) {
      acc.today.sales += total;
      acc.today.cogs += cogs;
      acc.today.txnCount += 1;
    }
    if (inYesterday) {
      acc.yesterday.sales += total;
      acc.yesterday.cogs += cogs;
      acc.yesterday.txnCount += 1;
    }
    if (inPrev) {
      acc.prev.sales += total;
      acc.prev.gross += subtotal;
      acc.prev.txnCount += 1;
    }
    if (inRange) {
      acc.period.sales += total;
      acc.period.cogs += cogs;
      acc.period.txnCount += 1;
      acc.period.gross += subtotal;
      acc.period.discount += discount;
      const key = utcDateKey(sale.soldAt);
      const day = acc.byDay.get(key) ?? { sales: 0, cogs: 0, txnCount: 0 };
      day.sales += total;
      day.cogs += cogs;
      day.txnCount += 1;
      acc.byDay.set(key, day);
      for (const pay of sale.payments) {
        const current = acc.paymentMix[pay.method] ?? 0;
        acc.paymentMix[pay.method] = round2(current + toNumber(pay.amount));
      }
      const cashier = acc.cashiers.get(sale.user.id) ?? {
        name: sale.user.name,
        sales: 0,
        txnCount: 0,
      };
      cashier.sales += total;
      cashier.txnCount += 1;
      acc.cashiers.set(sale.user.id, cashier);
    }
  }

  const todayKpi = kpiBlock(
    acc.today.sales,
    acc.today.sales - acc.today.cogs,
    acc.today.txnCount,
  );
  const yesterdayKpi = kpiBlock(
    acc.yesterday.sales,
    acc.yesterday.sales - acc.yesterday.cogs,
    acc.yesterday.txnCount,
  );
  const periodKpi = kpiBlock(
    acc.period.sales,
    acc.period.sales - acc.period.cogs,
    acc.period.txnCount,
  );

  const dailyBars: Array<{
    date: string;
    sales: number;
    netProfit: number;
    txnCount: number;
  }> = [];
  for (
    let cursor = startOfUtcDay(range.from);
    cursor.getTime() <= startOfUtcDay(range.to).getTime();
    cursor = addUtcDays(cursor, 1)
  ) {
    const key = utcDateKey(cursor);
    const day = acc.byDay.get(key) ?? { sales: 0, cogs: 0, txnCount: 0 };
    dailyBars.push({
      date: key,
      sales: round2(day.sales),
      netProfit: round2(day.sales - day.cogs),
      txnCount: day.txnCount,
    });
  }

  return {
    range: { from: range.from.toISOString(), to: range.to.toISOString() },
    /** Net profit = sum(sale.total) − period COGS (discounts already in total). */
    netProfitFormula: "sum(sale.total) - sum(costPerBaseAtSale * quantityBase)",
    kpis: {
      today: todayKpi,
      yesterday: yesterdayKpi,
      vsYesterday: vsYesterday(todayKpi, yesterdayKpi),
      period: periodKpi,
    },
    dailyBars,
    paymentMix: acc.paymentMix,
    /** Gross = sum(subtotal). Net = sum(total) = gross − discounts. No returns ledger. */
    salesKpis: {
      grossSales: round2(acc.period.gross),
      netSales: round2(acc.period.sales),
      discountTotal: round2(acc.period.discount),
      txnCount: acc.period.txnCount,
      avgSale:
        acc.period.txnCount > 0
          ? round2(acc.period.sales / acc.period.txnCount)
          : 0,
      vsPrev: vsPrevGross(acc.period.gross, acc.prev.gross),
    },
    topCashier: pickTopCashier(acc.cashiers),
    cashiers: mergeCashiers(staffUsers, acc.cashiers),
    inventoryHealth: {
      lowStock: inventory.lowStockCount,
      outOfStock: inventory.outOfStockCount,
      expiring30d: inventory.expiring30dCount,
      expiring90d: inventory.expiring90dCount,
      expired: inventory.expiredCount,
    },
    fefoOverrides: { today: fefoToday, week: fefoWeek },
    expiringStockValue: inventory.expiringStockValue90d,
    staff: {
      activeCashiers,
      openShifts: null,
      cashVarianceToday: null,
    },
    recentSales: recentSales.map((sale) => {
      const total = toNumber(sale.total);
      const cogs = saleCogs(sale.items);
      return {
        id: sale.id,
        receiptNo: sale.receiptNo,
        soldAt: sale.soldAt,
        total,
        netProfit: round2(total - cogs),
        customerName: sale.customer?.name ?? null,
        cashierName: sale.user.name,
        loyaltyUsed: sale.loyaltyUsed,
        paymentMethods: [...new Set(sale.payments.map((p) => p.method))],
        paymentAmounts: sale.payments.map((p) => ({
          method: p.method,
          amount: toNumber(p.amount),
        })),
        mfsProvider: parseMfsProvider(sale.notes),
      };
    }),
  };
}

export async function getInventorySummary(ctx: TenantContext) {
  const counts = await inventoryCounts(ctx, new Date());
  return {
    totals: {
      productCount: counts.productCount,
      onHandPieces: counts.onHandPieces,
      costValue: counts.costValue,
    },
    lowStockCount: counts.lowStockCount,
    outOfStockCount: counts.outOfStockCount,
    expiring30dCount: counts.expiring30dCount,
    expiring90dCount: counts.expiring90dCount,
    expiredCount: counts.expiredCount,
  };
}

const EMPTY_COUNTS: Record<ExpiryBucket, number> = {
  "0_30": 0,
  "31_60": 0,
  "61_90": 0,
  expired: 0,
};

export async function getExpiry(ctx: TenantContext, query: OwnerExpiryQuery) {
  const today = new Date();
  const scope = storeScope(ctx);
  const lots = await prisma.batch.findMany({
    where: {
      tenantId: ctx.tenantId,
      ...scope,
      quantityOnHand: { gt: 0 },
    },
    select: {
      id: true,
      productId: true,
      batchNumber: true,
      expiryDate: true,
      quantityOnHand: true,
      costPerBase: true,
      product: { select: { name: true, genericName: true } },
    },
    orderBy: [{ expiryDate: "asc" }, { id: "asc" }],
  });

  const rankByProduct = new Map<string, Map<string, number>>();
  for (const lot of lots) {
    let ranks = rankByProduct.get(lot.productId);
    if (!ranks) {
      ranks = new Map();
      rankByProduct.set(lot.productId, ranks);
    }
    ranks.set(lot.id, ranks.size + 1);
  }

  const counts: Record<ExpiryBucket, number> = { ...EMPTY_COUNTS };
  const rows: Array<{
    productId: string;
    productName: string;
    genericName: string | null;
    batchId: string;
    batchNumber: string;
    expiryDate: Date;
    quantityOnHand: number;
    costValue: number;
    fefoRank: number;
  }> = [];

  for (const lot of lots) {
    const days = daysUntilExpiry(lot.expiryDate, today);
    const bucket = bucketForDays(days);
    if (!bucket) continue;
    counts[bucket] += 1;
    if (query.bucket && query.bucket !== bucket) continue;
    rows.push({
      productId: lot.productId,
      productName: lot.product.name,
      genericName: lot.product.genericName,
      batchId: lot.id,
      batchNumber: lot.batchNumber,
      expiryDate: lot.expiryDate,
      quantityOnHand: lot.quantityOnHand,
      costValue: round2(lot.quantityOnHand * toNumber(lot.costPerBase)),
      fefoRank: rankByProduct.get(lot.productId)?.get(lot.id) ?? 0,
    });
  }

  return {
    bucket: query.bucket ?? null,
    counts,
    rows: rows.slice(0, 500),
  };
}

type InventoryRowStatus = "healthy" | "low" | "out" | "expiring" | "expired";

type LotAgg = {
  quantityOnHand: number;
  nearestExpiry: Date | null;
  batchCount: number;
  costPerBase: number | null;
  sellPerBase: number | null;
  fefoExpiry: Date | null;
  fallbackCost: number | null;
  fallbackSell: number | null;
  fallbackExpiry: Date | null;
  hasExpiring30: boolean;
  hasExpiring90: boolean;
  hasExpired: boolean;
  hasSellable: boolean;
};

function emptyLotAgg(): LotAgg {
  return {
    quantityOnHand: 0,
    nearestExpiry: null,
    batchCount: 0,
    costPerBase: null,
    sellPerBase: null,
    fefoExpiry: null,
    fallbackCost: null,
    fallbackSell: null,
    fallbackExpiry: null,
    hasExpiring30: false,
    hasExpiring90: false,
    hasExpired: false,
    hasSellable: false,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function matchesInventorySearch(
  product: {
    name: string;
    genericName: string | null;
    sku: string | null;
    barcode: string | null;
  },
  q: string,
): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const hay = [
    product.name,
    product.genericName ?? "",
    product.sku ?? "",
    product.barcode ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(needle);
}

function rowStatus(input: {
  quantityOnHand: number;
  reorderLevel: number | null;
  hasSellable: boolean;
  hasExpired: boolean;
  hasExpiring30: boolean;
}): InventoryRowStatus {
  if (input.quantityOnHand <= 0) return "out";
  if (!input.hasSellable && input.hasExpired) return "expired";
  if (input.hasExpiring30) return "expiring";
  if (
    input.reorderLevel != null &&
    input.quantityOnHand > 0 &&
    input.quantityOnHand <= input.reorderLevel
  ) {
    return "low";
  }
  return "healthy";
}

function inTab(tab: OwnerInventoryTab, flags: {
  isLow: boolean;
  isOut: boolean;
  hasExpiring30: boolean;
  hasExpiring90: boolean;
  hasExpired: boolean;
}): boolean {
  if (tab === "all") return true;
  if (tab === "low") return flags.isLow;
  if (tab === "out") return flags.isOut;
  if (tab === "expiring30") return flags.hasExpiring30;
  if (tab === "expiring90") return flags.hasExpiring90;
  return flags.hasExpired;
}

/**
 * Paged owner inventory (one round-trip). Cost/sell/margin always present
 * (OWNER-only route). Manufacturer is null when unset — do not invent.
 */
export async function getInventoryList(
  ctx: TenantContext,
  query: OwnerInventoryQuery,
) {
  const today = new Date();
  const scope = storeScope(ctx);
  const [products, lots] = await Promise.all([
    prisma.product.findMany({
      where: { tenantId: ctx.tenantId, isActive: true },
      select: {
        id: true,
        name: true,
        genericName: true,
        manufacturer: true,
        sku: true,
        barcode: true,
        coldChain: true,
        reorderLevel: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.batch.findMany({
      where: { tenantId: ctx.tenantId, ...scope },
      select: {
        productId: true,
        quantityOnHand: true,
        costPerBase: true,
        sellPerBase: true,
        expiryDate: true,
      },
    }),
  ]);

  const byProduct = new Map<string, LotAgg>();
  let expiring30dBatchCount = 0;
  let expiring90dBatchCount = 0;
  let expiredBatchCount = 0;
  let expiringStockValue90d = 0;

  for (const lot of lots) {
    const qty = lot.quantityOnHand;
    let agg = byProduct.get(lot.productId);
    if (!agg) {
      agg = emptyLotAgg();
      byProduct.set(lot.productId, agg);
    }
    agg.quantityOnHand += qty;
    if (qty <= 0) continue;

    agg.batchCount += 1;
    if (!agg.nearestExpiry || lot.expiryDate < agg.nearestExpiry) {
      agg.nearestExpiry = lot.expiryDate;
    }

    const days = daysUntilExpiry(lot.expiryDate, today);
    const cost = toNumber(lot.costPerBase);
    const sell = toNumber(lot.sellPerBase);
    if (days < 0) {
      agg.hasExpired = true;
      expiredBatchCount += 1;
      if (!agg.fallbackExpiry || lot.expiryDate < agg.fallbackExpiry) {
        agg.fallbackExpiry = lot.expiryDate;
        agg.fallbackCost = cost;
        agg.fallbackSell = sell;
      }
    } else {
      agg.hasSellable = true;
      if (!agg.fefoExpiry || lot.expiryDate < agg.fefoExpiry) {
        agg.fefoExpiry = lot.expiryDate;
        agg.costPerBase = cost;
        agg.sellPerBase = sell;
      }
      if (days <= 90) {
        agg.hasExpiring90 = true;
        expiring90dBatchCount += 1;
        expiringStockValue90d = round2(expiringStockValue90d + qty * cost);
        if (days <= 30) {
          agg.hasExpiring30 = true;
          expiring30dBatchCount += 1;
        }
      }
    }
  }

  for (const agg of byProduct.values()) {
    if (agg.costPerBase == null && agg.fallbackCost != null) {
      agg.costPerBase = agg.fallbackCost;
      agg.sellPerBase = agg.fallbackSell;
    }
  }

  type Built = {
    productId: string;
    name: string;
    genericName: string | null;
    manufacturer: string | null;
    sku: string | null;
    barcode: string | null;
    coldChain: boolean;
    quantityOnHand: number;
    nearestExpiry: Date | null;
    batchCount: number;
    costPerBase: number | null;
    sellPerBase: number | null;
    marginPct: number | null;
    status: InventoryRowStatus;
    isLow: boolean;
    isOut: boolean;
    hasExpiring30: boolean;
    hasExpiring90: boolean;
    hasExpired: boolean;
  };

  const built: Built[] = products.map((product) => {
    const agg = byProduct.get(product.id) ?? emptyLotAgg();
    const isOut = agg.quantityOnHand <= 0;
    const isLow =
      product.reorderLevel != null &&
      agg.quantityOnHand > 0 &&
      agg.quantityOnHand <= product.reorderLevel;
    const cost = agg.costPerBase;
    const sell = agg.sellPerBase;
    const marginPct =
      cost != null && sell != null && sell > 0
        ? round1(((sell - cost) / sell) * 100)
        : null;
    return {
      productId: product.id,
      name: product.name,
      genericName: product.genericName,
      manufacturer: product.manufacturer,
      sku: product.sku,
      barcode: product.barcode,
      coldChain: product.coldChain,
      quantityOnHand: agg.quantityOnHand,
      nearestExpiry: agg.nearestExpiry,
      batchCount: agg.batchCount,
      costPerBase: cost,
      sellPerBase: sell,
      marginPct,
      status: rowStatus({
        quantityOnHand: agg.quantityOnHand,
        reorderLevel: product.reorderLevel,
        hasSellable: agg.hasSellable,
        hasExpired: agg.hasExpired,
        hasExpiring30: agg.hasExpiring30,
      }),
      isLow,
      isOut,
      hasExpiring30: agg.hasExpiring30,
      hasExpiring90: agg.hasExpiring90,
      hasExpired: agg.hasExpired,
    };
  });

  const tabs = {
    all: built.length,
    low: built.filter((r) => r.isLow).length,
    out: built.filter((r) => r.isOut).length,
    expiring30: expiring30dBatchCount,
    expiring90: expiring90dBatchCount,
    expired: expiredBatchCount,
  };

  const q = query.q?.trim() ?? "";
  const tab = query.tab;
  const filtered = built.filter((row) => {
    if (
      !inTab(tab, {
        isLow: row.isLow,
        isOut: row.isOut,
        hasExpiring30: row.hasExpiring30,
        hasExpiring90: row.hasExpiring90,
        hasExpired: row.hasExpired,
      })
    ) {
      return false;
    }
    if (q && !matchesInventorySearch(row, q)) return false;
    return true;
  });

  const total = filtered.length;
  const items = filtered
    .slice(query.offset, query.offset + query.limit)
    .map((row) => ({
      productId: row.productId,
      name: row.name,
      genericName: row.genericName,
      manufacturer: row.manufacturer,
      sku: row.sku,
      barcode: row.barcode,
      coldChain: row.coldChain,
      quantityOnHand: row.quantityOnHand,
      nearestExpiry: row.nearestExpiry,
      batchCount: row.batchCount,
      costPerBase: row.costPerBase,
      sellPerBase: row.sellPerBase,
      marginPct: row.marginPct,
      status: row.status,
    }));

  let costValue = 0;
  for (const lot of lots) {
    if (lot.quantityOnHand <= 0) continue;
    costValue = round2(
      costValue + lot.quantityOnHand * toNumber(lot.costPerBase),
    );
  }

  return {
    items,
    total,
    limit: query.limit,
    offset: query.offset,
    tabs,
    summary: {
      productCount: built.length,
      costValue,
      lowStockCount: tabs.low,
      outOfStockCount: tabs.out,
      expiring90dBatchCount: tabs.expiring90,
    },
    attention: {
      outOfStockCount: tabs.out,
      expiring30dBatchCount: tabs.expiring30,
      expiringStockValue90d,
      lowStockCount: tabs.low,
    },
  };
}

type LotStatus = "fefo" | "active" | "expired" | "empty";
type UnitTypeName = "PIECE" | "STRIP" | "BOX";

const UNIT_ORDER: UnitTypeName[] = ["PIECE", "STRIP", "BOX"];

function unitSortKey(unitType: string): number {
  const idx = UNIT_ORDER.indexOf(unitType as UnitTypeName);
  return idx === -1 ? 99 : idx;
}

/**
 * Product Details (M6 Batch K). One round-trip: catalog, units, lots,
 * FEFO rank (sellable by expiry), conversion, recent InventoryEvents.
 * OWNER-only. Cost/sell always present.
 */
export async function getProductDetail(ctx: TenantContext, productId: string) {
  const today = new Date();
  const scope = storeScope(ctx);

  const product = await prisma.product.findFirst({
    where: { id: productId, tenantId: ctx.tenantId },
    include: {
      units: {
        select: {
          id: true,
          unitType: true,
          factorToBase: true,
          label: true,
        },
      },
    },
  });
  if (!product) {
    throw new AppError("Product not found", 404);
  }

  const [lots, events] = await Promise.all([
    prisma.batch.findMany({
      where: { tenantId: ctx.tenantId, productId, ...scope },
      select: {
        id: true,
        batchNumber: true,
        expiryDate: true,
        quantityOnHand: true,
        costPerBase: true,
        sellPerBase: true,
      },
      orderBy: [{ expiryDate: "asc" }, { id: "asc" }],
    }),
    prisma.inventoryEvent.findMany({
      where: { tenantId: ctx.tenantId, productId, ...scope },
      include: {
        batch: { select: { batchNumber: true } },
        sale: { select: { receiptNo: true } },
        actorUser: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const sellable = lots.filter(
    (lot) =>
      lot.quantityOnHand > 0 && daysUntilExpiry(lot.expiryDate, today) >= 0,
  );
  const fefoRankById = new Map<string, number>();
  for (const lot of sellable) {
    fefoRankById.set(lot.id, fefoRankById.size + 1);
  }
  const fefoLot = sellable[0] ?? null;

  let currentStock = 0;
  let costValue = 0;
  let retailValue = 0;
  let activeBatchCount = 0;
  let fallbackCost: number | null = null;
  let fallbackSell: number | null = null;
  for (const lot of lots) {
    const cost = toNumber(lot.costPerBase);
    const sell = toNumber(lot.sellPerBase);
    const qty = lot.quantityOnHand;
    currentStock += qty;
    costValue += qty * cost;
    retailValue += qty * sell;
    if (qty > 0) activeBatchCount += 1;
    if (fallbackCost == null) fallbackCost = cost;
    if (fallbackSell == null) fallbackSell = sell;
  }
  costValue = round2(costValue);
  retailValue = round2(retailValue);

  const costPerBase =
    currentStock > 0
      ? costValue / currentStock
      : (fallbackCost ?? 0);
  const sellPerBase =
    currentStock > 0
      ? retailValue / currentStock
      : (fallbackSell ?? 0);
  const averageMarginPct =
    retailValue > 0
      ? round1(((retailValue - costValue) / retailValue) * 100)
      : null;

  const stripUnit = product.units.find((u) => u.unitType === "STRIP");
  const boxUnit = product.units.find((u) => u.unitType === "BOX");
  const stripFactor = stripUnit?.factorToBase ?? null;
  const boxFactor = boxUnit?.factorToBase ?? null;
  const stripsPerBox =
    boxFactor && stripFactor && stripFactor > 0
      ? Math.round(boxFactor / stripFactor)
      : null;

  let remaining = currentStock;
  let boxes = 0;
  let strips = 0;
  if (boxFactor && boxFactor > 0) {
    boxes = Math.floor(remaining / boxFactor);
    remaining %= boxFactor;
  }
  if (stripFactor && stripFactor > 0) {
    strips = Math.floor(remaining / stripFactor);
    remaining %= stripFactor;
  }
  const remainderPcs = remaining;

  const primaryUnit =
    product.units.find((u) => u.unitType === "PIECE") ??
    [...product.units].sort((a, b) => a.factorToBase - b.factorToBase)[0] ??
    null;

  const units = [...product.units]
    .sort((a, b) => unitSortKey(a.unitType) - unitSortKey(b.unitType))
    .map((unit) => ({
      unitType: unit.unitType,
      factorToBase: unit.factorToBase,
      label: unit.label,
      isPrimary: primaryUnit?.id === unit.id,
      cost: round2(costPerBase * unit.factorToBase),
      sell: round2(sellPerBase * unit.factorToBase),
      stripsEquivalent:
        unit.unitType === "BOX" && stripsPerBox != null ? stripsPerBox : null,
    }));

  const batches = lots.map((lot) => {
    const days = daysUntilExpiry(lot.expiryDate, today);
    const qty = lot.quantityOnHand;
    const fefoRank = fefoRankById.get(lot.id) ?? null;
    const status: LotStatus =
      days < 0
        ? "expired"
        : qty <= 0
          ? "empty"
          : fefoRank === 1
            ? "fefo"
            : "active";
    const cost = toNumber(lot.costPerBase);
    const sell = toNumber(lot.sellPerBase);
    return {
      id: lot.id,
      batchNumber: lot.batchNumber,
      expiryDate: lot.expiryDate.toISOString(),
      quantityOnHand: qty,
      costPerBase: cost,
      sellPerBase: sell,
      stockValue: round2(qty * cost),
      fefoRank,
      status,
    };
  });

  batches.sort((a, b) => {
    const rankA = a.fefoRank ?? 999;
    const rankB = b.fefoRank ?? 999;
    if (rankA !== rankB) return rankA - rankB;
    return a.expiryDate.localeCompare(b.expiryDate);
  });

  return {
    id: product.id,
    name: product.name,
    genericName: product.genericName,
    manufacturer: product.manufacturer,
    strength: product.strength,
    form: product.form,
    sku: product.sku,
    barcode: product.barcode,
    description: product.description,
    category: product.category,
    requiresPrescription: product.requiresPrescription,
    coldChain: product.coldChain,
    storageNotes: product.storageNotes,
    reorderLevel: product.reorderLevel,
    isActive: product.isActive,
    primaryUnit: primaryUnit?.unitType ?? "PIECE",
    kpis: {
      currentStock,
      stockCostValue: costValue,
      retailStockValue: retailValue,
      averageMarginPct,
      activeBatchCount,
      nearestExpiry: fefoLot ? fefoLot.expiryDate.toISOString() : null,
    },
    fefo: fefoLot
      ? {
          batchId: fefoLot.id,
          batchNumber: fefoLot.batchNumber,
          quantityOnHand: fefoLot.quantityOnHand,
          expiryDate: fefoLot.expiryDate.toISOString(),
        }
      : null,
    conversion: {
      totalBase: currentStock,
      boxes,
      strips,
      remainderPcs,
      stripFactor,
      boxFactor,
      stripsPerBox,
    },
    units,
    batches,
    events: events.map((ev) => ({
      id: ev.id,
      type: ev.type,
      quantityBaseChange: ev.quantityBaseChange,
      note: ev.note,
      createdAt: ev.createdAt.toISOString(),
      batchNumber: ev.batch?.batchNumber ?? null,
      receiptNo: ev.sale?.receiptNo ?? null,
      actorName: ev.actorUser?.name ?? null,
    })),
  };
}
