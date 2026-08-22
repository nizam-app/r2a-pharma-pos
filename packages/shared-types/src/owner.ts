import { z } from "zod";

/**
 * Owner-web query DTOs (wired in M6 Batch F).
 */

export const ownerDashboardQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type OwnerDashboardQuery = z.infer<typeof ownerDashboardQuerySchema>;

export const expiryBucketSchema = z.enum(["0_30", "31_60", "61_90", "expired"]);
export type ExpiryBucket = z.infer<typeof expiryBucketSchema>;

export const ownerExpiryQuerySchema = z.object({
  bucket: expiryBucketSchema.optional(),
});
export type OwnerExpiryQuery = z.infer<typeof ownerExpiryQuerySchema>;

/** Inventory list tabs (M6 Batch J). Expiry tabs match in-stock lots. */
export const ownerInventoryTabSchema = z.enum([
  "all",
  "low",
  "out",
  "expiring30",
  "expiring90",
  "expired",
]);
export type OwnerInventoryTab = z.infer<typeof ownerInventoryTabSchema>;

export const ownerInventoryQuerySchema = z.object({
  q: z.string().min(1).optional(),
  tab: ownerInventoryTabSchema.optional().default("all"),
  limit: z.coerce.number().int().positive().max(100).default(25),
  offset: z.coerce.number().int().nonnegative().default(0),
});
export type OwnerInventoryQuery = z.infer<typeof ownerInventoryQuerySchema>;

export const ownerSalesReportQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  storeId: z.string().min(1).optional(),
});
export type OwnerSalesReportQuery = z.infer<
  typeof ownerSalesReportQuerySchema
>;

const ownerReportTrendSchema = z.enum(["up", "down", "steady"]);

export const ownerReportKpiSchema = z.object({
  value: z.number(),
  previousValue: z.number(),
  delta: z.number(),
  deltaPct: z.number().nullable(),
  trend: ownerReportTrendSchema,
});

export const ownerSalesReportResponseSchema = z.object({
  range: z.object({
    from: z.string(),
    to: z.string(),
    previousFrom: z.string(),
    previousTo: z.string(),
    storeId: z.string().nullable(),
  }),
  kpis: z.object({
    totalSales: ownerReportKpiSchema,
    txnCount: ownerReportKpiSchema,
    avgOrder: ownerReportKpiSchema,
    itemsSold: ownerReportKpiSchema,
  }),
  dailyBars: z.array(
    z.object({
      date: z.string(),
      totalSales: z.number(),
      txnCount: z.number(),
    }),
  ),
  paymentSummary: z.object({
    CASH: z.number(),
    CARD: z.number(),
    MFS: z.number(),
    total: z.number(),
  }),
  bestSellingCategory: z
    .object({
      category: z.string(),
      unitsSold: z.number(),
      totalSales: z.number(),
    })
    .nullable(),
  highestSalesDay: z
    .object({
      date: z.string(),
      totalSales: z.number(),
      txnCount: z.number(),
    })
    .nullable(),
  topCashiers: z.array(
    z.object({
      userId: z.string(),
      name: z.string(),
      totalSales: z.number(),
      txnCount: z.number(),
      avgSale: z.number(),
    }),
  ),
  topSellingMedicines: z.array(
    z.object({
      productId: z.string(),
      name: z.string(),
      genericName: z.string().nullable(),
      sku: z.string().nullable(),
      unitsSold: z.number(),
      totalSales: z.number(),
      txnCount: z.number(),
    }),
  ),
  recentTransactions: z.array(
    z.object({
      saleId: z.string(),
      invoiceNo: z.string().nullable(),
      date: z.string(),
      customerName: z.string().nullable(),
      itemCount: z.number(),
      paymentMethods: z.array(z.enum(["CASH", "CARD", "MFS"])),
      total: z.number(),
      cashierName: z.string(),
    }),
  ),
});
export type OwnerSalesReportResponse = z.infer<
  typeof ownerSalesReportResponseSchema
>;
