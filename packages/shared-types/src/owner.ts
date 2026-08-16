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
