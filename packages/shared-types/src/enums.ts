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
