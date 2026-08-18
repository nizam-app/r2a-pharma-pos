import { apiRequest, apiRequestEnvelope } from "./api";

export type PurchaseOrderStatus =
  | "DRAFT"
  | "SENT"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED";

export type PurchaseOrderListRow = {
  id: string;
  poNumber: string;
  status: PurchaseOrderStatus;
  reference: string | null;
  expectedDelivery: string | null;
  estimatedSubtotal: number;
  estimatedTax: number;
  estimatedTotal: number;
  createdAt: string;
  updatedAt: string;
  supplier: {
    id: string;
    name: string;
    status: string;
    phone: string | null;
  } | null;
  createdBy: { id: string; name: string };
  _count: { lines: number; goodsReceipts: number };
};

export type PurchaseOrderKpis = {
  total: number;
  byStatus: Record<PurchaseOrderStatus, number>;
  openValue: number;
};

export type PurchaseOrdersResult = {
  items: PurchaseOrderListRow[];
  total: number;
  limit: number;
  offset: number;
  kpis: PurchaseOrderKpis;
};

export type PurchaseOrderListQuery = {
  q?: string;
  status?: PurchaseOrderStatus;
  limit?: number;
  offset?: number;
};

const EMPTY_KPIS: PurchaseOrderKpis = {
  total: 0,
  byStatus: { DRAFT: 0, SENT: 0, PARTIALLY_RECEIVED: 0, RECEIVED: 0 },
  openValue: 0,
};

/** Live OWNER purchase order list — one round-trip, includes status KPIs. */
export async function fetchPurchaseOrders(
  query: PurchaseOrderListQuery = {},
): Promise<PurchaseOrdersResult> {
  const q = new URLSearchParams();
  q.set("limit", String(query.limit ?? 25));
  q.set("offset", String(query.offset ?? 0));
  const search = query.q?.trim();
  if (search) q.set("q", search);
  if (query.status) q.set("status", query.status);

  const { data, meta } = await apiRequestEnvelope<PurchaseOrderListRow[]>(
    `/api/v1/owner/purchase-orders?${q.toString()}`,
  );

  const m =
    meta && typeof meta === "object"
      ? (meta as {
          total?: number;
          limit?: number;
          offset?: number;
          kpis?: PurchaseOrderKpis;
        })
      : {};

  return {
    items: Array.isArray(data) ? data : [],
    total: typeof m.total === "number" ? m.total : 0,
    limit: typeof m.limit === "number" ? m.limit : (query.limit ?? 25),
    offset: typeof m.offset === "number" ? m.offset : (query.offset ?? 0),
    kpis: m.kpis ?? EMPTY_KPIS,
  };
}

export type CreatePurchaseOrderInput = {
  supplierId: string;
  status: "DRAFT" | "SENT";
  reference?: string;
  expectedDelivery?: string | null;
  estimatedTax?: number;
  lines: Array<{
    productId: string;
    qtyOrdered: number;
    costPerBase: number;
  }>;
};

export type CreatedPurchaseOrder = {
  id: string;
  poNumber: string;
  status: "DRAFT" | "SENT";
};

/** Live OWNER purchase order creation — never changes inventory. */
export async function createPurchaseOrder(
  input: CreatePurchaseOrderInput,
): Promise<CreatedPurchaseOrder> {
  return apiRequest<CreatedPurchaseOrder>("/api/v1/owner/purchase-orders", {
    method: "POST",
    body: {
      supplierId: input.supplierId,
      status: input.status,
      reference: input.reference?.trim() || undefined,
      expectedDelivery: input.expectedDelivery || null,
      estimatedTax: input.estimatedTax ?? 0,
      lines: input.lines,
    },
  });
}