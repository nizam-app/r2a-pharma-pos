import { z } from "zod";
import { paymentMethodSchema, unitTypeSchema } from "./enums";

/**
 * Sale ingest contracts (cloud + offline sync payload shape).
 * Money fields are numbers in API DTOs; Prisma stores Decimal.
 */

export const salePaymentInputSchema = z.object({
  method: paymentMethodSchema,
  amount: z.number().nonnegative(),
  reference: z.string().min(1).optional(),
});
export type SalePaymentInput = z.infer<typeof salePaymentInputSchema>;

export const saleItemInputSchema = z.object({
  productId: z.string().min(1),
  /** Optional — omitted → server FEFO-fills (M2 Batch F/G). */
  batchId: z.string().min(1).optional(),
  unitType: unitTypeSchema,
  unitQty: z.number().int().positive(),
  quantityBase: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  lineTotal: z.number().nonnegative(),
  /** Optional. Omitted → `fefoOverride` false (old POS payloads). */
  fefoOverride: z.boolean().optional(),
  fefoAuthorizedByName: z.string().min(1).optional(),
});
export type SaleItemInput = z.infer<typeof saleItemInputSchema>;

export const saleIngestSchema = z.object({
  /** Idempotency key — maps to Prisma `Sale.eventId`. */
  eventId: z.string().min(1),
  storeId: z.string().min(1),
  customerId: z.string().min(1).optional(),
  soldAt: z.coerce.date().optional(),
  subtotal: z.number().nonnegative(),
  discount: z.number().nonnegative().default(0),
  total: z.number().nonnegative(),
  notes: z.string().optional(),
  /** Optional. Omitted → snapshots 0 and do not change `Customer.loyaltyPoints`. */
  loyaltyUsed: z.number().int().nonnegative().optional(),
  loyaltyEarned: z.number().int().nonnegative().optional(),
  /** M6 Batch AX — optional shift id; server rejects if no open shift for cashier+store. */
  shiftId: z.string().min(1).optional(),
  items: z.array(saleItemInputSchema).min(1),
  payments: z.array(salePaymentInputSchema).min(1),
});
export type SaleIngestInput = z.infer<typeof saleIngestSchema>;

/** Query for `GET /sales`. `customerId` is accepted from AE; filtering is Batch AF. */
export const saleListQuerySchema = z.object({
  q: z.string().min(1).optional(),
  paymentMethod: paymentMethodSchema.optional(),
  userId: z.string().min(1).optional(),
  customerId: z.string().min(1).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().positive().max(100).default(25),
  offset: z.coerce.number().int().nonnegative().default(0),
});
export type SaleListQuery = z.infer<typeof saleListQuerySchema>;

export const saleIdParamSchema = z.object({
  id: z.string().min(1),
});
export type SaleIdParam = z.infer<typeof saleIdParamSchema>;
