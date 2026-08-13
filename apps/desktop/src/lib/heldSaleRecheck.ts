/**
 * Soft resume recheck for held sales (M3 Batch AO).
 *
 * Soft hold does NOT reserve stock. On resume, each parked line is checked
 * against live catalog (online batches API, else local cache):
 *
 *   1. Batch missing / not in-stock → STRIP (unsellable)
 *   2. Expired (expiryDate < today, or Select Batch `sellable === false`) → STRIP
 *   3. Remaining on-hand after earlier resumed lines on the same batch
 *      cannot supply even 1 packaging unit → STRIP
 *   4. Remaining on-hand can supply some but not all of `quantityBase` → CLAMP
 *      `unitQty` / `quantityBase` / `lineTotal` / `maxUnitQty` down to max whole units
 *   5. Else KEEP; refresh on-hand, expiry, sellPerBase, FEFO flag from live batch
 *
 * If every line is stripped, the caller must keep the hold in storage (do not
 * resume an empty cart). Cashier edits remaining lines before pay.
 *
 * Same-batch lines allocate in snapshot order (no hard reservation).
 * FEFO override metadata is kept on surviving lines.
 *
 * TODO(cloud): no hold/reserve API in this slice.
 */

import type { CartLine } from "@/features/pos/cartTypes";
import { loadBatchesForProduct, type PosBatchRow } from "@/lib/batchSelect";
import { forceOfflineStore } from "@/lib/forceOfflineStore";
import { todayYmd } from "@/lib/productSearch";
import { lineTotal, quantityBase } from "@/lib/qtyPackaging";

export type HeldSaleLiveBatch = {
  batchId: string;
  expiryDate: string;
  quantityOnHand: number;
  sellPerBase: number;
  expired: boolean;
  fefo: boolean;
};

export type HeldSaleRecheckResult =
  | { ok: false; reason: "lookup_failed" }
  | {
      ok: true;
      lines: CartLine[];
      stripped: number;
      clamped: number;
      kept: number;
    };

/** True when POS catalog lookups should hit the cloud (Force Offline + browser). */
export function posCatalogOnline(): boolean {
  if (forceOfflineStore.get()) return false;
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

function toLive(row: PosBatchRow, today: string): HeldSaleLiveBatch {
  const expiryDate = row.expiryDate.slice(0, 10);
  return {
    batchId: row.batchId,
    expiryDate,
    quantityOnHand: Math.max(0, Math.trunc(row.quantityOnHand)),
    sellPerBase: Math.max(0, row.sellPerBase),
    expired: !row.sellable || row.status === "expired" || expiryDate < today,
    fefo: row.status === "fefo",
  };
}

function cloneLine(line: CartLine): CartLine {
  return {
    ...line,
    fefoOverride: line.fefoOverride ? { ...line.fefoOverride } : line.fefoOverride,
  };
}

function applyLivePricing(line: CartLine, live: HeldSaleLiveBatch): CartLine {
  const sellPerBase = live.sellPerBase;
  const unitPrice = sellPerBase * Math.max(1, line.factorToBase);
  return {
    ...line,
    expiryDate: live.expiryDate,
    batchQtyOnHand: live.quantityOnHand,
    sellPerBase,
    unitPrice,
    fefo: live.fefo,
    lineTotal: lineTotal(unitPrice, line.unitQty),
  };
}

/**
 * Pure recheck against a live batch map (keyed by batchId).
 * Does not I/O. Missing map entries are treated as unsellable (strip).
 */
export function recheckHeldSaleLines(
  lines: CartLine[],
  liveByBatchId: ReadonlyMap<string, HeldSaleLiveBatch>,
  today: string = todayYmd(),
): Extract<HeldSaleRecheckResult, { ok: true }> {
  const remaining = new Map<string, number>();
  for (const [id, live] of liveByBatchId) {
    remaining.set(id, Math.max(0, Math.trunc(live.quantityOnHand)));
  }

  const next: CartLine[] = [];
  let stripped = 0;
  let clamped = 0;
  let kept = 0;

  for (const raw of lines) {
    const live = liveByBatchId.get(raw.batchId);
    if (!live || live.quantityOnHand <= 0) {
      stripped += 1;
      continue;
    }
    if (live.expired || live.expiryDate < today) {
      stripped += 1;
      continue;
    }

    const factor = Math.max(1, Math.trunc(raw.factorToBase));
    const avail = remaining.get(raw.batchId) ?? 0;
    const maxUnits = Math.floor(avail / factor);
    if (maxUnits < 1) {
      stripped += 1;
      continue;
    }

    let line = applyLivePricing(cloneLine(raw), live);
    const wantUnits = Math.max(1, Math.trunc(line.unitQty));
    if (wantUnits > maxUnits) {
      line = {
        ...line,
        unitQty: maxUnits,
        quantityBase: quantityBase(factor, maxUnits),
        lineTotal: lineTotal(line.unitPrice, maxUnits),
        maxUnitQty: maxUnits,
      };
      clamped += 1;
    } else {
      line = { ...line, maxUnitQty: maxUnits };
      kept += 1;
    }

    remaining.set(raw.batchId, Math.max(0, avail - line.quantityBase));
    next.push(line);
  }

  return { ok: true, lines: next, stripped, clamped, kept };
}

async function loadLiveBatchesForLines(
  lines: CartLine[],
  online: boolean,
): Promise<Map<string, HeldSaleLiveBatch>> {
  const today = todayYmd();
  const productIds = [...new Set(lines.map((l) => l.productId).filter(Boolean))];
  const map = new Map<string, HeldSaleLiveBatch>();
  const groups = await Promise.all(
    productIds.map((productId) => loadBatchesForProduct(productId, { online })),
  );
  for (const rows of groups) {
    for (const row of rows) {
      map.set(row.batchId, toLive(row, today));
    }
  }
  return map;
}

/** Load live lots and apply strip/clamp. `lookup_failed` only on unexpected throws. */
export async function recheckHeldSale(
  lines: CartLine[],
  opts?: { online?: boolean },
): Promise<HeldSaleRecheckResult> {
  const online = opts?.online ?? posCatalogOnline();
  try {
    const live = await loadLiveBatchesForLines(lines, online);
    return recheckHeldSaleLines(lines, live);
  } catch {
    return { ok: false, reason: "lookup_failed" };
  }
}
