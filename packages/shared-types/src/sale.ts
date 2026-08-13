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
  items: z.array(saleItemInputSchema).min(1),
  payments: z.array(salePaymentInputSchema).min(1),
});
export type SaleIngestInput = z.infer<typeof saleIngestSchema>;
