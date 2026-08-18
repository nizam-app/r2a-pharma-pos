import { z } from "zod";
import {
  purchaseOrderStatusSchema,
  returnManifestStatusSchema,
  supplierStatusSchema,
} from "./enums";

const idSchema = z.string().trim().min(1).max(128);
const optionalTextSchema = (max: number) =>
  z.string().trim().min(1).max(max).nullable().optional();
const pageSchema = {
  limit: z.coerce.number().int().positive().max(100).default(25),
  offset: z.coerce.number().int().nonnegative().default(0),
};
const queryBooleanSchema = z
  .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
  .transform((value) =>
    typeof value === "boolean" ? value : value === "true" || value === "1",
  );

export const supplierPreferredContactSchema = z.enum([
  "PHONE",
  "EMAIL",
  "WHATSAPP",
]);
export type SupplierPreferredContact = z.infer<
  typeof supplierPreferredContactSchema
>;

export const supplierCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    contactPerson: z.string().trim().min(1).max(160),
    phone: z.string().trim().min(1).max(40),
    email: z.string().trim().email().max(254).nullable().optional(),
    address: optionalTextSchema(500),
    city: optionalTextSchema(120),
    registrationNumber: optionalTextSchema(120),
    notes: optionalTextSchema(1000),
    paymentTerms: optionalTextSchema(160),
    leadTimeDays: z.number().int().nonnegative().nullable().optional(),
    minOrderValue: z.number().nonnegative().nullable().optional(),
    status: supplierStatusSchema.optional().default("ACTIVE"),
    expiryReturnsAccepted: z.boolean().optional().default(false),
    minDaysBeforeExpiry: z.number().int().nonnegative().nullable().optional(),
    returnNotes: optionalTextSchema(1000),
    preferredContact: supplierPreferredContactSchema.nullable().optional(),
    secondaryPhone: optionalTextSchema(40),
    isActive: z.boolean().optional().default(true),
  })
  .strict();
export type SupplierCreateInput = z.infer<typeof supplierCreateSchema>;

export const supplierUpdateSchema = supplierCreateSchema
  .omit({ status: true, expiryReturnsAccepted: true, isActive: true })
  .partial()
  .extend({
    status: supplierStatusSchema.optional(),
    expiryReturnsAccepted: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });
export type SupplierUpdateInput = z.infer<typeof supplierUpdateSchema>;

export const supplierListQuerySchema = z.object({
  q: z.string().trim().min(1).max(160).optional(),
  status: supplierStatusSchema.optional(),
  isActive: queryBooleanSchema.optional(),
  ...pageSchema,
});
export type SupplierListQuery = z.infer<typeof supplierListQuerySchema>;

export const supplierIdParamSchema = z.object({ supplierId: idSchema });
export type SupplierIdParam = z.infer<typeof supplierIdParamSchema>;

export const purchaseOrderLineInputSchema = z.object({
  productId: idSchema,
  qtyOrdered: z.number().int().positive(),
  costPerBase: z.number().nonnegative(),
});
export type PurchaseOrderLineInput = z.infer<
  typeof purchaseOrderLineInputSchema
>;

export const purchaseOrderCreateSchema = z
  .object({
    supplierId: idSchema,
    status: z.enum(["DRAFT", "SENT"]).default("SENT"),
    reference: optionalTextSchema(160),
    expectedDelivery: z.coerce.date().nullable().optional(),
    estimatedTax: z.number().nonnegative().optional().default(0),
    lines: z.array(purchaseOrderLineInputSchema).min(1).max(500),
  })
  .strict();
export type PurchaseOrderCreateInput = z.infer<
  typeof purchaseOrderCreateSchema
>;

export const purchaseOrderDraftUpdateSchema = z
  .object({
    supplierId: idSchema.optional(),
    status: z.enum(["DRAFT", "SENT"]).optional(),
    reference: optionalTextSchema(160),
    expectedDelivery: z.coerce.date().nullable().optional(),
    estimatedTax: z.number().nonnegative().optional(),
    lines: z.array(purchaseOrderLineInputSchema).min(1).max(500).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });
