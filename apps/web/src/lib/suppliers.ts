import { apiRequest, apiRequestEnvelope } from "./api";
import type { PurchaseOrderStatus } from "./purchaseOrders";

export type SupplierStatus = "ACTIVE" | "HOLD" | "DRAFT";

export type SupplierOption = {
  id: string;
  name: string;
  status: SupplierStatus;
  isActive: boolean;
  phone: string | null;
  city: string | null;
};

/** Live OWNER active suppliers for the Create Purchase Order dropdown. */
export async function fetchActiveSuppliers(): Promise<SupplierOption[]> {
  return apiRequest<SupplierOption[]>(
    "/api/v1/owner/suppliers?isActive=true&limit=100",
  );
}

export type SupplierStats = {
  activeProducts: number;
  lastPurchaseAt: string | null;
  openOrders: number;
  purchasesMtd: number;
};

export type SupplierListRow = {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  status: SupplierStatus;
  isActive: boolean;
  _count: { purchaseOrders: number; batches: number; returnManifests: number };
  stats: SupplierStats;
};

export type SupplierKpis = {
  activeSuppliers: number;
  onHoldSuppliers: number;
  openOrders: number;
  purchasesMtd: number;
  purchasesPrevMtd: number;
  avgDeliveryDays: number | null;
};

export type OverdueOrder = {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string | null;
  expectedDelivery: string | null;
  daysOverdue: number;
};

export type SupplierAttention = {
  overdueOrders: OverdueOrder[];
  openOrders: number;
  returnQueue: number;
  onHoldSuppliers: Array<{ id: string; name: string }>;
};

export type SuppliersResult = {
  items: SupplierListRow[];
  total: number;
  limit: number;
  offset: number;
  kpis: SupplierKpis;
  attention: SupplierAttention;
};

export type SupplierListQuery = {
  q?: string;
  status?: SupplierStatus;
  limit?: number;
  offset?: number;
};

export type SupplierPreferredContact = "PHONE" | "EMAIL" | "WHATSAPP";

export type SupplierCreatePayload = {
  name: string;
  contactPerson: string;
  phone: string;
  secondaryPhone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  registrationNumber?: string | null;
  notes?: string | null;
  paymentTerms?: string | null;
  leadTimeDays?: number | null;
  minOrderValue?: number | null;
  status?: SupplierStatus;
  expiryReturnsAccepted?: boolean;
  minDaysBeforeExpiry?: number | null;
  returnNotes?: string | null;
  preferredContact?: SupplierPreferredContact | null;
  isActive?: boolean;
};

export type CreatedSupplier = {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  status: SupplierStatus;
  isActive: boolean;
};

export type SupplierProductStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export type SupplierProductSupplied = {
  productId: string;
  name: string;
  genericName: string | null;
  manufacturer: string | null;
  quantityOnHand: number;
  costPerBase: number;
  status: SupplierProductStatus;
};

export type SupplierPurchaseOrderRow = {
  id: string;
  poNumber: string;
  createdAt: string;
  expectedDelivery: string | null;
  estimatedTotal: number;
  status: PurchaseOrderStatus;
};

export type SupplierDetail = {
  kpis: {
    purchases12m: number;
    avgDeliveryDays: number | null;
    expiryReturnRatePct: number | null;
    activeProducts: number;
    openOrders: number;
    lastPurchaseAt: string | null;
  };
  performance: {
    onTimeDeliveryPct: number | null;
    shortSupplyPct: number | null;
    expiryReturnsAcceptedPct: number;
    avgCreditNoteDays: number | null;
  };
  purchaseOrders: SupplierPurchaseOrderRow[];
  products: SupplierProductSupplied[];
};

export type SupplierFull = {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string | null;
  secondaryPhone: string | null;
  address: string | null;
  city: string | null;
  registrationNumber: string | null;
  notes: string | null;
  paymentTerms: string | null;
  leadTimeDays: number | null;
  minOrderValue: number | null;
  status: SupplierStatus;
  expiryReturnsAccepted: boolean;
  minDaysBeforeExpiry: number | null;
  returnNotes: string | null;
  preferredContact: SupplierPreferredContact | null;
  isActive: boolean;
  createdAt: string;
  _count: { purchaseOrders: number; batches: number; returnManifests: number };
  detail: SupplierDetail;
};

/** Live OWNER supplier detail (Batch Z) — supplier + KPIs, performance, POs, products. */
export async function fetchSupplierDetail(
  supplierId: string,
): Promise<SupplierFull> {
  return apiRequest<SupplierFull>(
    `/api/v1/owner/suppliers/${encodeURIComponent(supplierId)}`,
  );
}

/** Create a supplier (Batch Y). Always ACTIVE — there is no Edit Supplier page. */
export async function createOwnerSupplier(
  input: SupplierCreatePayload,
): Promise<CreatedSupplier> {
  return apiRequest<CreatedSupplier>("/api/v1/owner/suppliers", {
    method: "POST",
    body: input,
  });
}

const EMPTY_KPIS: SupplierKpis = {
  activeSuppliers: 0,
  onHoldSuppliers: 0,
  openOrders: 0,
  purchasesMtd: 0,
  purchasesPrevMtd: 0,
  avgDeliveryDays: null,
};

const EMPTY_ATTENTION: SupplierAttention = {
  overdueOrders: [],
  openOrders: 0,
  returnQueue: 0,
  onHoldSuppliers: [],
};

/** Live OWNER supplier directory — KPIs, per-supplier stats, attention data. */
export async function fetchSuppliers(
  query: SupplierListQuery = {},
): Promise<SuppliersResult> {
  const q = new URLSearchParams();
  q.set("limit", String(query.limit ?? 25));
  q.set("offset", String(query.offset ?? 0));
  const search = query.q?.trim();
  if (search) q.set("q", search);
  if (query.status) q.set("status", query.status);

  const { data, meta } = await apiRequestEnvelope<SupplierListRow[]>(
    `/api/v1/owner/suppliers?${q.toString()}`,
  );

  const m =
    meta && typeof meta === "object"
      ? (meta as {
          total?: number;
          limit?: number;
          offset?: number;
          kpis?: SupplierKpis;
          attention?: SupplierAttention;
        })
      : {};

  return {
    items: Array.isArray(data) ? data : [],
    total: typeof m.total === "number" ? m.total : 0,
    limit: typeof m.limit === "number" ? m.limit : (query.limit ?? 25),
    offset: typeof m.offset === "number" ? m.offset : (query.offset ?? 0),
    kpis: m.kpis ?? EMPTY_KPIS,
    attention: m.attention ?? EMPTY_ATTENTION,
  };
}