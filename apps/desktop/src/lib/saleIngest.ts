/**
 * Build + POST sale ingest (Batch T zero-pay + Batch X cash + AC card + AD MFS).
 *
 * M2 contract mapping:
 * - Loyalty redeem → `discount` so `total = subtotal − discount` holds
 * - Tender payment amount = sale `total` (amount due), not cash received
 * - Zero due → `payments: [{ method: "CASH", amount: 0 }]` (min 1 payment; amount ≥ 0 OK)
 * - MFS provider / payer / trx → notes meta (schema has no payment provider field)
 * - M6 D: also send `loyaltyUsed` / `loyaltyEarned` and per-line FEFO flags
 *
 * TODO(real integration):
 * - Prefer non-CASH zero tender type if product re-locks
 * - Card auth/ref codes from terminal SDK (notes stub only today)
 * - First-class MFS provider + Trx ID on Payment (today notes only)
 */

import type { SaleIngestInput } from "@r2a/shared-types";
import type { CartLine } from "@/features/pos/cartTypes";
import { apiRequest, ApiError } from "@/lib/api";
import {
  applyCachedStockDelta,
  countUnsynced,
  enqueueSyncEvent,
} from "@/lib/localDb/client";
import { settleLoyaltyForSale } from "@/lib/loyaltyCalc";
import type { AppliedLoyaltyRedeem } from "@/lib/loyaltyRedeem";

export type IngestedSaleSummary = {
  id: string;
  eventId: string;
  /** Display txn label for Sale Completed. */
  txnLabel: string;
  total: number;
  subtotal: number;
  discount: number;
  idempotent: boolean;
};

type ApiSale = {
  id?: unknown;
  eventId?: unknown;
  total?: unknown;
  subtotal?: unknown;
  discount?: unknown;
};

