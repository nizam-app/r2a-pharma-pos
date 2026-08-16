import { useEffect } from "react";
import { useLocale } from "@/i18n";
import {
  formatReceiptDateTime,
  formatReceiptMoney,
  type ReceiptPreviewModel,
} from "@/lib/receiptPreview";

export function ReprintReceiptModal({
  receipt,
  onClose,
}: {
  receipt: ReceiptPreviewModel;
  onClose: () => void;
}) {
  const { t } = useLocale();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-auto bg-foreground/40 px-4 py-10"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reprint-title"
        className="w-full max-w-md rounded-xl border border-border bg-surface shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id="reprint-title" className="text-sm font-semibold text-foreground">
            {t("sales.detail.reprint")}
          </h2>
          <button
            type="button"
            className="rounded-md border border-border px-2.5 py-1 text-sm text-foreground hover:bg-canvas"
            onClick={onClose}
          >
            {t("sales.detail.close")}
          </button>
        </div>
        <div className="px-4 py-4">
          <div className="mx-auto max-w-[20rem] border border-border bg-white px-3.5 py-4 text-neutral-900">
            <div className="font-mono text-[11px] leading-relaxed">
              <header className="text-center">
                {receipt.tenantName ? (
                  <p className="text-sm font-bold tracking-wide uppercase">
                    {receipt.tenantName}
                  </p>
                ) : null}
                <p className={receipt.tenantName ? "mt-0.5" : "text-sm font-bold"}>
                  {receipt.storeName}
                </p>
              </header>
              <dl className="mt-3 space-y-0.5">
                <MetaRow label="Txn:" value={receipt.txnLabel} />
                <MetaRow
                  label="Date:"
                  value={formatReceiptDateTime(receipt.completedAt)}
                />
                <MetaRow label="Cashier:" value={receipt.cashierName} />
                <MetaRow label="Customer:" value={receipt.customerName} />
              </dl>
              <div className="mt-3 grid grid-cols-[1fr_1.75rem_3rem_3rem] gap-x-1 border-t border-neutral-300 pt-2 text-[10px] font-bold tracking-wide uppercase">
                <span>Item</span>
                <span className="text-center">Qty</span>
                <span className="text-right">Rate</span>
                <span className="text-right">Amt</span>
              </div>
              <ul className="mt-1.5 space-y-2">
                {receipt.lines.map((line, idx) => (
                  <li
                    key={`${line.productName}-${idx}`}
                    className="grid grid-cols-[1fr_1.75rem_3rem_3rem] gap-x-1"
                  >
                    <div className="min-w-0">
                      <p className="font-bold wrap-break-word">{line.productName}</p>
                      <p className="text-[10px] text-neutral-600">
                        {line.unitBatchLabel}
                      </p>
                    </div>
                    <span className="text-center tabular-nums">{line.qty}</span>
                    <span className="text-right tabular-nums">
                      {formatReceiptMoney(line.rate)}
                    </span>
                    <span className="text-right font-semibold tabular-nums">
                      {formatReceiptMoney(line.amount)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 space-y-0.5 border-t border-dashed border-neutral-400/80 pt-2">
                <div className="flex justify-between gap-2">
                  <span>Subtotal:</span>
                  <span className="tabular-nums">
                    {formatReceiptMoney(receipt.subtotal)}
                  </span>
                </div>
                {receipt.discount > 0 ? (
                  <div className="flex justify-between gap-2">
                    <span>Discount:</span>
                    <span className="tabular-nums">
                      −{formatReceiptMoney(receipt.discount)}
                    </span>
                  </div>
                ) : null}
                {receipt.loyaltyTaka > 0 ? (
                  <div className="flex justify-between gap-2">
                    <span>Loyalty:</span>
                    <span className="tabular-nums">
                      −{formatReceiptMoney(receipt.loyaltyTaka)}
                    </span>
                  </div>
                ) : null}
                <div className="flex justify-between gap-2 font-bold">
                  <span>TOTAL:</span>
                  <span className="tabular-nums">
                    Tk {formatReceiptMoney(receipt.total)}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>Paid ({receipt.paymentLabel}):</span>
                  <span className="tabular-nums">
                    {formatReceiptMoney(receipt.amountPaid)}
                  </span>
                </div>
                {receipt.paymentReference ? (
                  <div className="flex justify-between gap-2">
                    <span>Ref:</span>
                    <span className="tabular-nums">{receipt.paymentReference}</span>
                  </div>
                ) : null}
                <div className="flex justify-between gap-2">
                  <span>Due:</span>
                  <span className="tabular-nums">{formatReceiptMoney(0)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt>{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
