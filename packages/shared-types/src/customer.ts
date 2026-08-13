import { z } from "zod";

export const customerCreateSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1).optional(),
  email: z.string().email().optional(),
});
export type CustomerCreateInput = z.infer<typeof customerCreateSchema>;

export const customerUpdateSchema = z
  .object({
    name: z.string().min(1).optional(),
    phone: z.string().min(1).nullable().optional(),
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
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});
export type CustomerSearchInput = z.infer<typeof customerSearchSchema>;
