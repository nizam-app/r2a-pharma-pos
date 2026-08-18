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

export type PurchaseOrderDetailLine = {
  id: string;
  qtyOrdered: number;
  qtyReceived: number;
  costPerBase: number;
  product: {
    id: string;
    name: string;
    genericName: string | null;
    manufacturer: string | null;
    sku: string | null;
  };
};

export type PurchaseOrderReceiptSummary = {
  id: string;
  grnNumber: string;
  supplierInvoiceRef: string | null;
  deliveryNote: string | null;
  receivedAt: string;
  receivedBy: { id: string; name: string };
  _count: { lines: number };
};

export type PurchaseOrderDetail = {
  id: string;
  poNumber: string;
  status: PurchaseOrderStatus;
  reference: string | null;
  expectedDelivery: string | null;
  createdAt: string;
  updatedAt: string;
  estimatedSubtotal: number;
  estimatedTax: number;
  estimatedTotal: number;
  supplier: {
    id: string;
    name: string;
    contactPerson: string | null;
    phone: string | null;
    city: string | null;
  } | null;
  store: { id: string; name: string; code: string } | null;
  createdBy: { id: string; name: string };
  lines: PurchaseOrderDetailLine[];
  goodsReceipts: PurchaseOrderReceiptSummary[];
};

/** Live OWNER purchase order detail — lines, receiving progress, GRN history. */
export async function fetchPurchaseOrder(
  poId: string,
): Promise<PurchaseOrderDetail> {
  return apiRequest<PurchaseOrderDetail>(
    `/api/v1/owner/purchase-orders/${encodeURIComponent(poId)}`,
  );
}

/** One received lot in a goods receipt. Quantities are in pieces (PIECE). */
export type GoodsReceiptLineInput = {
  purchaseOrderLineId: string;
  productId: string;
  qty: number;
  batchNumber: string;
  expiryDate: string;
  costPerBase: number;
  sellPerBase: number;
};

/** Goods receipt (GRN) create input — Batch R API contract. */
export type ConfirmGoodsReceiptInput = {
  supplierInvoiceRef?: string;
  deliveryNote?: string;
  receivedAt?: string;
  lines: GoodsReceiptLineInput[];
};

/** Confirmed receipt plus the refreshed purchase order. */
export type GoodsReceiptConfirmed = {
  receipt: {
    id: string;
    grnNumber: string;
    receivedAt: string;
    supplierInvoiceRef: string | null;
    deliveryNote: string | null;
    lines: Array<{
      id: string;
      purchaseOrderLineId: string;
      qty: number;
      batchNumber: string;
      expiryDate: string;
      costPerBase: number;
      sellPerBase: number;
      product: {
        id: string;
        name: string;
        genericName: string | null;
        sku: string | null;
      };
      batch: {
        id: string;
        batchNumber: string;
        expiryDate: string;
        quantityOnHand: number;
        costPerBase: number;
        sellPerBase: number;
      };
    }>;
  };
  purchaseOrder: PurchaseOrderDetail;
};

/**
 * Confirm stock receipt against a purchase order (Batch W → Batch R API).
 * Posts lots, records the GRN, and advances PO receiving progress.
 */
export async function confirmGoodsReceipt(
  poId: string,
  input: ConfirmGoodsReceiptInput,
): Promise<GoodsReceiptConfirmed> {
  return apiRequest<GoodsReceiptConfirmed>(
    `/api/v1/owner/purchase-orders/${encodeURIComponent(poId)}/receipts`,
    {
      method: "POST",
      body: {
        supplierInvoiceRef: input.supplierInvoiceRef?.trim() || undefined,
        deliveryNote: input.deliveryNote?.trim() || undefined,
        receivedAt: input.receivedAt || undefined,
        lines: input.lines,
      },
    },
  );
}