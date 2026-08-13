/**
 * Receipt Preview print model (Batch AA + AH).
 *
 * Same payload shape must feed future Tauri printer IPC.
 * Pharmacy header: Settings → localStorage (`pharmacyHeaderStore`);
 * empty / missing fields fall back to `STUB_PHARMACY_HEADER`.
 *
 * TODO(real printer IPC): serialize this model to ESC/POS / driver bytes.
 * TODO(cloud store profile): sync header from tenant/store API when authorized.
 */

import type { CartLine } from "@/features/pos/cartTypes";
import type {
  CardSettlementView,
  CashSettlementView,
  MfsSettlementView,
} from "@/features/pos/SaleCompletedScreen";
import type { SaleCustomer } from "@/lib/customerSearch";
import { packagingUnitLabel } from "@/lib/qtyPackaging";
import {
  pharmacyHeaderStore,
  type PharmacyHeader,
} from "@/lib/pharmacyHeaderStore";

export type { PharmacyHeader };

export type ReceiptPaperWidth = "80mm" | "58mm";

/** Fallback when Settings fields are empty / unset. */
export const STUB_PHARMACY_HEADER = {
  name: "MEDICARE PHARMACY",
  branch: "Dhanmondi Branch",
  address: "House 42, Road 9/A, Dhanmondi, Dhaka 1209",
  phone: "+880 1711 000 111",
} as const;

/** Per-field fallback to stub — used by Receipt Preview + Settings display. */
export function resolvePharmacyHeader(
  saved: Partial<PharmacyHeader> | null | undefined,
): PharmacyHeader {
  return {
    name: saved?.name?.trim() || STUB_PHARMACY_HEADER.name,
    branch: saved?.branch?.trim() || STUB_PHARMACY_HEADER.branch,
    address: saved?.address?.trim() || STUB_PHARMACY_HEADER.address,
    phone: saved?.phone?.trim() || STUB_PHARMACY_HEADER.phone,
  };
}

export type ReceiptLineItem = {
  productName: string;
  /** e.g. "piece · NP23091" */
  unitBatchLabel: string;
  qty: number;
  rate: number;
  amount: number;
};

export type ReceiptPaymentBlock =
  | {
      kind: "cash";
      amountPaid: number;
      cashReceived: number;
      changeReturned: number;
    }
  | {
      kind: "card";
      amountPaid: number;
      status: "Approved";
    }
  | {
      kind: "mfs";
      amountPaid: number;
      providerLabel: string;
      payerMobile: string;
      trxId: string | null;
    }
  | {
      kind: "loyalty";
      loyaltyTaka: number;
    };

/**
 * Canonical receipt payload for Preview + future IPC.
 * Never hardcode product names — lines come from the completed sale.
 */
export type ReceiptPrintModel = {
  paperWidth: ReceiptPaperWidth;
  pharmacy: PharmacyHeader;
  invoiceLabel: string;
  txnLabel: string;
  /** ISO timestamp when sale completed. */
  completedAt: string;
  cashierName: string;
  customerName: string;
  lines: ReceiptLineItem[];
  subtotal: number;
  loyaltyTaka: number;
  total: number;
  payment: ReceiptPaymentBlock;
  footerThanks: string;
  footerLegal: string;
};

/** Invoice `INV-YYYY-#####` derived from sale / event id (pairs with `TXN-…`). */
export function formatInvoiceLabel(
  saleId: string,
  eventId: string,
  at: Date = new Date(),
): string {
  const raw = saleId.trim() || eventId.trim();
  const alnum = raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const digits = alnum.replace(/[^0-9]/g, "");
  const fallback = alnum
    .split("")
    .reduce((n, ch) => (n + ch.charCodeAt(0)) % 100000, 0)
    .toString();
  const seq = (digits.slice(-5) || fallback || "1").padStart(5, "0");
  return `INV-${at.getFullYear()}-${seq}`;
}

