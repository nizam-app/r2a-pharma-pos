import { apiRequestEnvelope } from "./api";

export type InventoryTab =
  | "all"
  | "low"
  | "out"
  | "expiring30"
  | "expiring90"
  | "expired";

export type InventoryRowStatus =
  | "healthy"
  | "low"
  | "out"
  | "expiring"
  | "expired";

export type OwnerInventoryRow = {
  productId: string;
  name: string;
  genericName: string | null;
  manufacturer: string | null;
  sku: string | null;
  barcode: string | null;
  coldChain: boolean;
  quantityOnHand: number;
  nearestExpiry: string | null;
  batchCount: number;
  costPerBase: number | null;
  sellPerBase: number | null;
  marginPct: number | null;
  status: InventoryRowStatus;
};

export type OwnerInventoryTabs = {
  all: number;
  low: number;
  out: number;
  expiring30: number;
  expiring90: number;
  expired: number;
};

export type OwnerInventoryPayload = {
  items: OwnerInventoryRow[];
  tabs: OwnerInventoryTabs;
  attention: {
    outOfStockCount: number;
    expiring30dBatchCount: number;
    expiringStockValue90d: number;
    lowStockCount: number;
  };
  summary: {
    productCount: number;
    costValue: number;
    lowStockCount: number;
    outOfStockCount: number;
    expiring90dBatchCount: number;
  };
  total: number;
  limit: number;
  offset: number;
};

export type OwnerInventoryQuery = {
  q?: string;
  tab?: InventoryTab;
  limit?: number;
  offset?: number;
};

/** Live OWNER inventory list — one round-trip, includes cost/margin. */
export async function fetchOwnerInventory(
  query: OwnerInventoryQuery = {},
): Promise<OwnerInventoryPayload> {
  const q = new URLSearchParams();
  q.set("limit", String(query.limit ?? 25));
  q.set("offset", String(query.offset ?? 0));
  q.set("tab", query.tab ?? "all");
  const search = query.q?.trim();
  if (search) q.set("q", search);

  const { data, meta } = await apiRequestEnvelope<{
    items: OwnerInventoryRow[];
    tabs: OwnerInventoryTabs;
    attention: OwnerInventoryPayload["attention"];
    summary: OwnerInventoryPayload["summary"];
  }>(`/api/v1/owner/inventory?${q.toString()}`);

  const m =
    meta && typeof meta === "object"
      ? (meta as { total?: number; limit?: number; offset?: number })
      : {};

  return {
    items: Array.isArray(data?.items) ? data.items : [],
    tabs: data?.tabs ?? {
      all: 0,
      low: 0,
      out: 0,
      expiring30: 0,
      expiring90: 0,
      expired: 0,
    },
    attention: data?.attention ?? {
      outOfStockCount: 0,
      expiring30dBatchCount: 0,
      expiringStockValue90d: 0,
      lowStockCount: 0,
    },
    summary: data?.summary ?? {
      productCount: 0,
      costValue: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
      expiring90dBatchCount: 0,
    },
    total: typeof m.total === "number" ? m.total : 0,
    limit: typeof m.limit === "number" ? m.limit : (query.limit ?? 25),
    offset: typeof m.offset === "number" ? m.offset : (query.offset ?? 0),
  };
}
