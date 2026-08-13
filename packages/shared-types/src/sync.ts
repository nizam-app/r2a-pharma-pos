import { z } from "zod";

/**
 * Offline outbound sync queue / cloud ingest envelope.
 * Field names match the local queue contract (`event_id`, `entity_type`, …).
 * Sale domain DTOs use camelCase `eventId` — map at the sync boundary.
 */

export const syncEntityTypeSchema = z.enum([
  "sale",
  "stock_delta",
  "product",
  "customer",
]);
export type SyncEntityType = z.infer<typeof syncEntityTypeSchema>;

export const syncActionSchema = z.enum(["create", "update", "delete"]);
export type SyncAction = z.infer<typeof syncActionSchema>;

export const syncEventSchema = z.object({
  event_id: z.string().min(1),
  entity_type: syncEntityTypeSchema,
  action: syncActionSchema,
  payload: z.record(z.unknown()),
  created_at: z.coerce.date().optional(),
});
export type SyncEvent = z.infer<typeof syncEventSchema>;

export const syncIngestBatchSchema = z.object({
  events: z.array(syncEventSchema).min(1),
});
export type SyncIngestBatch = z.infer<typeof syncIngestBatchSchema>;

/** Per-event outcome from `POST /api/v1/sync/ingest`. */
export const syncIngestResultStatusSchema = z.enum([
  "accepted",
  "duplicate",
  "rejected",
]);
export type SyncIngestResultStatus = z.infer<typeof syncIngestResultStatusSchema>;

export const syncIngestEventResultSchema = z.object({
  eventId: z.string().min(1),
  status: syncIngestResultStatusSchema,
  message: z.string().optional(),
  /** Serialized sale on accepted/duplicate; cashiers omit `costPerBase`. */
  sale: z.unknown().optional(),
});
export type SyncIngestEventResult = z.infer<typeof syncIngestEventResultSchema>;

export const syncIngestResultSchema = z.object({
  results: z.array(syncIngestEventResultSchema),
});
export type SyncIngestResult = z.infer<typeof syncIngestResultSchema>;
