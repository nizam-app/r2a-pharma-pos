import { useLocale } from "@/i18n";
import type { ReceiptPaperWidth, ReceiptPrintModel } from "@/lib/receiptModel";
import {
  formatReceiptDateTime,
  formatReceiptMoney,
} from "@/lib/receiptModel";

export type ReceiptPreviewPanelProps = {
  receipt: ReceiptPrintModel;
  paperWidth: ReceiptPaperWidth;
  onPaperWidthChange: (width: ReceiptPaperWidth) => void;
};

/**
 * Inline Receipt Preview (Batch AA + AH) — sits beside Sale Completed.
 * Same `ReceiptPrintModel` feeds future Tauri printer IPC simultaneously.
 * Visual lock: thermal monospace layout; pharmacy header from Settings
 * (stub fallback); 80/58 toggle.
 * Chrome labels localize; receipt body/template stays English/domain as modeled.
 */
export function ReceiptPreviewPanel({
  receipt,
  paperWidth,
  onPaperWidthChange,
}: ReceiptPreviewPanelProps) {
  const { t } = useLocale();
  const paperMax =
    paperWidth === "80mm" ? "max-w-[20rem]" : "max-w-[14.5rem]";
  const dashed = "border-0 border-t border-dashed border-neutral-400/80";

  return (
    <aside
      className="flex h-full min-h-0 w-full flex-col border-border bg-shell/40 lg:max-w-[26rem] lg:border-l"
      aria-label={t("completed.receiptPreview")}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface px-3 py-2.5">
        <p className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">
          {t("completed.receiptPreview")}
        </p>
        <div
          className="inline-flex rounded-md border border-border p-0.5"
          role="group"
          aria-label={t("completed.paperWidth")}
        >
          <button
            type="button"
            aria-pressed={paperWidth === "80mm"}
            onClick={() => onPaperWidthChange("80mm")}
            className={
              paperWidth === "80mm"
                ? "rounded px-2.5 py-1 text-[11px] font-bold text-accent ring-1 ring-accent/40 bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                : "rounded px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-shell focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            }
          >
            80mm
          </button>
          <button
            type="button"
            aria-pressed={paperWidth === "58mm"}
            onClick={() => onPaperWidthChange("58mm")}
            className={
              paperWidth === "58mm"
                ? "rounded px-2.5 py-1 text-[11px] font-bold text-accent ring-1 ring-accent/40 bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                : "rounded px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-shell focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            }
          >
            58mm
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-3 py-4 sm:px-4">
        <div
          className={`mx-auto w-full ${paperMax} border border-border bg-white px-3.5 py-4 text-neutral-900 shadow-sm transition-[max-width] duration-200`}
        >
          <div className="font-mono text-[11px] leading-relaxed">
            <header className="text-center">
              <p className="text-sm font-bold tracking-wide uppercase">
                {receipt.pharmacy.name}
              </p>
              <p className="mt-0.5">{receipt.pharmacy.branch}</p>
              <p className="mt-0.5 text-[10px] text-neutral-700">
                {receipt.pharmacy.address}
              </p>
              <p className="mt-0.5 text-[10px] text-neutral-700">
                {receipt.pharmacy.phone}
              </p>
            </header>

            <dl className="mt-3 space-y-0.5">
              <MetaRow label="Invoice:" value={receipt.invoiceLabel} />
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
                    <p className="font-bold wrap-break-word">
                      {line.productName}
                    </p>
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

            <div className={`mt-3 ${dashed} space-y-0.5 pt-2`}>
              <div className="flex justify-between gap-2">
                <span>Subtotal:</span>
                <span className="tabular-nums">
                  {formatReceiptMoney(receipt.subtotal)}
                </span>
              </div>
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
            </div>

            <div className={`mt-2 ${dashed} space-y-0.5 pt-2`}>
              {receipt.payment.kind === "cash" ? (
                <>
                  <div className="flex justify-between gap-2 font-bold">
                    <span>CASH:</span>
                    <span className="tabular-nums">
                      {formatReceiptMoney(receipt.payment.amountPaid)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span>Cash received:</span>
                    <span className="tabular-nums">
                      {formatReceiptMoney(receipt.payment.cashReceived)}
                    </span>
                  </div>
                  {receipt.payment.changeReturned > 0 ? (
                    <div className="flex justify-between gap-2">
                      <span>Change:</span>
                      <span className="tabular-nums">
                        {formatReceiptMoney(receipt.payment.changeReturned)}
                      </span>
                    </div>
                  ) : null}
                </>
              ) : receipt.payment.kind === "card" ? (
                <>
                  <div className="flex justify-between gap-2 font-bold">
                    <span>CARD:</span>
                    <span className="tabular-nums">
                      {formatReceiptMoney(receipt.payment.amountPaid)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span>Status:</span>
                    <span>{receipt.payment.status}</span>
                  </div>
                </>
              ) : receipt.payment.kind === "mfs" ? (
                <>
                  <div className="flex justify-between gap-2 font-bold">
                    <span>MFS:</span>
                    <span className="tabular-nums">
                      {formatReceiptMoney(receipt.payment.amountPaid)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span>Provider:</span>
                    <span>{receipt.payment.providerLabel}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span>Mobile:</span>
                    <span className="tabular-nums">
                      {receipt.payment.payerMobile}
                    </span>
                  </div>
                  {receipt.payment.trxId ? (
                    <div className="flex justify-between gap-2">
                      <span>Trx:</span>
                      <span>{receipt.payment.trxId}</span>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="flex justify-between gap-2 font-bold">
                  <span>LOYALTY:</span>
                  <span className="tabular-nums">
                    {formatReceiptMoney(receipt.payment.loyaltyTaka)}
                  </span>
                </div>
              )}
            </div>

            <footer className={`mt-2 ${dashed} pt-3 text-center`}>
              <p>{receipt.footerThanks}</p>
              <p className="mt-0.5 text-[10px] text-neutral-500">
                {receipt.footerLegal}
              </p>
            </footer>
          </div>
        </div>
      </div>
    </aside>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="shrink-0 text-neutral-700">{label}</dt>
      <dd className="min-w-0 text-right font-medium wrap-break-word">
        {value}
      </dd>
    </div>
  );
}
