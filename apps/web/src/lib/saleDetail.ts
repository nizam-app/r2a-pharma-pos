import { apiRequest } from "./api";

export type SalePaymentMethod = "CASH" | "CARD" | "MFS";

export type SaleDetailPayment = {
  id: string;
  method: SalePaymentMethod | string;
  amount: number;
  reference: string | null;
  createdAt: string | null;
};

export type SaleDetailItem = {
  id: string;
  unitType: string;
  unitQty: number;
  quantityBase: number;
  unitPrice: number;
  lineTotal: number;
  fefoOverride: boolean;
  fefoAuthorizedByName: string | null;
  product: {
    id: string;
    name: string;
    genericName: string | null;
    sku: string | null;
    manufacturer: string | null;
    strength: string | null;
    form: string | null;
  };
  batch: {
    id: string;
    batchNumber: string;
    expiryDate: string;
  };
};

export type SaleDetail = {
  id: string;
  eventId: string;
  receiptNo: string | null;
  soldAt: string;
  subtotal: number;
  discount: number;
  total: number;
  notes: string | null;
  loyaltyPrevious: number;
  loyaltyUsed: number;
  loyaltyEarned: number;
  customer: { id: string; name: string; phone: string | null } | null;
  cashier: { id: string; name: string };
  items: SaleDetailItem[];
  payments: SaleDetailPayment[];
};

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asStringOrNull(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value);
  return s.trim() === "" ? null : s;
}

function parseItem(raw: unknown): SaleDetailItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const product =
    o.product && typeof o.product === "object"
      ? (o.product as Record<string, unknown>)
      : {};
  const batch =
    o.batch && typeof o.batch === "object"
      ? (o.batch as Record<string, unknown>)
      : {};
  const id = asString(o.id);
  const productName = asString(product.name);
  const batchNumber = asString(batch.batchNumber);
  if (!id || !productName || !batchNumber) return null;
  return {
    id,
    unitType: asString(o.unitType),
    unitQty: asNumber(o.unitQty),
    quantityBase: asNumber(o.quantityBase),
    unitPrice: asNumber(o.unitPrice),
    lineTotal: asNumber(o.lineTotal),
    fefoOverride: Boolean(o.fefoOverride),
    fefoAuthorizedByName: asStringOrNull(o.fefoAuthorizedByName),
    product: {
      id: asString(product.id),
      name: productName,
      genericName: asStringOrNull(product.genericName),
      sku: asStringOrNull(product.sku),
      manufacturer: asStringOrNull(product.manufacturer),
      strength: asStringOrNull(product.strength),
      form: asStringOrNull(product.form),
    },
    batch: {
      id: asString(batch.id),
      batchNumber,
      expiryDate: asString(batch.expiryDate),
    },
  };
}

function parsePayment(raw: unknown): SaleDetailPayment | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const method = asString(o.method);
  if (!method) return null;
  return {
    id: asString(o.id),
    method,
    amount: asNumber(o.amount),
    reference: asStringOrNull(o.reference),
    createdAt: asStringOrNull(o.createdAt),
  };
}

export function parseSaleDetail(raw: unknown): SaleDetail | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = asString(o.id);
  const soldAt = asString(o.soldAt);
  if (!id || !soldAt) return null;
  const customerRaw =
    o.customer && typeof o.customer === "object"
      ? (o.customer as Record<string, unknown>)
      : null;
  const cashierRaw =
    o.cashier && typeof o.cashier === "object"
      ? (o.cashier as Record<string, unknown>)
      : {};
  return {
    id,
    eventId: asString(o.eventId),
    receiptNo: asStringOrNull(o.receiptNo),
    soldAt,
    subtotal: asNumber(o.subtotal),
    discount: asNumber(o.discount),
    total: asNumber(o.total),
    notes: asStringOrNull(o.notes),
    loyaltyPrevious: asNumber(o.loyaltyPrevious),
    loyaltyUsed: asNumber(o.loyaltyUsed),
    loyaltyEarned: asNumber(o.loyaltyEarned),
    customer: customerRaw
      ? {
          id: asString(customerRaw.id),
          name: asString(customerRaw.name),
          phone: asStringOrNull(customerRaw.phone),
        }
      : null,
    cashier: {
      id: asString(cashierRaw.id),
      name: asString(cashierRaw.name) || "—",
    },
    items: Array.isArray(o.items)
      ? o.items.map(parseItem).filter((x): x is SaleDetailItem => x != null)
      : [],
    payments: Array.isArray(o.payments)
      ? o.payments
          .map(parsePayment)
          .filter((x): x is SaleDetailPayment => x != null)
      : [],
  };
}

export async function fetchSale(saleId: string): Promise<SaleDetail> {
  const encoded = encodeURIComponent(saleId);
  const data = await apiRequest<unknown>(`/api/v1/sales/${encoded}`);
  const sale = parseSaleDetail(data);
  if (!sale) throw new Error("Invalid sale payload");
  return sale;
}

export function loyaltyCurrent(sale: SaleDetail): number {
  return sale.loyaltyPrevious - sale.loyaltyUsed + sale.loyaltyEarned;
}

export function amountPaid(sale: SaleDetail): number {
  return sale.payments.reduce((sum, p) => sum + p.amount, 0);
}

export function primaryPaymentMethod(sale: SaleDetail): string | null {
  const methods = [...new Set(sale.payments.map((p) => p.method))];
  return methods[0] ?? null;
}
