import { z } from "zod";
import {
  customerGenderSchema,
  customerSourceSchema,
  customerStatusSchema,
} from "./enums";

const idSchema = z.string().trim().min(1).max(128);
const pageSchema = {
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
};

export const customerCreateSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional(),
  dateOfBirth: z.coerce.date().optional(),
  gender: customerGenderSchema.optional(),
  address: z.string().trim().min(1).max(500).optional(),
  storeId: idSchema.optional(),
});
export type CustomerCreateInput = z.infer<typeof customerCreateSchema>;

export const customerUpdateSchema = z
  .object({
    name: z.string().min(1).optional(),
    phone: z.string().min(1).optional(),
    email: z.string().email().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field is required",
  });
export type CustomerUpdateInput = z.infer<typeof customerUpdateSchema>;

export const customerSearchSchema = z.object({
  q: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  ...pageSchema,
});
export type CustomerSearchInput = z.infer<typeof customerSearchSchema>;

/** Unused until Batch AF (`GET /customers/phone-check`). */
export const customerPhoneCheckQuerySchema = z.object({
  phone: z.string().min(1),
});
export type CustomerPhoneCheckQuery = z.infer<
  typeof customerPhoneCheckQuerySchema
>;

/** Unused until Batch AF (`GET /owner/customers`). */
export const ownerCustomerListQuerySchema = z.object({
  q: z.string().min(1).optional(),
  status: customerStatusSchema.optional(),
  source: customerSourceSchema.optional(),
  sort: z.enum(["name", "createdAt", "loyaltyPoints"]).optional(),
  limit: z.coerce.number().int().positive().max(100).default(25),
  offset: z.coerce.number().int().nonnegative().default(0),
});
export type OwnerCustomerListQuery = z.infer<
  typeof ownerCustomerListQuerySchema
>;

/** Unused until Batch AF (`POST /owner/customers/:id/approve`). */
export const ownerCustomerApproveSchema = z
  .object({
    name: z.string().min(1).optional(),
    phone: z.string().min(1).optional(),
    email: z.string().email().nullable().optional(),
    dateOfBirth: z.coerce.date().nullable().optional(),
    gender: customerGenderSchema.nullable().optional(),
    address: z.string().trim().min(1).max(500).nullable().optional(),
  })
  .strict();
export type OwnerCustomerApproveInput = z.infer<
  typeof ownerCustomerApproveSchema
>;

/** Unused until Batch AF (`POST /owner/customers/:id/reject`). */
export const ownerCustomerRejectSchema = z
  .object({
    rejectionNote: z.string().trim().min(1).max(1000).optional(),
  })
  .strict();
export type OwnerCustomerRejectInput = z.infer<
  typeof ownerCustomerRejectSchema
>;