function str(v: unknown): string {
  return v == null ? "" : String(v);
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Human txn label — prefer short id suffix when cloud returns cuid. */
export function formatTxnLabel(saleId: string, eventId: string): string {
  const raw = saleId.trim() || eventId.trim();
  if (!raw) return "TXN-LOCAL";
  // Stable display: TXN- + last 8–12 alnum chars uppercased.
  const alnum = raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const tail = alnum.slice(-10) || alnum;
  return `TXN-${tail}`;
}

export type SaleIngestBuildArgs = {
  eventId: string;
  storeId: string;
  customerId: string | null;
  lines: CartLine[];
  cartSubtotal: number;
  cartDiscount?: number;
  appliedLoyalty: AppliedLoyaltyRedeem | null;
  /** Single tender covering `total` (CASH / CARD / MFS). */
  paymentMethod?: "CASH" | "CARD" | "MFS";
  /** Optional cash tender meta for notes (not a second payment line). */
  cashMeta?: {
    cashReceived: number;
    changeDue: number;
  } | null;
  /** Optional card tender meta for notes (Batch AC stub). */
  cardMeta?: {
    status: "Approved";
  } | null;
  /** Optional MFS tender meta for notes (Batch AD invent). */
  mfsMeta?: {
    provider: string;
    payerMobile: string;
    trxId?: string | null;
  } | null;
};

export function buildSaleIngestPayload(
  args: SaleIngestBuildArgs,
): SaleIngestInput {
  const cartDiscount = Math.max(0, args.cartDiscount ?? 0);
  const loyaltyTaka = Math.max(0, args.appliedLoyalty?.taka ?? 0);
  /** Map loyalty redeem into M2 `discount` until ingest gains loyalty fields. */
  const discount = cartDiscount + loyaltyTaka;
  const subtotal = Math.max(0, args.cartSubtotal);
  const total = Math.max(0, subtotal - discount);
  const paymentMethod = args.paymentMethod ?? "CASH";

  const notesParts: string[] = [];
  if (args.appliedLoyalty && args.appliedLoyalty.points > 0) {
    notesParts.push(
      `loyaltyRedeem:${args.appliedLoyalty.points}pts=${args.appliedLoyalty.taka.toFixed(2)}`,
    );
  }
  if (args.cashMeta) {
    notesParts.push(
      `cash:recv=${args.cashMeta.cashReceived.toFixed(2)};change=${args.cashMeta.changeDue.toFixed(2)}`,
    );
  }
  if (args.cardMeta) {
    notesParts.push(`card:status=${args.cardMeta.status}`);
  }
  if (args.mfsMeta) {
    const trx = args.mfsMeta.trxId?.trim();
    notesParts.push(
      [
        `mfs:provider=${args.mfsMeta.provider}`,
        `payer=${args.mfsMeta.payerMobile}`,
        trx ? `trx=${trx}` : null,
      ]
        .filter(Boolean)
        .join(";"),
    );
  }
  const overrideLines = args.lines.filter((l) => l.fefoOverride);
  if (overrideLines.length > 0) {
    notesParts.push(
      `fefoOverride:${overrideLines
        .map(
          (l) =>
            `${l.batchNumber}@${l.fefoOverride?.authorizedByName ?? "mgr"}`,
        )
        .join(",")}`,
    );
  }

  const loyaltyFields = args.customerId
    ? (() => {
        const settlement = settleLoyaltyForSale({
          previousBalance: 0,
          applied: args.appliedLoyalty,
          cartSubtotal: args.cartSubtotal,
          cartDiscount,
        });
        return {
          loyaltyUsed: settlement.used,
          loyaltyEarned: settlement.earned,
        };
      })()
    : {};

  return {
    eventId: args.eventId,
    storeId: args.storeId,
    customerId: args.customerId ?? undefined,
    subtotal,
    discount,
    total,
    notes: notesParts.length > 0 ? notesParts.join("; ") : undefined,
    ...loyaltyFields,
    items: args.lines.map((line) => {
      const item: SaleIngestInput["items"][number] = {
        productId: line.productId,
        batchId: line.batchId,
        unitType: line.unitType,
        unitQty: line.unitQty,
        quantityBase: line.quantityBase,
        unitPrice: line.unitPrice,
        lineTotal: line.lineTotal,
      };
      if (line.fefoOverride) {
        item.fefoOverride = true;
        const by = line.fefoOverride.authorizedByName.trim();
        if (by) item.fefoAuthorizedByName = by;
      }
      return item;
    }),
    // Payment amount = sale total (amount due), not cash received / change.
    payments: [{ method: paymentMethod, amount: total }],
  };
}

/** @deprecated Prefer buildSaleIngestPayload — kept for Batch T call sites. */
export function buildZeroPayIngestPayload(args: {
  eventId: string;
  storeId: string;
  customerId: string | null;
  lines: CartLine[];
  cartSubtotal: number;
  cartDiscount?: number;
  appliedLoyalty: AppliedLoyaltyRedeem | null;
}): SaleIngestInput {
  return buildSaleIngestPayload({
    ...args,
    paymentMethod: "CASH",
  });
}

export async function ingestSale(
  payload: SaleIngestInput,
): Promise<IngestedSaleSummary> {
  const data = await apiRequest<ApiSale>("/api/v1/sales/ingest", {
    method: "POST",
    body: payload,
  });

  const id = str(data?.id);
  const eventId = str(data?.eventId) || payload.eventId;

  return {
    id,
    eventId,
    txnLabel: formatTxnLabel(id, eventId),
    total: num(data?.total, payload.total),
    subtotal: num(data?.subtotal, payload.subtotal),
    discount: num(data?.discount, payload.discount),
    idempotent: false,
  };
}

/** Alias — zero-pay and cash share the same ingest endpoint. */
export async function ingestZeroPaySale(
  payload: SaleIngestInput,
): Promise<IngestedSaleSummary> {
  return ingestSale(payload);
}

/**
 * User-facing ingest failure copy.
 * Preserves ApiError / Error.message from the server or thrown Error.
 * `fallback` must be a localized frontend-owned string (no Slice/Batch terms).
 */
export function saleIngestErrorMessage(
  err: unknown,
  fallback: string,
): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export type SaleCompleteConnectivity = {
  isOnline: boolean;
  forcedOffline: boolean;
};

export type CompleteSaleResult = IngestedSaleSummary & {
  queued: boolean;
  pendingCount: number;
};

export type CompleteSaleOrQueueDeps = {
  ingestSale?: (payload: SaleIngestInput) => Promise<IngestedSaleSummary>;
  enqueueSyncEvent?: typeof enqueueSyncEvent;
  applyCachedStockDelta?: typeof applyCachedStockDelta;
  countUnsynced?: typeof countUnsynced;
};

/**
 * 4xx (validation / 409 stock / 401) stay on payment.
 * 408 / 429 / 5xx / network / TypeError → queue the same eventId.
 */
export function isTransientIngestFailure(err: unknown): boolean {
  if (err instanceof ApiError) {
    const code = err.statusCode;
    if (code === 408 || code === 429) return true;
    return code >= 500;
  }
  return true;
}

function summaryFromQueuedPayload(
  payload: SaleIngestInput,
): IngestedSaleSummary {
  return {
    id: payload.eventId,
    eventId: payload.eventId,
    txnLabel: formatTxnLabel(payload.eventId, payload.eventId),
    total: payload.total,
    subtotal: payload.subtotal,
    discount: payload.discount,
    idempotent: false,
  };
}

async function enqueueSaleCreate(
  payload: SaleIngestInput,
  deps: Required<
    Pick<
      CompleteSaleOrQueueDeps,
      "enqueueSyncEvent" | "applyCachedStockDelta" | "countUnsynced"
    >
  >,
): Promise<number> {
  await deps.enqueueSyncEvent({
    id: payload.eventId,
    entityType: "sale",
    action: "create",
    payload: { ...payload } as unknown as Record<string, unknown>,
  });
  for (const item of payload.items) {
    if (item.batchId) {
      await deps.applyCachedStockDelta(item.batchId, -item.quantityBase);
    }
  }
  try {
    return await deps.countUnsynced();
  } catch {
    return 0;
  }
}

/**
 * Online + not Force Offline → POST /sales/ingest.
 * Offline, Force Offline, or transient ingest failure → outbound_sync_queue.
 * Does not call the Batch D flush worker.
 */
export async function completeSaleOrQueue(
  payload: SaleIngestInput,
  connectivity: SaleCompleteConnectivity,
  deps: CompleteSaleOrQueueDeps = {},
): Promise<CompleteSaleResult> {
  const ingest = deps.ingestSale ?? ingestSale;
  const queueDeps = {
    enqueueSyncEvent: deps.enqueueSyncEvent ?? enqueueSyncEvent,
    applyCachedStockDelta:
      deps.applyCachedStockDelta ?? applyCachedStockDelta,
    countUnsynced: deps.countUnsynced ?? countUnsynced,
  };

  const shouldQueueImmediately =
    connectivity.forcedOffline || !connectivity.isOnline;

  if (!shouldQueueImmediately) {
    try {
      const ingested = await ingest(payload);
      let pendingCount = 0;
      try {
        pendingCount = await queueDeps.countUnsynced();
      } catch {
        pendingCount = 0;
      }
      return { ...ingested, queued: false, pendingCount };
    } catch (err) {
      if (!isTransientIngestFailure(err)) throw err;
    }
  }

  const pendingCount = await enqueueSaleCreate(payload, queueDeps);
  return {
    ...summaryFromQueuedPayload(payload),
    queued: true,
    pendingCount,
  };
}

