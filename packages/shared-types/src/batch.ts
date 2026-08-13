import { z } from "zod";

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
});
export type BatchCreateInput = z.infer<typeof batchCreateSchema>;

export const batchUpdateSchema = z
  .object({
    batchNumber: z.string().min(1).optional(),
    expiryDate: z.coerce.date().optional(),
    quantityOnHand: z.number().int().nonnegative().optional(),
    costPerBase: z.number().nonnegative().optional(),
    sellPerBase: z.number().nonnegative().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field is required",
  });
export type BatchUpdateInput = z.infer<typeof batchUpdateSchema>;

export const batchListSchema = z.object({
  productId: z.string().min(1).optional(),
  storeId: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});
export type BatchListInput = z.infer<typeof batchListSchema>;
