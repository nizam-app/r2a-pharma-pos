import { z } from "zod";
import { roleSchema, staffActivityTypeSchema } from "./enums";

/** Mirrors Prisma `StaffActivityEvent`. */
export const staffActivityEventSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  userId: z.string(),
  actorUserId: z.string(),
  type: staffActivityTypeSchema,
  fromValue: z.string().nullable().optional(),
  toValue: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
});
export type StaffActivityEvent = z.infer<typeof staffActivityEventSchema>;

/** Input schema for listing staff users. */
export const staffListQuerySchema = z.object({
  q: z.string().optional(),
  role: roleSchema.optional(),
  isActive: z.enum(["true", "false", "all"]).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});
export type StaffListQuery = z.infer<typeof staffListQuerySchema>;

/** Input schema for creating a staff user on owner web. */
export const ownerStaffCreateSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["MANAGER", "CASHIER"]),
  internalNote: z.string().optional(),
  storeId: z.string().min(1).optional(),
});
export type OwnerStaffCreateInput = z.infer<typeof ownerStaffCreateSchema>;

/** Input schema for patching a staff user. */
export const ownerStaffPatchSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(["MANAGER", "CASHIER"]).optional(),
  internalNote: z.string().optional(),
  storeId: z.string().min(1).optional(),
});
export type OwnerStaffPatchInput = z.infer<typeof ownerStaffPatchSchema>;

/** Input schema for deactivating a staff user. */
export const staffDeactivateSchema = z.object({
  reason: z.string().optional(),
});
export type StaffDeactivateInput = z.infer<typeof staffDeactivateSchema>;
