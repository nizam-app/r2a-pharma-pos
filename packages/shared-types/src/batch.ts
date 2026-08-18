import { z } from "zod";
import { batchReturnStatusSchema } from "./enums";

const supplierNameSchema = z.string().trim().min(1).max(160).nullable();

/** Batch prices/qty are in base (PIECE) units — Prisma field names locked. */
export const batchCreateSchema = z.object({
  productId: z.string().min(1),
  /** Defaults to JWT storeId when omitted. */
  storeId: z.string().min(1).optional(),
  batchNumber: z.string().min(1),
  expiryDate: z.coerce.date(),
  quantityOnHand: z.number().int().nonnegative(),
  costPerBase: z.number().nonnegative(),
  sellPerBase: z.number().nonnegative(),
  supplierName: supplierNameSchema.optional(),
  returnStatus: batchReturnStatusSchema.optional(),
});
export type BatchCreateInput = z.infer<typeof batchCreateSchema>;

export const batchUpdateSchema = z
  .object({
    batchNumber: z.string().min(1).optional(),
    expiryDate: z.coerce.date().optional(),
    costPerBase: z.number().nonnegative().optional(),
    sellPerBase: z.number().nonnegative().optional(),
    supplierName: supplierNameSchema.optional(),
    returnStatus: batchReturnStatusSchema.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field is required",
  });
export type BatchUpdateInput = z.infer<typeof batchUpdateSchema>;

const operationIdSchema = z.string().trim().min(1).max(128);
const expectedVersionSchema = z.number().int().nonnegative();
const correctionReasonSchema = z.string().trim().min(3).max(500);

export const batchCorrectionSchema = z
  .object({
    operationId: operationIdSchema,
    expectedVersion: expectedVersionSchema,
    reason: correctionReasonSchema,
    batchNumber: z.string().trim().min(1).max(120).optional(),
    expiryDate: z.coerce.date().optional(),
    costPerBase: z.number().nonnegative().optional(),
    sellPerBase: z.number().nonnegative().optional(),
    supplierName: supplierNameSchema.optional(),
    returnStatus: batchReturnStatusSchema.optional(),
  })
  .refine(
    (value) =>
      value.batchNumber !== undefined ||
      value.expiryDate !== undefined ||
      value.costPerBase !== undefined ||
      value.sellPerBase !== undefined ||
      value.supplierName !== undefined ||
      value.returnStatus !== undefined,
    { message: "At least one correction field is required" },
  );
export type BatchCorrectionInput = z.infer<typeof batchCorrectionSchema>;

export const inventoryAdjustmentReasonSchema = z.enum([
  "COUNT_CORRECTION",
  "DAMAGE",
  "BREAKAGE",
  "RETURN",
  "RECEIVE_CORRECTION",
  "OTHER",
]);
export type InventoryAdjustmentReason = z.infer<
  typeof inventoryAdjustmentReasonSchema
>;

export const batchAdjustmentSchema = z.object({
  eventId: operationIdSchema,
  expectedVersion: expectedVersionSchema,
  quantityChange: z.number().int().refine((value) => value !== 0, {
    message: "quantityChange cannot be zero",
  }),
  reasonCode: inventoryAdjustmentReasonSchema,
  note: z.string().trim().min(1).max(500).optional(),
});
export type BatchAdjustmentInput = z.infer<typeof batchAdjustmentSchema>;

export const batchLifecycleSchema = z.object({
  operationId: operationIdSchema,
  expectedVersion: expectedVersionSchema,
  reason: correctionReasonSchema,
});
export type BatchLifecycleInput = z.infer<typeof batchLifecycleSchema>;

export const batchListSchema = z.object({
  productId: z.string().min(1).optional(),
  storeId: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});
export type BatchListInput = z.infer<typeof batchListSchema>;
