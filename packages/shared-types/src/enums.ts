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
