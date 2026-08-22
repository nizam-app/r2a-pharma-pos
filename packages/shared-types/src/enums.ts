import { z } from "zod";

/** Mirrors Prisma `Role`. */
export const roleSchema = z.enum([
  "SUPER_ADMIN",
  "OWNER",
  "MANAGER",
  "CASHIER",
]);
export type Role = z.infer<typeof roleSchema>;

/** Mirrors Prisma `UnitType`. Quantities elsewhere are in base (PIECE) units. */
export const unitTypeSchema = z.enum(["BOX", "STRIP", "PIECE"]);
export type UnitType = z.infer<typeof unitTypeSchema>;

/** Mirrors Prisma `PaymentMethod`. No Baki — cash, card, or MFS only. */
export const paymentMethodSchema = z.enum(["CASH", "CARD", "MFS"]);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

/** Mirrors Prisma `InventoryEventType`. Append-only stock ledger. */
export const inventoryEventTypeSchema = z.enum(["RECEIVE", "ADJUST", "SALE"]);
export type InventoryEventType = z.infer<typeof inventoryEventTypeSchema>;

/** Mirrors Prisma `BatchReturnStatus`. This is metadata, not a return workflow. */
export const batchReturnStatusSchema = z.enum([
  "ELIGIBLE",
  "NOT_ELIGIBLE",
  "MANIFEST_PREPARED",
]);
export type BatchReturnStatus = z.infer<typeof batchReturnStatusSchema>;

/** Mirrors Prisma `SupplierStatus`. */
export const supplierStatusSchema = z.enum(["ACTIVE", "HOLD", "DRAFT"]);
export type SupplierStatus = z.infer<typeof supplierStatusSchema>;

/** Mirrors Prisma `PurchaseOrderStatus`. */
export const purchaseOrderStatusSchema = z.enum([
  "DRAFT",
  "SENT",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
]);
export type PurchaseOrderStatus = z.infer<typeof purchaseOrderStatusSchema>;

/** Mirrors Prisma `GoodsReceiptStatus`. Batch P supports confirmed GRNs only. */
export const goodsReceiptStatusSchema = z.enum(["CONFIRMED"]);
export type GoodsReceiptStatus = z.infer<typeof goodsReceiptStatusSchema>;

/** Mirrors Prisma `ReturnManifestStatus`. */
export const returnManifestStatusSchema = z.enum([
  "PREPARED",
  "DISPATCHED",
  "ACCEPTED",
  "REJECTED",
  "COMPLETED",
]);
export type ReturnManifestStatus = z.infer<
  typeof returnManifestStatusSchema
>;

/** Mirrors Prisma `CustomerStatus`. */
export const customerStatusSchema = z.enum([
  "ACTIVE",
  "PENDING_APPROVAL",
  "INACTIVE",
  "REJECTED",
]);
export type CustomerStatus = z.infer<typeof customerStatusSchema>;

/** Mirrors Prisma `CustomerSource`. */
export const customerSourceSchema = z.enum([
  "OWNER_CREATED",
  "POS_REGISTRATION",
]);
export type CustomerSource = z.infer<typeof customerSourceSchema>;

/** Mirrors Prisma `CustomerGender`. Optional on the profile. */
export const customerGenderSchema = z.enum(["MALE", "FEMALE", "OTHER"]);
export type CustomerGender = z.infer<typeof customerGenderSchema>;

/** Mirrors Prisma `StaffActivityType`. */
export const staffActivityTypeSchema = z.enum([
  "CREATED",
  "ROLE_CHANGED",
  "BRANCH_CHANGED",
  "DEACTIVATED",
  "REACTIVATED",
  "PROFILE_UPDATED",
]);
export type StaffActivityType = z.infer<typeof staffActivityTypeSchema>;

/** Mirrors Prisma `ShiftStatus`. */
export const shiftStatusSchema = z.enum(["OPEN", "CLOSED", "FLAGGED"]);
export type ShiftStatus = z.infer<typeof shiftStatusSchema>;

/** Mirrors Prisma `ShiftVarianceDecision`. */
export const shiftVarianceDecisionSchema = z.enum([
  "ACCEPTED_DIFFERENCE",
  "COUNT_CORRECTED",
  "OTHER",
]);
export type ShiftVarianceDecision = z.infer<typeof shiftVarianceDecisionSchema>;

/** Mirrors Prisma `ShiftActivityType`. */
export const shiftActivityTypeSchema = z.enum([
  "OPENED",
  "SALE_RECORDED",
  "CLOSE_SUBMITTED",
  "VARIANCE_REVIEWED",
  "CLOSED",
]);
export type ShiftActivityType = z.infer<typeof shiftActivityTypeSchema>;

/** Mirrors Prisma `StockAuditStatus`. */
export const stockAuditStatusSchema = z.enum([
  "IN_PROGRESS",
  "UNDER_REVIEW",
  "COMPLETED",
  "VARIANCE_FOUND",
]);
export type StockAuditStatus = z.infer<typeof stockAuditStatusSchema>;

/** Mirrors Prisma `StockAuditLineStatus`. */
export const stockAuditLineStatusSchema = z.enum([
  "MATCHES",
  "DISCREPANCY",
]);
export type StockAuditLineStatus = z.infer<typeof stockAuditLineStatusSchema>;

/** Mirrors Prisma `FefoViolationStatus`. */
export const fefoViolationStatusSchema = z.enum([
  "OPEN",
  "CORRECTED",
  "DISMISSED",
]);
export type FefoViolationStatus = z.infer<typeof fefoViolationStatusSchema>;

/** Mirrors Prisma `StockAuditActivityType`. */
export const stockAuditActivityTypeSchema = z.enum([
  "CREATED",
  "COUNT_STARTED",
  "VARIANCE_DETECTED",
  "REVIEWED",
  "FEFO_CORRECTED",
  "COMPLETED",
]);
export type StockAuditActivityType = z.infer<
  typeof stockAuditActivityTypeSchema
>;