export type PurchaseOrderDraftUpdateInput = z.infer<
  typeof purchaseOrderDraftUpdateSchema
>;

export const purchaseOrderListQuerySchema = z.object({
  q: z.string().trim().min(1).max(160).optional(),
  status: purchaseOrderStatusSchema.optional(),
  supplierId: idSchema.optional(),
  ...pageSchema,
});
export type PurchaseOrderListQuery = z.infer<
  typeof purchaseOrderListQuerySchema
>;

export const purchaseOrderIdParamSchema = z.object({ poId: idSchema });
export type PurchaseOrderIdParam = z.infer<typeof purchaseOrderIdParamSchema>;

export const goodsReceiptLineInputSchema = z.object({
  purchaseOrderLineId: idSchema,
  productId: idSchema,
  qty: z.number().int().positive(),
  batchNumber: z.string().trim().min(1).max(120),
  expiryDate: z.coerce.date(),
  costPerBase: z.number().nonnegative(),
  sellPerBase: z.number().nonnegative(),
});
export type GoodsReceiptLineInput = z.infer<
  typeof goodsReceiptLineInputSchema
>;

export const goodsReceiptCreateSchema = z
  .object({
    supplierInvoiceRef: optionalTextSchema(160),
    deliveryNote: optionalTextSchema(500),
    receivedAt: z.coerce.date().optional(),
    lines: z.array(goodsReceiptLineInputSchema).min(1).max(500),
  })
  .strict();
export type GoodsReceiptCreateInput = z.infer<
  typeof goodsReceiptCreateSchema
>;

export const returnQueueQuerySchema = z.object({
  q: z.string().trim().min(1).max(160).optional(),
  supplierId: idSchema.optional(),
  returnStatus: z
    .enum(["ELIGIBLE", "NOT_ELIGIBLE", "MANIFEST_PREPARED"])
    .optional(),
  ...pageSchema,
});
export type ReturnQueueQuery = z.infer<typeof returnQueueQuerySchema>;

export const returnManifestLineInputSchema = z.object({
  batchId: idSchema,
  returnQty: z.number().int().positive(),
});
export type ReturnManifestLineInput = z.infer<
  typeof returnManifestLineInputSchema
>;

export const returnManifestCreateSchema = z
  .object({
    supplierId: idSchema,
    notes: optionalTextSchema(1000),
    lines: z.array(returnManifestLineInputSchema).min(1).max(500),
  })
  .strict();
export type ReturnManifestCreateInput = z.infer<
  typeof returnManifestCreateSchema
>;

export const returnManifestListQuerySchema = z.object({
  q: z.string().trim().min(1).max(160).optional(),
  supplierId: idSchema.optional(),
  status: returnManifestStatusSchema.optional(),
  ...pageSchema,
});
export type ReturnManifestListQuery = z.infer<
  typeof returnManifestListQuerySchema
>;

export const returnManifestIdParamSchema = z.object({ manifestId: idSchema });
export type ReturnManifestIdParam = z.infer<
  typeof returnManifestIdParamSchema
>;

export const returnManifestDispatchSchema = z
  .object({
    operationId: idSchema,
    dispatchedAt: z.coerce.date().optional(),
    dispatchReference: optionalTextSchema(160),
    dispatchNotes: optionalTextSchema(1000),
  })
  .strict();
export type ReturnManifestDispatchInput = z.infer<
  typeof returnManifestDispatchSchema
>;

export const returnSupplierDecisionSchema = z.enum(["ACCEPTED", "REJECTED"]);
export type ReturnSupplierDecision = z.infer<
  typeof returnSupplierDecisionSchema
>;

export const returnManifestDecisionSchema = z
  .object({
    decision: returnSupplierDecisionSchema,
    supplierReference: optionalTextSchema(160),
    notes: optionalTextSchema(1000),
    decidedAt: z.coerce.date().optional(),
  })
  .strict();
export type ReturnManifestDecisionInput = z.infer<
  typeof returnManifestDecisionSchema
>;

export const returnManifestCompleteSchema = z
  .object({ completedAt: z.coerce.date().optional() })
  .strict();
export type ReturnManifestCompleteInput = z.infer<
  typeof returnManifestCompleteSchema
>;
