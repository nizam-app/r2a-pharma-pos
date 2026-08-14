/**
 * Online GRN helpers for Settings → Receive stock (M5 Batch C).
 * Add lot → POST /api/v1/batches. Adjust qty → PATCH /api/v1/batches/:id
 * `{ quantityOnHand }` (absolute on-hand). Do not queue while offline.
 */

import { apiRequest, ApiError } from "@/lib/api";

export type ReceiveProductHit = {
  id: string;
  name: string;
  sku: string | null;
};

export type ReceiveBatchRow = {
  id: string;
  batchNumber: string;
  expiryDate: string;
  quantityOnHand: number;
};

export type AddLotInput = {
  productId: string;
  batchNumber: string;
  expiryDate: string;
  quantityOnHand: number;
  costPerBase: number;
  sellPerBase: number;
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

function asList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (
    data &&
    typeof data === "object" &&
    Array.isArray((data as { items?: T[] }).items)
  ) {
    return (data as { items: T[] }).items;
  }
  return [];
}

/** GET /products?q= — product names are domain data (do not translate). */
export async function searchReceiveProducts(
  q: string,
): Promise<ReceiveProductHit[]> {
  const needle = q.trim();
  if (!needle) return [];
  const qs = new URLSearchParams({
    q: needle,
    isActive: "true",
    limit: "20",
    offset: "0",
  });
  const raw = await apiRequest<unknown>(`/api/v1/products?${qs}`);
  return asList<Record<string, unknown>>(raw)
    .map((p) => {
      const id = str(p.id);
      const name = str(p.name);
      if (!id || !name) return null;
      if (p.isActive === false) return null;
      return { id, name, sku: strOrNull(p.sku) };
    })
    .filter((p): p is ReceiveProductHit => p != null);
}

export async function listReceiveBatches(
  productId: string,
): Promise<ReceiveBatchRow[]> {
  const qs = new URLSearchParams({
    productId,
    limit: "50",
    offset: "0",
  });
  const raw = await apiRequest<unknown>(`/api/v1/batches?${qs}`);
  return asList<Record<string, unknown>>(raw)
    .map((b) => {
      const id = str(b.id);
      if (!id) return null;
      const expiry = b.expiryDate;
      const expiryDate =
        typeof expiry === "string"
          ? expiry.slice(0, 10)
          : str(expiry).slice(0, 10);
      return {
        id,
        batchNumber: str(b.batchNumber),
        expiryDate: expiryDate || "1970-01-01",
        quantityOnHand: Math.max(0, Math.trunc(num(b.quantityOnHand, 0))),
      };
    })
    .filter((b): b is ReceiveBatchRow => b != null);
}

export async function postReceiveLot(input: AddLotInput): Promise<void> {
  await apiRequest<unknown>("/api/v1/batches", {
    method: "POST",
    body: {
      productId: input.productId,
      batchNumber: input.batchNumber,
      expiryDate: input.expiryDate,
      quantityOnHand: input.quantityOnHand,
      costPerBase: input.costPerBase,
      sellPerBase: input.sellPerBase,
    },
  });
}

export async function patchReceiveQty(
  batchId: string,
  quantityOnHand: number,
): Promise<void> {
  await apiRequest<unknown>(
    `/api/v1/batches/${encodeURIComponent(batchId)}`,
    {
      method: "PATCH",
      body: { quantityOnHand },
    },
  );
}

export function receiveErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message || fallback;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function isDuplicateBatchError(err: unknown): boolean {
  return err instanceof ApiError && err.statusCode === 409;
}
