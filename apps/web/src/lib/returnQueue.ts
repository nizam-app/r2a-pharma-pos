import { apiRequest, apiRequestEnvelope } from "./api";

export type ReturnStatus = "ELIGIBLE" | "NOT_ELIGIBLE" | "MANIFEST_PREPARED";

export type ReturnQueueSupplier = {
  id: string;
  name: string;
};

export type ReturnQueueProduct = {
  id: string;
  name: string;
  genericName: string | null;
  manufacturer: string | null;
  sku: string | null;
};

export type ReturnQueueRow = {
  id: string;
  batchNumber: string;
  expiryDate: string;
  quantityOnHand: number;
  costPerBase: number;
  costValue: number;
  returnStatus: ReturnStatus;
  supplierId: string | null;
  supplierName: string | null;
  productId: string;
  product: ReturnQueueProduct;
  supplier: ReturnQueueSupplier | null;
};

export type ReturnQueueKpis = {
  eligibleBatches: number;
  eligibleCostValue: number;
  manifestsPrepared: number;
  needsReview: number;
};

export type ReturnQueueQuery = {
  q?: string;
  supplierId?: string;
  returnStatus?: ReturnStatus;
  limit?: number;
  offset?: number;
};

export type ReturnQueueResult = {
  items: ReturnQueueRow[];
  total: number;
  limit: number;
  offset: number;
  kpis: ReturnQueueKpis;
  suppliers: ReturnQueueSupplier[];
};

const EMPTY_KPIS: ReturnQueueKpis = {
  eligibleBatches: 0,
  eligibleCostValue: 0,
  manifestsPrepared: 0,
  needsReview: 0,
};

/** Session hand-off for Batch AB Create Return Manifest. Queue writes; AB reads. */
export const RETURN_MANIFEST_DRAFT_KEY = "r2a.returnManifestDraft";

export type ReturnManifestDraft = {
  supplierId: string;
  supplierName: string;
  batchIds: string[];
};

export function writeReturnManifestDraft(draft: ReturnManifestDraft): void {
  sessionStorage.setItem(RETURN_MANIFEST_DRAFT_KEY, JSON.stringify(draft));
}

export function readReturnManifestDraft(): ReturnManifestDraft | null {
  try {
    const raw = sessionStorage.getItem(RETURN_MANIFEST_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ReturnManifestDraft>;
    if (
      typeof parsed.supplierId !== "string" ||
      typeof parsed.supplierName !== "string" ||
      !Array.isArray(parsed.batchIds) ||
      parsed.batchIds.length === 0 ||
      parsed.batchIds.some((id) => typeof id !== "string")
    ) {
      return null;
    }
    return {
      supplierId: parsed.supplierId,
      supplierName: parsed.supplierName,
      batchIds: parsed.batchIds,
    };
  } catch {
    return null;
  }
}

export function clearReturnManifestDraft(): void {
  sessionStorage.removeItem(RETURN_MANIFEST_DRAFT_KEY);
}

export type CreatedReturnManifest = {
  id: string;
  srmNumber: string;
  status: string;
};

/** Live OWNER prepare — does not dispatch or adjust stock. */
export async function createReturnManifest(input: {
  supplierId: string;
  notes?: string | null;
  supplierReference?: string | null;
  lines: Array<{ batchId: string; returnQty: number }>;
}): Promise<CreatedReturnManifest> {
  const body: {
    supplierId: string;
    lines: Array<{ batchId: string; returnQty: number }>;
    notes?: string;
    supplierReference?: string;
  } = {
    supplierId: input.supplierId,
    lines: input.lines,
  };
  const notes = input.notes?.trim();
  if (notes) body.notes = notes;
  const supplierReference = input.supplierReference?.trim();
  if (supplierReference) body.supplierReference = supplierReference;

  return apiRequest<CreatedReturnManifest>("/api/v1/owner/return-manifests", {
    method: "POST",
    body,
  });
}

const LOT_PAGE_SIZE = 100;
const LOT_PAGE_CAP = 5;

/** Reload Eligible lots for a Batch AA draft, preserving selection order. */
export async function fetchReturnLotsByIds(
  supplierId: string,
  batchIds: string[],
): Promise<{ found: ReturnQueueRow[]; missingIds: string[] }> {
  const wanted = new Set(batchIds);
  const found = new Map<string, ReturnQueueRow>();
  let offset = 0;
  for (let page = 0; page < LOT_PAGE_CAP && found.size < wanted.size; page += 1) {
    const result = await fetchReturnQueue({
      supplierId,
      returnStatus: "ELIGIBLE",
      limit: LOT_PAGE_SIZE,
      offset,
    });
    for (const row of result.items) {
      if (wanted.has(row.id)) found.set(row.id, row);
    }
    offset += LOT_PAGE_SIZE;
    if (result.items.length === 0 || offset >= result.total) break;
  }
  return {
    found: batchIds
      .map((id) => found.get(id))
      .filter((row): row is ReturnQueueRow => Boolean(row)),
    missingIds: batchIds.filter((id) => !found.has(id)),
  };
}

/** Live OWNER return queue — paged lots plus unfiltered KPI / supplier meta. */
export async function fetchReturnQueue(
  query: ReturnQueueQuery = {},
): Promise<ReturnQueueResult> {
  const q = new URLSearchParams();
  q.set("limit", String(query.limit ?? 25));
  q.set("offset", String(query.offset ?? 0));
  const search = query.q?.trim();
  if (search) q.set("q", search);
  if (query.supplierId) q.set("supplierId", query.supplierId);
  if (query.returnStatus) q.set("returnStatus", query.returnStatus);

  const { data, meta } = await apiRequestEnvelope<ReturnQueueRow[]>(
    `/api/v1/owner/returns/queue?${q.toString()}`,
  );

  const m =
    meta && typeof meta === "object"
      ? (meta as {
          total?: number;
          limit?: number;
          offset?: number;
          kpis?: ReturnQueueKpis;
          suppliers?: ReturnQueueSupplier[];
        })
      : {};

  return {
    items: Array.isArray(data) ? data : [],
    total: typeof m.total === "number" ? m.total : 0,
    limit: typeof m.limit === "number" ? m.limit : (query.limit ?? 25),
    offset: typeof m.offset === "number" ? m.offset : (query.offset ?? 0),
    kpis: m.kpis ?? EMPTY_KPIS,
    suppliers: Array.isArray(m.suppliers) ? m.suppliers : [],
  };
}
