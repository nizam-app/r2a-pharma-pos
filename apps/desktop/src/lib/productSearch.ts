/**
 * POS product search (Batch H + catalog display fields).
 * Online → M2 GET /products; Offline → SQLite/memory catalog cache.
 * Stock / FEFO / price enriched from local batches (or one batches pull if cache cold).
 */

import { apiRequest } from "@/lib/api";
import { listCachedBatches, searchCachedProducts } from "@/lib/localDb/client";
import type { CachedBatch, CachedProduct } from "@/lib/localDb/types";

export type PosSearchResult = {
  productId: string;
  name: string;
  genericName: string | null;
  manufacturer: string | null;
  strength: string | null;
  form: string | null;
  /** Available unit types from cache/API (display-only on search; pick in Qty modal). */
  unitTypes: string[];
  stockPcs: number;
  sellPerBase: number | null;
  fefoBatchNumber: string | null;
  /** FEFO lot expiry shown on search — sellable preferred; expired only if nothing sellable. */
  fefoExpiryDate: string | null;
  /** True when no sellable (non-expired) stock remains — product blocked on search. */
  isExpired: boolean;
  /** False when expired or zero sellable stock — Enter must not open Select Batch. */
  selectable: boolean;
};

type ApiProduct = {
  id?: unknown;
  name?: unknown;
  genericName?: unknown;
  manufacturer?: unknown;
  strength?: unknown;
  form?: unknown;
  sku?: unknown;
  barcode?: unknown;
  description?: unknown;
  isActive?: unknown;
  units?: unknown;
};

