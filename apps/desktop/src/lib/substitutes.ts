/**
 * Generic Substitutes F4 (Batch AG).
 *
 * Online → GET /api/v1/products/:productId/substitutes
 * Offline → no local invent; modal shows offline state.
 *
 * ## Focus rule (documented)
 * When F4 is pressed on an active New Sale (no other modal):
 * 1. If search results are visible and a row is focused → that product is context.
 * 2. Else if the cart has a selected line → that line’s product is context.
 * 3. Else → toast “select a product first”; do not open the modal.
 *
 * Expired / out-of-stock search rows still qualify as context (find alternatives).
 * Selecting a sellable substitute opens the existing Select Batch → Qty path.
 */

import { apiRequest } from "@/lib/api";
import type { PosSearchResult } from "@/lib/productSearch";

export type SubstituteSourceProduct = {
  productId: string;
  name: string;
  genericName: string | null;
};

export type PosSubstituteItem = {
  id: string;
  name: string;
  genericName: string | null;
  sku: string | null;
  barcode: string | null;
  inStock: boolean;
  availableQuantityBase: number;
  nearestSellPerBase: number | null;
  nearestExpiryDate: string | null;
  isExpired: boolean;
  /** Sellable into Select Batch — in stock and not expired. */
  selectable: boolean;
};

type ApiSubstitute = {
  id?: unknown;
  name?: unknown;
  genericName?: unknown;
  sku?: unknown;
  barcode?: unknown;
  inStock?: unknown;
  availableQuantityBase?: unknown;
  nearestSellPerBase?: unknown;
  nearestExpiryDate?: unknown;
  isExpired?: unknown;
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

function mapItem(raw: ApiSubstitute): PosSubstituteItem | null {
  const id = str(raw.id);
  const name = str(raw.name);
  if (!id || !name) return null;
  const inStock = Boolean(raw.inStock);
  const isExpired = Boolean(raw.isExpired);
  return {
    id,
    name,
    genericName: strOrNull(raw.genericName),
    sku: strOrNull(raw.sku),
    barcode: strOrNull(raw.barcode),
    inStock,
    availableQuantityBase: Math.max(
      0,
      Math.trunc(num(raw.availableQuantityBase, 0)),
    ),
    nearestSellPerBase:
      raw.nearestSellPerBase == null
        ? null
        : Math.max(0, num(raw.nearestSellPerBase, 0)),
    nearestExpiryDate: strOrNull(raw.nearestExpiryDate)?.slice(0, 10) ?? null,
    isExpired,
    selectable: inStock && !isExpired,
  };
}

/**
 * Map a substitute into PosSearchResult so Select Batch / Qty reuse the same path.
 * manufacturer / strength / form / unitTypes are absent from the substitutes API.
 */
export function substituteToSearchResult(
  item: PosSubstituteItem,
): PosSearchResult {
  return {
    productId: item.id,
    name: item.name,
    genericName: item.genericName,
    manufacturer: null,
    strength: null,
    form: null,
    unitTypes: [],
    stockPcs: item.availableQuantityBase,
    sellPerBase: item.nearestSellPerBase,
    fefoBatchNumber: null,
    fefoExpiryDate: item.nearestExpiryDate,
    isExpired: item.isExpired,
    selectable: item.selectable,
  };
}

/**
 * Fetch same-generic alternatives for a product (online only).
 * Empty/missing generic → `[]` (not an error).
 */
export async function fetchProductSubstitutes(
  productId: string,
  opts?: { storeId?: string | null },
): Promise<PosSubstituteItem[]> {
  const qs =
    opts?.storeId != null && opts.storeId !== ""
      ? `?storeId=${encodeURIComponent(opts.storeId)}`
      : "";
  const raw = await apiRequest<unknown>(
    `/api/v1/products/${encodeURIComponent(productId)}/substitutes${qs}`,
  );
  const list = Array.isArray(raw) ? (raw as ApiSubstitute[]) : [];
  return list
    .map((row) => mapItem(row))
    .filter((row): row is PosSubstituteItem => row != null);
}
