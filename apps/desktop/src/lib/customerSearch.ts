/**
 * POS customer search (Batch R — Select Customer F8).
 * Online → M2 GET /customers. Offline → no local customer cache (walk-in only).
 * Never surface creditBalance / Baki in the POS UI.
 */

import { apiRequest } from "@/lib/api";

/** Snapshot attached to the active sale when a customer is selected. */
export type SaleCustomer = {
  customerId: string;
  name: string;
  phone: string | null;
  /** Loyalty points at selection time (for display + later redeem). */
  loyaltyPoints: number;
};

type ApiCustomer = {
  id?: unknown;
  name?: unknown;
  phone?: unknown;
  email?: unknown;
  loyaltyPoints?: unknown;
  creditBalance?: unknown;
};

function str(v: unknown): string {
  return v == null ? "" : String(v);
}

function strOrNull(v: unknown): string | null {
  if (v == null || v === "") return null;
  return String(v);
}

function int(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function asCustomerList(data: unknown): ApiCustomer[] {
  if (Array.isArray(data)) return data as ApiCustomer[];
  return [];
}

/** Display `01712 345678` style for BD mobiles when digits-only. */
export function formatCustomerPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("01")) {
    return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return phone.trim();
}

function toSaleCustomer(raw: ApiCustomer): SaleCustomer | null {
  const customerId = str(raw.id);
  const name = str(raw.name).trim();
  if (!customerId || !name) return null;
  return {
    customerId,
    name,
    phone: strOrNull(raw.phone),
    loyaltyPoints: Math.max(0, int(raw.loyaltyPoints, 0)),
  };
}

/**
 * Search customers by phone / name (and email on server).
 * Returns [] when offline or query empty — caller should still offer walk-in.
 */
export async function searchPosCustomers(
  q: string,
  opts: { online: boolean },
): Promise<SaleCustomer[]> {
  const needle = q.trim();
  if (!needle) return [];
  if (!opts.online) return [];

  try {
    const qs = new URLSearchParams({
      q: needle,
      limit: "20",
      offset: "0",
    });
    const raw = await apiRequest<unknown>(`/api/v1/customers?${qs}`);
    return asCustomerList(raw)
      .map(toSaleCustomer)
      .filter((c): c is SaleCustomer => c != null);
  } catch {
    return [];
  }
}
