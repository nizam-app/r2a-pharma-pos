import { formatDetailDate, formatTime } from "./format";
import { isLoyaltyOnlyTender } from "./loyaltyTender";
import { amountPaid, type SaleDetail } from "./saleDetail";

/**
 * On-screen reprint model from live sale JSON.
 * Receipt body language is fixed (not UI locale). No Tauri IPC.
 */
export type ReceiptPreviewModel = {
  storeName: string;
  tenantName: string | null;
  txnLabel: string;
  completedAt: string;
  cashierName: string;
  customerName: string;
  lines: Array<{
    productName: string;
    unitBatchLabel: string;
    qty: number;
    rate: number;
    amount: number;
  }>;
  subtotal: number;
  discount: number;
  loyaltyTaka: number;
  total: number;
  paymentLabel: string;
  paymentReference: string | null;
  amountPaid: number;
};

function unitWord(unitType: string): string {
  if (unitType === "STRIP") return "strip";
  if (unitType === "BOX") return "box";
  if (unitType === "PIECE") return "piece";
  return unitType.toLowerCase();
}

function paymentWord(method: string): string {
  if (method === "CASH") return "Cash";
  if (method === "CARD") return "Card";
  if (method === "MFS") return "MFS";
  return method;
}

export function formatReceiptDateTime(iso: string): string {
  const date = formatDetailDate(iso);
  const time = formatTime(iso);
  if (date === "—") return "—";
  return `${date} ${time}`;
}

export function formatReceiptMoney(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

export function buildReceiptPreview(
  sale: SaleDetail,
  chrome: { storeName: string | null; tenantName: string | null },
): ReceiptPreviewModel {
  const methods = [...new Set(sale.payments.map((p) => p.method))];
  const refs = sale.payments
    .map((p) => p.reference)
    .filter((r): r is string => Boolean(r));
  const paymentLabel = isLoyaltyOnlyTender(sale)
    ? "Loyalty"
    : methods.map(paymentWord).join(" / ") || "—";
  return {
    storeName: chrome.storeName?.trim() || "Store",
    tenantName: chrome.tenantName?.trim() || null,
    txnLabel: sale.receiptNo || sale.id,
    completedAt: sale.soldAt,
    cashierName: sale.cashier.name,
    customerName: sale.customer?.name || "Walk-in",
    lines: sale.items.map((item) => ({
      productName: item.product.name,
      unitBatchLabel: `${unitWord(item.unitType)} · ${item.batch.batchNumber}`,
      qty: item.unitQty,
      rate: item.unitPrice,
      amount: item.lineTotal,
    })),
    subtotal: sale.subtotal,
    discount: sale.discount,
    loyaltyTaka: sale.loyaltyUsed,
    total: sale.total,
    paymentLabel,
    paymentReference: refs[0] ?? null,
    amountPaid: amountPaid(sale),
  };
}
