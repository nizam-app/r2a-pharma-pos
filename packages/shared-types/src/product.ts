import { z } from "zod";
import { unitTypeSchema } from "./enums";

/** Unit conversion row nested under product create/update. */
export const productUnitInputSchema = z.object({
  unitType: unitTypeSchema,
  factorToBase: z.number().int().positive(),
  label: z.string().min(1).optional(),
});
export type ProductUnitInput = z.infer<typeof productUnitInputSchema>;

export const productCreateSchema = z.object({
  name: z.string().min(1),
  genericName: z.string().min(1).optional(),
  manufacturer: z.string().min(1).optional(),
  strength: z.string().min(1).optional(),
  form: z.string().min(1).optional(),
  sku: z.string().min(1).optional(),
  barcode: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.string().min(1).optional(),
  requiresPrescription: z.boolean().optional(),
  coldChain: z.boolean().optional(),
  storageNotes: z.string().optional(),
  reorderLevel: z.number().int().nonnegative().optional(),
  units: z.array(productUnitInputSchema).min(1),
});
export type ProductCreateInput = z.infer<typeof productCreateSchema>;

export const productUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  genericName: z.string().min(1).nullable().optional(),
  manufacturer: z.string().min(1).nullable().optional(),
  strength: z.string().min(1).nullable().optional(),
  form: z.string().min(1).nullable().optional(),
  sku: z.string().min(1).nullable().optional(),
  barcode: z.string().min(1).nullable().optional(),
  description: z.string().nullable().optional(),
  category: z.string().min(1).nullable().optional(),
  requiresPrescription: z.boolean().optional(),
  coldChain: z.boolean().optional(),
  storageNotes: z.string().nullable().optional(),
  reorderLevel: z.number().int().nonnegative().nullable().optional(),
  isActive: z.boolean().optional(),
  units: z.array(productUnitInputSchema).min(1).optional(),
});
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;

/** Query-string friendly (coerce numbers / booleans from Express query). */
export const productSearchSchema = z.object({
  q: z.string().min(1).optional(),
  barcode: z.string().min(1).optional(),
  sku: z.string().min(1).optional(),
  genericName: z.string().min(1).optional(),
  manufacturer: z.string().min(1).optional(),
  isActive: z
    .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      if (typeof v === "boolean") return v;
      return v === "true" || v === "1";
    }),
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});
export type ProductSearchInput = z.infer<typeof productSearchSchema>;

export const idParamSchema = z.object({
  id: z.string().min(1),
});
export type IdParam = z.infer<typeof idParamSchema>;

export const productIdParamSchema = z.object({
  productId: z.string().min(1),
});
export type ProductIdParam = z.infer<typeof productIdParamSchema>;
