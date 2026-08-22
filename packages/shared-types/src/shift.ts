import { z } from "zod";
import {
  shiftStatusSchema,
  shiftVarianceDecisionSchema,
  shiftActivityTypeSchema,
  paymentMethodSchema,
} from "./enums";

/** Mirrors Prisma `Shift`. */
export const shiftSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  storeId: z.string(),
  userId: z.string(),
  shiftNo: z.string(),
  status: shiftStatusSchema,
  openingFloat: z.number(),
  openedAt: z.coerce.date(),
  closedAt: z.coerce.date().nullable().optional(),
  countedCash: z.number().nullable().optional(),
  expectedCash: z.number().nullable().optional(),
  variance: z.number().nullable().optional(),
  cashSales: z.number(),
  cardSales: z.number(),
  mfsSales: z.number(),
  txnCount: z.number(),
  varianceDecision: shiftVarianceDecisionSchema.nullable().optional(),
  varianceNote: z.string().nullable().optional(),
  adjustmentReference: z.string().nullable().optional(),
  reviewedAt: z.coerce.date().nullable().optional(),
  reviewedByUserId: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Shift = z.infer<typeof shiftSchema>;

/** Mirrors Prisma `ShiftActivityEvent`. */
export const shiftActivityEventSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  userId: z.string(),
  actorUserId: z.string(),
  shiftId: z.string().nullable().optional(),
  type: shiftActivityTypeSchema,
  note: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
});
export type ShiftActivityEvent = z.infer<typeof shiftActivityEventSchema>;

/** Cashier/Manager shift open — opening float required. */
export const shiftOpenSchema = z.object({
  openingFloat: z.number().nonnegative(),
});
export type ShiftOpenInput = z.infer<typeof shiftOpenSchema>;

/** Cashier/Manager shift close — counted cash required. */
export const shiftCloseSchema = z.object({
  countedCash: z.number().nonnegative(),
});
export type ShiftCloseInput = z.infer<typeof shiftCloseSchema>;

/** Owner variance review for a flagged shift. */
export const shiftResolveSchema = z.object({
  varianceDecision: shiftVarianceDecisionSchema,
  varianceNote: z.string().optional(),
  adjustmentReference: z.string().optional(),
});
export type ShiftResolveInput = z.infer<typeof shiftResolveSchema>;

/** Payment breakdown row for shift detail. */
export const shiftPaymentBreakdownSchema = z.object({
  method: paymentMethodSchema,
  amount: z.number(),
});
export type ShiftPaymentBreakdown = z.infer<typeof shiftPaymentBreakdownSchema>;

/** Owner shift list query (M6 Batch AX). */
export const ownerShiftListQuerySchema = z.object({
  q: z.string().min(1).optional(),
  status: shiftStatusSchema.optional(),
  userId: z.string().min(1).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().positive().max(100).default(25),
  offset: z.coerce.number().int().nonnegative().default(0),
});
export type OwnerShiftListQuery = z.infer<typeof ownerShiftListQuerySchema>;

/** Owner shift id param. */
export const shiftIdParamSchema = z.object({
  shiftId: z.string().min(1),
});
export type ShiftIdParam = z.infer<typeof shiftIdParamSchema>;