/** Receipt money: plain 2-decimal (thermal style). */
export function formatReceiptMoney(amount: number): string {
  return Math.max(0, amount).toFixed(2);
}

/** DD/MM/YYYY, HH:mm */
export function formatReceiptDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy}, ${hh}:${min}`;
}

function lineUnitBatch(line: CartLine): string {
  const unit = packagingUnitLabel(line.unitType).toLowerCase();
  return `${unit} · ${line.batchNumber}`;
}

export type BuildReceiptModelArgs = {
  txnLabel: string;
  invoiceLabel: string;
  completedAt: string;
  cashierName: string;
  customer: SaleCustomer | null;
  lines: CartLine[];
  cartSubtotal: number;
  loyaltyTaka: number;
  cashSettlement: CashSettlementView | null;
  /** Card tender (Batch AC); mutually exclusive with cash/MFS for MVP single tender. */
  cardSettlement?: CardSettlementView | null;
  /** MFS tender (Batch AD); mutually exclusive with cash/card for MVP single tender. */
  mfsSettlement?: MfsSettlementView | null;
  paperWidth?: ReceiptPaperWidth;
  /** Explicit header (tests); else load Settings store for tenant/store. */
  pharmacy?: PharmacyHeader | null;
  tenantId?: string;
  storeId?: string | null;
};

export function buildReceiptModel(
  args: BuildReceiptModelArgs,
): ReceiptPrintModel {
  const loyaltyTaka = Math.max(0, args.loyaltyTaka ?? 0);
  const subtotal = Math.max(0, args.cartSubtotal ?? 0);
  const cash = args.cashSettlement;
  const card = args.cardSettlement ?? null;
  const mfs = args.mfsSettlement ?? null;
  const total = cash
    ? Math.max(0, cash.amountPaid)
    : card
      ? Math.max(0, card.amountPaid)
      : mfs
        ? Math.max(0, mfs.amountPaid)
        : Math.max(0, subtotal - loyaltyTaka);

  const payment: ReceiptPaymentBlock = cash
    ? {
        kind: "cash",
        amountPaid: cash.amountPaid,
        cashReceived: cash.cashReceived,
        changeReturned: cash.changeReturned,
      }
    : card
      ? {
          kind: "card",
          amountPaid: card.amountPaid,
          status: card.status,
        }
      : mfs
        ? {
            kind: "mfs",
            amountPaid: mfs.amountPaid,
            providerLabel: mfs.providerLabel,
            payerMobile: mfs.payerMobile,
            trxId: mfs.trxId,
          }
        : { kind: "loyalty", loyaltyTaka };

  const txnLabel = (args.txnLabel ?? "").trim() || "TXN-LOCAL";
  const completedAt =
    (args.completedAt ?? "").trim() || new Date().toISOString();
  const invoiceLabel =
    (args.invoiceLabel ?? "").trim() ||
    formatInvoiceLabel(txnLabel, txnLabel, new Date(completedAt));

  const savedPharmacy =
    args.pharmacy ??
    (args.tenantId
      ? pharmacyHeaderStore.get(args.tenantId, args.storeId ?? null)
      : null);

  return {
    paperWidth: args.paperWidth ?? "80mm",
    pharmacy: resolvePharmacyHeader(savedPharmacy),
    invoiceLabel,
    txnLabel,
    completedAt,
    cashierName: (args.cashierName ?? "").trim() || "Cashier",
    customerName: args.customer?.name?.trim() || "Walk-in",
    lines: (args.lines ?? []).map((line) => ({
      productName: line.productName,
      unitBatchLabel: lineUnitBatch(line),
      qty: line.unitQty,
      rate: line.unitPrice,
      amount: line.lineTotal,
    })),
    subtotal,
    loyaltyTaka,
    total,
    payment,
    footerThanks: "Thank you for your purchase",
    footerLegal: "Medicines are not returnable",
  };
}
