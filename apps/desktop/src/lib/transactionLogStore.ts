/**
 * Local completed-sale log for Transactions List (M3 Batch AJ).
 *
 * Choice: webview `localStorage` (same family as pharmacyHeader / forceOffline).
 * Key: pharmasync.transactionLog.<tenantId>.<storeId|none>
 *
 * Why local: there is no cloud `GET /sales` list endpoint yet.
 * TODO(cloud): when a tenant-scoped sales list API exists, prefer online fetch
 * and keep this log as offline / recent-cache fallback (ask before inventing routes).
 *
 * Cap: newest 100 entries (list + detail/reprint invent).
 */

import type { CartLine } from "@/features/pos/cartTypes";
import type {
  CardSettlementView,
  CashSettlementView,
  MfsSettlementView,
} from "@/features/pos/SaleCompletedScreen";
import type { SaleCustomer } from "@/lib/customerSearch";
import type { LoyaltySettlement } from "@/lib/loyaltyCalc";

export type TransactionPaymentMethod =
  | "CASH"
  | "CARD"
  | "MFS"
  | "LOYALTY";

/** Full snapshot for list (AJ) + detail/reprint (AK). */
export type LoggedTransaction = {
  /** Cloud sale id when known. */
  saleId: string;
  eventId: string;
  txnLabel: string;
  invoiceLabel: string;
  completedAt: string;
  cashierName: string;
  customer: SaleCustomer | null;
  lines: CartLine[];
  cartSubtotal: number;
  loyaltyTaka: number;
  settlement: LoyaltySettlement;
  cashSettlement: CashSettlementView | null;
  cardSettlement: CardSettlementView | null;
  mfsSettlement: MfsSettlementView | null;
  paymentMethod: TransactionPaymentMethod;
  /** Payable total after loyalty (৳). */
  total: number;
};

export type LoggedTransactionInput = Omit<
  LoggedTransaction,
  "paymentMethod" | "total"
>;

const PREFIX = "pharmasync.transactionLog";
const MAX_ENTRIES = 100;

function storageKey(tenantId: string, storeId: string | null): string {
  const storePart = storeId?.trim() || "none";
  return `${PREFIX}.${tenantId}.${storePart}`;
}

export function derivePaymentMethod(args: {
  cashSettlement: CashSettlementView | null;
  cardSettlement: CardSettlementView | null;
  mfsSettlement: MfsSettlementView | null;
  settlement: LoyaltySettlement;
}): TransactionPaymentMethod {
  if (args.mfsSettlement) return "MFS";
  if (args.cardSettlement) return "CARD";
  if (args.cashSettlement) return "CASH";
  if (args.settlement.fullyCoveredByLoyalty) return "LOYALTY";
  return "CASH";
}

export function buildLoggedTransaction(
  input: LoggedTransactionInput,
): LoggedTransaction {
  const loyaltyTaka = Math.max(0, input.loyaltyTaka);
  const cartSubtotal = Math.max(0, input.cartSubtotal);
  return {
    ...input,
    cartSubtotal,
    loyaltyTaka,
    paymentMethod: derivePaymentMethod(input),
    total: Math.max(0, cartSubtotal - loyaltyTaka),
  };
}

function isCartLine(v: unknown): v is CartLine {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.id === "string" && typeof o.productName === "string";
}

function parseEntry(raw: unknown): LoggedTransaction | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const saleId = typeof o.saleId === "string" ? o.saleId : "";
  const eventId = typeof o.eventId === "string" ? o.eventId : "";
  const txnLabel = typeof o.txnLabel === "string" ? o.txnLabel.trim() : "";
  const invoiceLabel =
    typeof o.invoiceLabel === "string" ? o.invoiceLabel.trim() : "";
  const completedAt =
    typeof o.completedAt === "string" ? o.completedAt : "";
  if (!txnLabel || !completedAt) return null;

  const lines = Array.isArray(o.lines)
    ? (o.lines.filter(isCartLine) as CartLine[])
    : [];

  const settlement =
    o.settlement && typeof o.settlement === "object"
      ? (o.settlement as LoyaltySettlement)
      : {
          previousBalance: 0,
          earned: 0,
          used: 0,
          currentBalance: 0,
          fullyCoveredByLoyalty: false,
        };

  return buildLoggedTransaction({
    saleId: saleId || eventId || txnLabel,
    eventId: eventId || saleId || txnLabel,
    txnLabel,
    invoiceLabel: invoiceLabel || txnLabel,
    completedAt,
    cashierName:
      typeof o.cashierName === "string" ? o.cashierName : "—",
    customer:
      o.customer && typeof o.customer === "object"
        ? (o.customer as SaleCustomer)
        : null,
    lines,
    cartSubtotal:
      typeof o.cartSubtotal === "number" ? o.cartSubtotal : Number(o.cartSubtotal) || 0,
    loyaltyTaka:
      typeof o.loyaltyTaka === "number" ? o.loyaltyTaka : Number(o.loyaltyTaka) || 0,
    settlement,
    cashSettlement:
      o.cashSettlement && typeof o.cashSettlement === "object"
        ? (o.cashSettlement as CashSettlementView)
        : null,
    cardSettlement:
      o.cardSettlement && typeof o.cardSettlement === "object"
        ? (o.cardSettlement as CardSettlementView)
        : null,
    mfsSettlement:
      o.mfsSettlement && typeof o.mfsSettlement === "object"
        ? (o.mfsSettlement as MfsSettlementView)
        : null,
  });
}

function parseList(raw: string | null): LoggedTransaction[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(parseEntry)
      .filter((e): e is LoggedTransaction => e != null);
  } catch {
    return [];
  }
}

/** Display time for list rows — Latin digits, locale-neutral. */
export function formatTransactionListTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())} · ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const transactionLogStore = {
  list(tenantId: string, storeId: string | null): LoggedTransaction[] {
    if (!tenantId) return [];
    try {
      return parseList(localStorage.getItem(storageKey(tenantId, storeId)));
    } catch {
      return [];
    }
  },

  append(
    tenantId: string,
    storeId: string | null,
    input: LoggedTransactionInput,
  ): LoggedTransaction | null {
    if (!tenantId) return null;
    try {
      const entry = buildLoggedTransaction(input);
      const key = storageKey(tenantId, storeId);
      const existing = parseList(localStorage.getItem(key));
      const next = [
        entry,
        ...existing.filter(
          (e) =>
            e.saleId !== entry.saleId ||
            e.eventId !== entry.eventId ||
            e.txnLabel !== entry.txnLabel,
        ),
      ].slice(0, MAX_ENTRIES);
      localStorage.setItem(key, JSON.stringify(next));
      return entry;
    } catch {
      return null;
    }
  },

  getByTxnLabel(
    tenantId: string,
    storeId: string | null,
    txnLabel: string,
  ): LoggedTransaction | null {
    const needle = txnLabel.trim();
    if (!needle) return null;
    return (
      this.list(tenantId, storeId).find((e) => e.txnLabel === needle) ?? null
    );
  },
};
