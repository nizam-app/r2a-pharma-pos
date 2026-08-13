import {
  saleIngestSchema,
  type SyncEvent,
  type SyncIngestBatch,
  type SyncIngestEventResult,
  type SyncIngestResult,
} from "@r2a/shared-types";
import { AppError } from "../../utils/AppError";
import type { TenantContext } from "../../types/tenant";
import { ingestSale } from "../sale/sale.service";

function formatZodError(error: {
  issues: Array<{ path: (string | number)[]; message: string }>;
}): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
      return `${path}${issue.message}`;
    })
    .join("; ");
}

async function processEvent(
  ctx: TenantContext,
  event: SyncEvent,
): Promise<SyncIngestEventResult> {
  if (event.entity_type !== "sale" || event.action !== "create") {
    return {
      eventId: event.event_id,
      status: "rejected",
      message: `unsupported entity_type/action: ${event.entity_type}/${event.action}`,
    };
  }

  const parsed = saleIngestSchema.safeParse(event.payload);
  if (!parsed.success) {
    return {
      eventId: event.event_id,
      status: "rejected",
      message: formatZodError(parsed.error),
    };
  }

  try {
    const result = await ingestSale(ctx, {
      ...parsed.data,
      eventId: event.event_id,
    });
    return {
      eventId: event.event_id,
      status: result.idempotent ? "duplicate" : "accepted",
      sale: result.sale,
    };
  } catch (err) {
    if (err instanceof AppError && err.statusCode >= 400 && err.statusCode < 500) {
      return {
        eventId: event.event_id,
        status: "rejected",
        message: err.message,
      };
    }
    throw err;
  }
}

/**
 * Process a sync ingest batch in array order.
 * Partial success: poison / unsupported events are `rejected`; earlier
 * accepted rows stay committed. Reuses `ingestSale` (delta stock, eventId idempotency).
 */
export async function ingestSyncBatch(
  ctx: TenantContext,
  batch: SyncIngestBatch,
): Promise<SyncIngestResult> {
  const results: SyncIngestEventResult[] = [];
  for (const event of batch.events) {
    results.push(await processEvent(ctx, event));
  }
  return { results };
}
