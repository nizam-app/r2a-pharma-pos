/**
 * Thin online catalog cache pull (Batch E).
 * GET /products + GET /batches → replace local cache. No bi-di / M4 sync.
 */

import { apiRequest } from "@/lib/api";
import { replaceCatalogCache } from "./client";
import type {
  CachedBatch,
  CachedProduct,
  CachedProductUnit,
} from "./types";

type ApiProductUnit = {
  id?: unknown;
  productId?: unknown;
  unitType?: unknown;
  factorToBase?: unknown;
  label?: unknown;
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
  isActive?: unknown;
  units?: unknown;
};

type ApiBatch = {
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

/** M2 list routes put the array in `data` (apiRequest returns `data` directly). */
function asList<T>(data: unknown): T[] {
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

function mapProduct(raw: ApiProduct, cachedAt: string): CachedProduct | null {
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

function mapBatch(raw: ApiBatch, cachedAt: string): CachedBatch | null {
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

export type CachePullResult = {
  productCount: number;
  batchCount: number;
};

/**
 * Pull catalog from cloud API into local cache.
 * Call only when online + authenticated.
 */
export async function pullCatalogCache(): Promise<CachePullResult> {
  const cachedAt = new Date().toISOString();

  const productsRes = await apiRequest<unknown>(
    "/api/v1/products?limit=100&offset=0&isActive=true",
  );
  const batchesRes = await apiRequest<unknown>(
    "/api/v1/batches?limit=100&offset=0",
  );

  const products = asList<ApiProduct>(productsRes)
    .map((p) => mapProduct(p, cachedAt))
    .filter((p): p is CachedProduct => p != null);

  const batches = asList<ApiBatch>(batchesRes)
    .map((b) => mapBatch(b, cachedAt))
    .filter((b): b is CachedBatch => b != null);

  await replaceCatalogCache({ products, batches });

  return {
    productCount: products.length,
    batchCount: batches.length,
  };
}