type ApiUnit = {
  unitType?: unknown;
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

function strOrNull(v: unknown): string | null {
  if (v == null || v === "") return null;
  return String(v);
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Local calendar YYYY-MM-DD for expiry comparisons. */
export function todayYmd(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Display `08/2026` from `2026-08-31` or ISO strings. */
export function formatExpiryMonthYear(isoOrYmd: string): string {
  const ymd = isoOrYmd.slice(0, 10);
  const [y, m] = ymd.split("-");
  if (!y || !m) return ymd;
  return `${m}/${y}`;
}

/** Display `Mar 2027` from YYYY-MM-DD. */
export function formatExpiryShortMonth(isoOrYmd: string): string {
  const ymd = isoOrYmd.slice(0, 10);
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m) return formatExpiryMonthYear(isoOrYmd);
  const dt = new Date(y, m - 1, d || 1);
  return dt.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

/** Whole days from today → expiry (negative if past). */
export function daysUntilExpiry(expiryYmd: string, today = todayYmd()): number {
  const exp = Date.parse(`${expiryYmd.slice(0, 10)}T00:00:00`);
  const now = Date.parse(`${today}T00:00:00`);
  if (!Number.isFinite(exp) || !Number.isFinite(now)) return 0;
  return Math.round((exp - now) / 86_400_000);
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

function asProductList(data: unknown): ApiProduct[] {
  if (Array.isArray(data)) return data as ApiProduct[];
  return [];
}

function asBatchList(data: unknown): ApiBatch[] {
  if (Array.isArray(data)) return data as ApiBatch[];
  return [];
}

function unitTypesFromApi(units: unknown): string[] {
  if (!Array.isArray(units)) return [];
  const out: string[] = [];
  for (const u of units as ApiUnit[]) {
    const t = str(u.unitType).toUpperCase();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

/**
 * FEFO among batches with qty > 0: earliest expiry, then id.
 * If none in stock, fall back to earliest expiry overall.
 */
export function pickFefoFromBatches(
  batches: CachedBatch[],
): CachedBatch | null {
  const inStock = batches.filter((b) => b.quantityOnHand > 0);
  const pool = inStock.length > 0 ? inStock : batches;
  if (pool.length === 0) return null;
  return pool.slice().sort((a, b) => {
    const byExp = a.expiryDate.localeCompare(b.expiryDate);
    if (byExp !== 0) return byExp;
    return a.id.localeCompare(b.id);
  })[0]!;
}

/** Earliest in-stock lot that is still sellable (not expired). */
export function pickSellableFefo(
  batches: CachedBatch[],
  today = todayYmd(),
): CachedBatch | null {
  const sellable = batches.filter(
    (b) => b.quantityOnHand > 0 && b.expiryDate >= today,
  );
  if (sellable.length === 0) return null;
  return pickFefoFromBatches(sellable);
}

type EnrichableProduct = {
  id: string;
  name: string;
  genericName: string | null;
  manufacturer: string | null;
  strength: string | null;
  form: string | null;
  unitTypes: string[];
};

export function enrichProductWithBatches(
  product: EnrichableProduct,
  batches: CachedBatch[],
  today = todayYmd(),
): PosSearchResult {
  const productBatches = batches.filter((b) => b.productId === product.id);
  const stockPcs = productBatches.reduce(
    (sum, b) => sum + Math.max(0, b.quantityOnHand),
    0,
  );
  // Search card: prefer sellable FEFO (e.g. NP23091), not an expired lot.
  // Expired lots still appear in Select Batch detail.
  const sellableFefo = pickSellableFefo(productBatches, today);
  const hasSellable = sellableFefo != null;
  const displayLot =
    sellableFefo ??
    // Only when nothing sellable — show earliest expired in-stock for EXPIRED state.
    pickFefoFromBatches(
      productBatches.filter((b) => b.quantityOnHand > 0 && b.expiryDate < today),
    );

  return {
    productId: product.id,
    name: product.name,
    genericName: product.genericName,
    manufacturer: product.manufacturer,
    strength: product.strength,
    form: product.form,
    unitTypes: product.unitTypes,
    stockPcs,
    sellPerBase: displayLot ? displayLot.sellPerBase : null,
    fefoBatchNumber: displayLot?.batchNumber ?? null,
    fefoExpiryDate: displayLot?.expiryDate ?? null,
    isExpired: !hasSellable && stockPcs > 0,
    selectable: hasSellable,
  };
}

function mapCachedProduct(p: CachedProduct): EnrichableProduct {
  return {
    id: p.id,
    name: p.name,
    genericName: p.genericName,
    manufacturer: p.manufacturer,
    strength: p.strength,
    form: p.form,
    unitTypes: (p.units ?? []).map((u) => u.unitType.toUpperCase()),
  };
}

async function loadBatchesForEnrichment(
  productIds: string[],
  online: boolean,
): Promise<CachedBatch[]> {
  const cached = await listCachedBatches();
  const needed = new Set(productIds);
  const covers = cached.some((b) => needed.has(b.productId));
  if (covers || !online) return cached;

  try {
    const raw = await apiRequest<unknown>("/api/v1/batches?limit=100&offset=0");
    const cachedAt = new Date().toISOString();
    return asBatchList(raw)
      .map((b) => mapApiBatch(b, cachedAt))
      .filter((b): b is CachedBatch => b != null);
  } catch {
    return cached;
  }
}

/**
 * Search medicines for the New Sale panel.
 * @param q trimmed query — caller should skip empty
 */
export async function searchPosProducts(
  q: string,
  opts: { online: boolean },
): Promise<PosSearchResult[]> {
  const needle = q.trim();
  if (!needle) return [];

  const today = todayYmd();

  if (opts.online) {
    try {
      const qs = new URLSearchParams({
        q: needle,
        isActive: "true",
        limit: "20",
        offset: "0",
      });
      const raw = await apiRequest<unknown>(`/api/v1/products?${qs}`);
      const products = asProductList(raw)
        .map((p) => {
          const id = str(p.id);
          const name = str(p.name);
          if (!id || !name) return null;
          if (p.isActive === false) return null;
          return {
            id,
            name,
            genericName: strOrNull(p.genericName),
            manufacturer: strOrNull(p.manufacturer),
            strength: strOrNull(p.strength),
            form: strOrNull(p.form),
            unitTypes: unitTypesFromApi(p.units),
          } satisfies EnrichableProduct;
        })
        .filter((p): p is EnrichableProduct => p != null);

      const batches = await loadBatchesForEnrichment(
        products.map((p) => p.id),
        true,
      );
      return products.map((p) => enrichProductWithBatches(p, batches, today));
    } catch {
      // Fall through to local cache if API fails mid-search.
    }
  }

  const cachedProducts = await searchCachedProducts(needle, 20);
  const batches = await listCachedBatches();
  return cachedProducts.map((p) =>
    enrichProductWithBatches(mapCachedProduct(p), batches, today),
  );
}
