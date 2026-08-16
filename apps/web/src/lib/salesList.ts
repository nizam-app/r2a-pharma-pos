import { apiRequestEnvelope } from "./api";

export type SaleListPayment = {
  id?: string;
  method: "CASH" | "CARD" | "MFS" | string;
  amount: number;
  reference?: string | null;
};

export type SaleListRow = {
  id: string;
  receiptNo: string | null;
  soldAt: string;
  subtotal: number;
  discount: number;
  total: number;
  notes: string | null;
  loyaltyUsed?: number;
  customer: { id: string; name: string; phone: string | null } | null;
  cashier: { id: string; name: string };
  items: unknown[];
  payments: SaleListPayment[];
};

export type SalesListQuery = {
  q?: string;
  paymentMethod?: "CASH" | "CARD" | "MFS";
  userId?: string;
  from: string;
  to: string;
  limit?: number;
  offset?: number;
};

export type SalesListResult = {
  items: SaleListRow[];
  total: number;
  limit: number;
  offset: number;
};

export async function fetchSales(
  query: SalesListQuery,
): Promise<SalesListResult> {
  const q = new URLSearchParams();
  q.set("from", query.from);
  q.set("to", query.to);
  q.set("limit", String(query.limit ?? 25));
  q.set("offset", String(query.offset ?? 0));
  const search = query.q?.trim();
  if (search) q.set("q", search);
  if (query.paymentMethod) q.set("paymentMethod", query.paymentMethod);
  if (query.userId) q.set("userId", query.userId);

  const { data, meta } = await apiRequestEnvelope<SaleListRow[]>(
    `/api/v1/sales?${q.toString()}`,
  );
  const m =
    meta && typeof meta === "object"
      ? (meta as { total?: number; limit?: number; offset?: number })
      : {};
  return {
    items: Array.isArray(data) ? data : [],
    total: typeof m.total === "number" ? m.total : 0,
    limit: typeof m.limit === "number" ? m.limit : (query.limit ?? 25),
    offset: typeof m.offset === "number" ? m.offset : (query.offset ?? 0),
  };
}
