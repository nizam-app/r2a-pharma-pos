import { z } from "zod";
import {
  fefoViolationStatusSchema,
  stockAuditActivityTypeSchema,
  stockAuditLineStatusSchema,
  stockAuditStatusSchema,
} from "./enums";

/** Mirrors Prisma `StockAudit`. */
export const stockAuditSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  storeId: z.string(),
  auditNo: z.string(),
  status: stockAuditStatusSchema,
  locationLabel: z.string(),
  itemsChecked: z.number().int().nonnegative(),
  varianceAmount: z.number(),
  notes: z.string().nullable().optional(),
  startedAt: z.coerce.date(),
  completedAt: z.coerce.date().nullable().optional(),
  reviewedAt: z.coerce.date().nullable().optional(),
  createdByUserId: z.string(),
  reviewedByUserId: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type StockAudit = z.infer<typeof stockAuditSchema>;

/** Mirrors Prisma `StockAuditLine`. */
export const stockAuditLineSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  auditId: z.string(),
  batchId: z.string(),
  productId: z.string(),
  systemQty: z.number().int().nonnegative(),
  countedQty: z.number().int().nonnegative(),
  differenceQty: z.number().int(),
  status: stockAuditLineStatusSchema,
  productNameSnapshot: z.string(),
  batchNumberSnapshot: z.string(),
  expiryDateSnapshot: z.coerce.date(),
  costPerBaseSnapshot: z.number(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type StockAuditLine = z.infer<typeof stockAuditLineSchema>;

/** Mirrors Prisma `FefoViolationRecord`. */
export const fefoViolationRecordSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  storeId: z.string(),
  saleId: z.string().nullable().optional(),
  saleItemId: z.string().nullable().optional(),
  auditId: z.string().nullable().optional(),
  productId: z.string(),
  skippedBatchId: z.string(),
  pickedBatchId: z.string(),
  observedIssue: z.string(),
  recommendedAction: z.string(),
  status: fefoViolationStatusSchema,
  correctionNote: z.string().nullable().optional(),
  correctedAt: z.coerce.date().nullable().optional(),
  correctedByUserId: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type FefoViolationRecord = z.infer<typeof fefoViolationRecordSchema>;

/** Mirrors Prisma `StockAuditActivityEvent`. */
export const stockAuditActivityEventSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  auditId: z.string().nullable().optional(),
  actorUserId: z.string().nullable().optional(),
  type: stockAuditActivityTypeSchema,
  note: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
});
export type StockAuditActivityEvent = z.infer<
  typeof stockAuditActivityEventSchema
>;

/** Owner audit list query (Batch BI will wire routes). */
export const ownerAuditListQuerySchema = z.object({
  q: z.string().min(1).optional(),
  status: stockAuditStatusSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().positive().max(100).default(25),
  offset: z.coerce.number().int().nonnegative().default(0),
});
export type OwnerAuditListQuery = z.infer<typeof ownerAuditListQuerySchema>;

export const auditIdParamSchema = z.object({
  auditId: z.string().min(1),
});
export type AuditIdParam = z.infer<typeof auditIdParamSchema>;

export const fefoViolationIdParamSchema = z.object({
  violationId: z.string().min(1),
});
export type FefoViolationIdParam = z.infer<typeof fefoViolationIdParamSchema>;

/** Manager/Owner starts a stock audit. Desktop UI is deferred. */
export const stockAuditStartSchema = z.object({
  storeId: z.string().min(1).optional(),
  locationLabel: z.string().min(1),
  notes: z.string().optional(),
});
export type StockAuditStartInput = z.infer<typeof stockAuditStartSchema>;

/** Manager/Owner records counted batch lines before submit. */
export const stockAuditLineInputSchema = z.object({
  batchId: z.string().min(1),
  countedQty: z.number().int().nonnegative(),
});
export type StockAuditLineInput = z.infer<typeof stockAuditLineInputSchema>;

export const stockAuditLinesSubmitSchema = z.object({
  lines: z.array(stockAuditLineInputSchema).min(1),
});
export type StockAuditLinesSubmitInput = z.infer<
  typeof stockAuditLinesSubmitSchema
>;

export const stockAuditSubmitSchema = z.object({
  notes: z.string().optional(),
});
export type StockAuditSubmitInput = z.infer<typeof stockAuditSubmitSchema>;

/** Owner review of a submitted/variance audit. */
export const stockAuditReviewSchema = z.object({
  decision: z.enum(["COMPLETE", "KEEP_VARIANCE"]),
  notes: z.string().optional(),
});
export type StockAuditReviewInput = z.infer<typeof stockAuditReviewSchema>;

/** Owner marks an OPEN FEFO violation corrected. */
export const fefoViolationCorrectSchema = z.object({
  correctionNote: z.string().min(1),
});
export type FefoViolationCorrectInput = z.infer<
  typeof fefoViolationCorrectSchema
>;
