/**
 * Paged catalog helpers (M5 Batch E).
 * Pure — no API / SQLite. Smoke tests concatenate fake pages here.
 */

import type {
  CachedBatch,
  CachedProduct,
  CachedProductUnit,
} from "./types";

/** GET /products and GET /batches page size. */
export const CATALOG_PAGE_SIZE = 100;
/** Hard cap: 50 × 100 = 5000 rows per resource. */
export const CATALOG_MAX_PAGES = 50;

export type ApiProductUnit = {
  id?: unknown;
  productId?: unknown;
  unitType?: unknown;
  factorToBase?: unknown;
  label?: unknown;
};

export type ApiProduct = {
  id?: unknown;
  name?: unknown;
  genericName?: unknown;
  manufacturer?: unknown;
  strength?: unknown;
  form?: unknown;
  sku?: unknown;
  barcode?: unknown;
  isActive?: unknown;
  units?: unknown;
};

export type ApiBatch = {
  id?: unknown;
  productId?: unknown;
  storeId?: unknown;
  batchNumber?: unknown;
  expiryDate?: unknown;
  quantityOnHand?: unknown;
  sellPerBase?: unknown;
  /** Must never be cached for cashiers. */
  costPerBase?: unknown;
};

type ListEnvelope<T> = {
  items?: T[];
  total?: number;
};

export type CatalogPage<T> = {
  items: readonly T[];
  total: number;
};

export type PagedListResult<T> = {
  items: T[];
  truncated: boolean;
  total: number;
};

/** M2 list routes put the array in `data` (apiRequest returns `data` directly). */
export function asList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (
    data &&
    typeof data === "object" &&
    Array.isArray((data as ListEnvelope<T>).items)
  ) {
    return (data as ListEnvelope<T>).items!;
  }
  return [];
}

export function parseMetaTotal(meta: unknown): number | null {
  if (meta == null || typeof meta !== "object") return null;
  const raw = (meta as { total?: unknown }).total;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.trunc(n);
}

/**
 * If `meta.total` is missing, treat a short page as complete; a full page
 * as "at least one more row" so paging continues.
 */
export function resolvePageTotal(
  meta: unknown,
  itemsLength: number,
  limit: number,
  offset: number,
): number {
  const fromMeta = parseMetaTotal(meta);
  if (fromMeta != null) return fromMeta;
  if (itemsLength < limit) return offset + itemsLength;
  return offset + itemsLength + 1;
}

/**
 * Page until `offset >= total` or `maxPages`. Caller concatenates items;
 * cache replace happens once after both resources finish.
 */
export async function collectPagedList<T>(
  fetchPage: (limit: number, offset: number) => Promise<CatalogPage<T>>,
  options?: { pageSize?: number; maxPages?: number },
): Promise<PagedListResult<T>> {
  const pageSize = options?.pageSize ?? CATALOG_PAGE_SIZE;
  const maxPages = options?.maxPages ?? CATALOG_MAX_PAGES;
  const items: T[] = [];
  let total = 0;
  let offset = 0;

  for (let page = 0; page < maxPages; page += 1) {
    const result = await fetchPage(pageSize, offset);
    total = result.total;
    items.push(...result.items);
    offset += pageSize;
    if (offset >= total) {
      return { items, truncated: false, total };
    }
  }

  return { items, truncated: offset < total, total };
}

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

function mapUnit(raw: ApiProductUnit, productId: string): CachedProductUnit | null {
  const id = str(raw.id);
  if (!id) return null;
  return {
    id,
    productId: str(raw.productId) || productId,
    unitType: str(raw.unitType) || "PIECE",
    factorToBase: Math.max(1, Math.trunc(num(raw.factorToBase, 1))),
    label: strOrNull(raw.label),
  };
}

export function mapProduct(raw: ApiProduct, cachedAt: string): CachedProduct | null {
  const id = str(raw.id);
  const name = str(raw.name);
  if (!id || !name) return null;
  const unitsRaw = Array.isArray(raw.units) ? (raw.units as ApiProductUnit[]) : [];
  const units = unitsRaw
    .map((u) => mapUnit(u, id))
    .filter((u): u is CachedProductUnit => u != null);
  return {
    id,
    name,
    genericName: strOrNull(raw.genericName),
    manufacturer: strOrNull(raw.manufacturer),
    strength: strOrNull(raw.strength),
    form: strOrNull(raw.form),
    sku: strOrNull(raw.sku),
    barcode: strOrNull(raw.barcode),
    isActive: raw.isActive !== false,
    cachedAt,
    units,
  };
}

export function mapBatch(raw: ApiBatch, cachedAt: string): CachedBatch | null {
  const id = str(raw.id);
  const productId = str(raw.productId);
  if (!id || !productId) return null;
  // Explicitly drop costPerBase — never write to local cache.
  void raw.costPerBase;
  const expiry = raw.expiryDate;
  const expiryDate =
    typeof expiry === "string"
      ? expiry.slice(0, 10)
      : expiry instanceof Date
        ? expiry.toISOString().slice(0, 10)
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
