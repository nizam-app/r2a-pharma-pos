/**
 * Online catalog cache pull (M5 Batch E).
 * Pages GET /products + GET /batches by meta.total (limit=100, cap 50 pages).
 * Neon remains source of truth. No bi-di / CSV / M4 sync ingest.
 */

import { apiRequestEnvelope } from "@/lib/api";
import { replaceCatalogCache } from "./client";
import {
  asList,
  CATALOG_PAGE_SIZE,
  collectPagedList,
  mapBatch,
  mapProduct,
  resolvePageTotal,
  type ApiBatch,
  type ApiProduct,
} from "./catalogPages";
import type { CachedBatch, CachedProduct } from "./types";

export {
  CATALOG_MAX_PAGES,
  CATALOG_PAGE_SIZE,
  collectPagedList,
  mapBatch,
  parseMetaTotal,
} from "./catalogPages";

export type CachePullResult = {
  productCount: number;
  batchCount: number;
  truncated: boolean;
};

async function fetchCatalogPage<T>(
  path: string,
  query: Record<string, string | number>,
): Promise<{ items: T[]; total: number }> {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    qs.set(key, String(value));
  }
  const envelope = await apiRequestEnvelope<unknown>(`${path}?${qs}`);
  const items = asList<T>(envelope.data);
  const limit = Number(query.limit) || CATALOG_PAGE_SIZE;
  const offset = Number(query.offset) || 0;
  return {
    items,
    total: resolvePageTotal(envelope.meta, items.length, limit, offset),
  };
}

/**
 * Pull catalog from cloud API into local cache.
 * Call only when online + authenticated.
 * Replaces the cache once after all pages are fetched.
 */
export async function pullCatalogCache(): Promise<CachePullResult> {
  const cachedAt = new Date().toISOString();

  const productsPage = await collectPagedList((limit, offset) =>
    fetchCatalogPage<ApiProduct>("/api/v1/products", {
      limit,
      offset,
      isActive: "true",
    }),
  );
  const batchesPage = await collectPagedList((limit, offset) =>
    fetchCatalogPage<ApiBatch>("/api/v1/batches", { limit, offset }),
  );

  const products = productsPage.items
    .map((p) => mapProduct(p, cachedAt))
    .filter((p): p is CachedProduct => p != null);

  const batches = batchesPage.items
    .map((b) => mapBatch(b, cachedAt))
    .filter((b): b is CachedBatch => b != null);

  await replaceCatalogCache({ products, batches });

  return {
    productCount: products.length,
    batchCount: batches.length,
    truncated: productsPage.truncated || batchesPage.truncated,
  };
}
