import { z } from "zod";
import { roleSchema } from "./enums";

/**
 * API DTOs use camelCase (aligned with Prisma field names).
 * tenantId / storeId come from JWT in M2 — not trusted from body alone.
 */

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  /** Optional tenant slug when email alone is not unique across tenants. */
  tenantSlug: z.string().min(1).optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  tenantName: z.string().min(1),
  tenantSlug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be lowercase kebab-case"),
  storeName: z.string().min(1).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

/** OWNER/MANAGER creates staff in the same tenant (no public self-register). */
export const staffCreateSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
  role: z.enum(["CASHIER", "MANAGER"]),
  storeId: z.string().min(1).optional(),
});
export type StaffCreateInput = z.infer<typeof staffCreateSchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

/** JWT claim shape used by Cloud API (Milestone 2+). */
export const jwtClaimsSchema = z.object({
  sub: z.string().min(1),
  role: roleSchema,
  tenantId: z.string().min(1),
  storeId: z.string().min(1).nullable(),
});
export type JwtClaims = z.infer<typeof jwtClaimsSchema>;

/** Safe user projection for auth responses (never includes passwordHash). */
export const safeUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: roleSchema,
  tenantId: z.string(),
  storeId: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
});
export type SafeUser = z.infer<typeof safeUserSchema>;
