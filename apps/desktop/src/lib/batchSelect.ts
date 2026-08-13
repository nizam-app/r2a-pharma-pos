/**
 * Select Batch data (Batch I).
 * Online → M2 batch list + FEFO helper; Offline → SQLite/memory cache + expiry sort.
 */

import { apiRequest } from "@/lib/api";
import { listCachedBatches } from "@/lib/localDb/client";
import type { CachedBatch } from "@/lib/localDb/types";
import { pickSellableFefo, todayYmd } from "@/lib/productSearch";

export type BatchRowStatus = "fefo" | "standard" | "expired";

export type PosBatchRow = {
  batchId: string;
  batchNumber: string;
  expiryDate: string;
  quantityOnHand: number;
  sellPerBase: number;
  status: BatchRowStatus;
  /** False when expired — Enter must not confirm. */
  sellable: boolean;
};

type ApiBatch = {
  id?: unknown;
  productId?: unknown;
  storeId?: unknown;
  batchNumber?: unknown;
  expiryDate?: unknown;
  quantityOnHand?: unknown;
  sellPerBase?: unknown;
};

function str(v: unknown): string {
  return v == null ? "" : String(v);
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function mapApiBatch(raw: ApiBatch, cachedAt: string): CachedBatch | null {
  const id = str(raw.id);
  const productId = str(raw.productId);
  if (!id || !productId) return null;
  const expiry = raw.expiryDate;
  const expiryDate =
    typeof expiry === "string"
      ? expiry.slice(0, 10)
      : str(expiry).slice(0, 10);
  return {
    id,
    productId,
    storeId: str(raw.storeId),
    batchNumber: str(raw.batchNumber),
    expiryDate: expiryDate || "1970-01-01",
    quantityOnHand: Math.max(0, Math.trunc(num(raw.quantityOnHand, 0))),
    sellPerBase: Math.max(0, num(raw.sellPerBase, 0)),
    cachedAt,
  };
}

function asBatchList(data: unknown): ApiBatch[] {
  if (Array.isArray(data)) return data as ApiBatch[];
  return [];
}

async function fetchOnlineBatches(productId: string): Promise<CachedBatch[]> {
  const qs = new URLSearchParams({
    productId,
    limit: "50",
    offset: "0",
  });
  const raw = await apiRequest<unknown>(`/api/v1/batches?${qs}`);
  const cachedAt = new Date().toISOString();
  return asBatchList(raw)
    .map((b) => mapApiBatch(b, cachedAt))
    .filter((b): b is CachedBatch => b != null && b.productId === productId);
}

/**
 * Online FEFO helper — may return an expired lot if that is earliest in-stock.
 * We only treat it as recommended when it is still sellable.
 */
async function fetchOnlineFefoId(
  productId: string,
): Promise<string | null> {
  try {
    const raw = await apiRequest<ApiBatch>(
      `/api/v1/products/${encodeURIComponent(productId)}/fefo-batch`,
    );
    const id = str(raw?.id);
    return id || null;
  } catch {
    return null;
  }
}

function toRows(
  batches: CachedBatch[],
  fefoId: string | null,
  today: string,
): PosBatchRow[] {
  const inStock = batches.filter((b) => b.quantityOnHand > 0);
  const rows: PosBatchRow[] = inStock.map((b) => {
    const expired = b.expiryDate < today;
    let status: BatchRowStatus;
    if (expired) {
      status = "expired";
    } else if (fefoId && b.id === fefoId) {
      status = "fefo";
    } else {
      status = "standard";
    }
    return {
      batchId: b.id,
      batchNumber: b.batchNumber,
      expiryDate: b.expiryDate,
      quantityOnHand: b.quantityOnHand,
      sellPerBase: b.sellPerBase,
      status,
      sellable: !expired,
    };
  });

  // Ensure exactly one FEFO highlight among sellable rows when possible.
  const hasFefo = rows.some((r) => r.status === "fefo");
  if (!hasFefo) {
    const fallback = pickSellableFefo(inStock, today);
    if (fallback) {
      for (const row of rows) {
        if (row.batchId === fallback.id) {
          row.status = "fefo";
          break;
        }
      }
    }
  }

  rows.sort((a, b) => {
    // Sellable (non-expired) first, then expired; within group by expiry ASC.
    if (a.sellable !== b.sellable) return a.sellable ? -1 : 1;
    const byExp = a.expiryDate.localeCompare(b.expiryDate);
    if (byExp !== 0) return byExp;
    return a.batchNumber.localeCompare(b.batchNumber);
  });

  return rows;
}

/**
 * Load in-stock batches for the Select Batch modal.
 */
export async function loadBatchesForProduct(
  productId: string,
  opts: { online: boolean },
): Promise<PosBatchRow[]> {
  const today = todayYmd();

  if (opts.online) {
    try {
      const [batches, apiFefoId] = await Promise.all([
        fetchOnlineBatches(productId),
        fetchOnlineFefoId(productId),
      ]);
      // Prefer M2 FEFO id only when that lot is still sellable.
      const apiFefo = apiFefoId
        ? batches.find((b) => b.id === apiFefoId)
        : undefined;
      const fefoId =
        apiFefo && apiFefo.quantityOnHand > 0 && apiFefo.expiryDate >= today
          ? apiFefo.id
          : pickSellableFefo(batches, today)?.id ?? null;
      return toRows(batches, fefoId, today);
    } catch {
      // Fall through to local cache.
    }
  }

  const cached = await listCachedBatches(productId);
  const fefoId = pickSellableFefo(cached, today)?.id ?? null;
  return toRows(cached, fefoId, today);
}

/** Index of the FEFO row (default focus); else first sellable; else 0. */
export function defaultBatchFocusIndex(rows: PosBatchRow[]): number {
  const fefo = rows.findIndex((r) => r.status === "fefo");
  if (fefo >= 0) return fefo;
  const sellable = rows.findIndex((r) => r.sellable);
  if (sellable >= 0) return sellable;
  return 0;
}
