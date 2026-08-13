import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  AlertTriangle,
  Check,
  Gift,
  KeyRound,
  Loader2,
  Printer,
  UserRound,
} from "lucide-react";
import { ReceiptPreviewPanel } from "@/features/pos/ReceiptPreviewPanel";
import { useLocale } from "@/i18n";
import { formatCustomerPhone } from "@/lib/customerSearch";
import { formatTaka } from "@/lib/format";
import {
  isPrintBusy,
  runPrintStub,
  type PrintPhase,
} from "@/lib/printStub";
import {
  buildReceiptModel,
  type ReceiptPaperWidth,
  type ReceiptPrintModel,
} from "@/lib/receiptModel";
import type { PackagingUnitType } from "@/lib/qtyPackaging";
import {
  formatTransactionListTime,
  type LoggedTransaction,
  type TransactionPaymentMethod,
} from "@/lib/transactionLogStore";

export type TransactionDetailViewProps = {
  entry: LoggedTransaction;
  tenantId: string;
  storeId: string | null;
  onBack: () => void;
};

/**
 * Transactions Detail + Reprint (M3 Batch AK).
 * Items / totals / method / customer / loyalty from local log snapshot.
 * Reprint → `buildReceiptModel` + Receipt Preview + print stub (no real IPC).
 * ←/→ CTAs · Esc / Back → list. No Tab. No Baki.
 */
export function TransactionDetailView({
  entry,
  tenantId,
  storeId,
  onBack,
}: TransactionDetailViewProps) {
  const { t } = useLocale();
  const reprintRef = useRef<HTMLButtonElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const printAbortRef = useRef<AbortController | null>(null);

  const [paperWidth, setPaperWidth] = useState<ReceiptPaperWidth>("80mm");
  const [printPhase, setPrintPhase] = useState<PrintPhase>("idle");

  const receipt: ReceiptPrintModel = buildReceiptModel({
    txnLabel: entry.txnLabel,
    invoiceLabel: entry.invoiceLabel,
    completedAt: entry.completedAt,
    cashierName: entry.cashierName,
    customer: entry.customer,
    lines: entry.lines,
    cartSubtotal: entry.cartSubtotal,
    loyaltyTaka: entry.loyaltyTaka,
    cashSettlement: entry.cashSettlement,
    cardSettlement: entry.cardSettlement,
    mfsSettlement: entry.mfsSettlement,
    paperWidth,
    tenantId,
    storeId,
  });

  const abortPrint = useCallback(() => {
    printAbortRef.current?.abort();
    printAbortRef.current = null;
  }, []);

  useEffect(() => () => abortPrint(), [abortPrint]);

  useEffect(() => {
    // Reset print state when switching transactions.
    abortPrint();
    setPrintPhase("idle");
    queueMicrotask(() => reprintRef.current?.focus());
  }, [entry.txnLabel, entry.eventId, abortPrint]);

  const startPrint = useCallback(
    async (mode: "printing" | "retrying") => {
      if (isPrintBusy(printPhase)) return;
      abortPrint();
      const ac = new AbortController();
      printAbortRef.current = ac;
      setPrintPhase(mode);
      try {
        const result = await runPrintStub({
          signal: ac.signal,
          receipt: buildReceiptModel({
            txnLabel: entry.txnLabel,
            invoiceLabel: entry.invoiceLabel,
            completedAt: entry.completedAt,
            cashierName: entry.cashierName,
            customer: entry.customer,
            lines: entry.lines,
            cartSubtotal: entry.cartSubtotal,
            loyaltyTaka: entry.loyaltyTaka,
            cashSettlement: entry.cashSettlement,
            cardSettlement: entry.cardSettlement,
            mfsSettlement: entry.mfsSettlement,
            paperWidth,
            tenantId,
            storeId,
          }),
        });
        if (ac.signal.aborted) return;
        setPrintPhase(result);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setPrintPhase("failed");
      } finally {
        if (printAbortRef.current === ac) printAbortRef.current = null;
      }
    },
    [
      printPhase,
      abortPrint,
      entry,
      paperWidth,
      tenantId,
      storeId,
    ],
  );

  const busy = isPrintBusy(printPhase);
  const failed = printPhase === "failed";
  const printed = printPhase === "printed";

  useEffect(() => {
    queueMicrotask(() => {
      if (failed) {
        retryRef.current?.focus();
        return;
      }
      if (printed || printPhase === "idle") {
        reprintRef.current?.focus();
      }
    });
  }, [failed, printed, busy, printPhase]);

  const methodLabel = (method: TransactionPaymentMethod) => {
    switch (method) {
      case "CARD":
        return t("completed.card");
      case "MFS":
        return (
          entry.mfsSettlement?.providerLabel?.trim() || t("completed.mfs")
        );
      case "LOYALTY":
        return t("txns.methodLoyalty");
      case "CASH":
      default:
        return t("completed.cash");
    }
  };

  const unitDisplayLabel = (unitType: PackagingUnitType) => {
    if (unitType === "PIECE") return t("pos.piece");
    if (unitType === "STRIP") return t("pos.strip");
    return t("pos.box");
  };

  const focusCtaRelative = (delta: number) => {
    const buttons = (
      failed
        ? [retryRef.current, backRef.current]
        : busy
          ? [backRef.current]
          : [reprintRef.current, backRef.current]
    ).filter((b): b is HTMLButtonElement => b != null);
    if (buttons.length === 0) return;
    const active = document.activeElement;
    let idx = buttons.indexOf(active as HTMLButtonElement);
    if (idx < 0) idx = 0;
    const next = (idx + delta + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };

  const onDetailKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      event.key === "ArrowLeft" ||
      event.key === "ArrowUp" ||
      event.key === "ArrowRight" ||
      event.key === "ArrowDown"
    ) {
      event.preventDefault();
      event.stopPropagation();
      const back = event.key === "ArrowLeft" || event.key === "ArrowUp";
      focusCtaRelative(back ? -1 : 1);
      return;
    }
    if (event.key === "Enter" && failed) {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag !== "BUTTON") {
        event.preventDefault();
        event.stopPropagation();
        void startPrint("retrying");
      }
    }
  };

  const cash = entry.cashSettlement;
  const card = entry.cardSettlement;
  const mfs = entry.mfsSettlement;
  const isTender = cash != null || card != null || mfs != null;
  const customer = entry.customer;
  const settlement = entry.settlement;

  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row"
      onKeyDown={onDetailKeyDown}
    >
      <div className="min-h-0 flex-1 overflow-auto px-4 py-4 sm:px-5">
        <div className="mx-auto w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-canvas shadow-sm">
          <div className="border-b border-border bg-primary/10 px-4 py-3">
            <p className="font-mono text-xs font-semibold text-primary">
              {entry.txnLabel}
            </p>
            <p className="mt-0.5 text-xs text-muted">{entry.invoiceLabel}</p>
            <p className="mt-1 text-[11px] tabular-nums text-muted">
              {formatTransactionListTime(entry.completedAt)} ·{" "}
              {entry.cashierName}
            </p>
          </div>

          <div className="space-y-4 p-4">
            <section className="rounded-lg border border-border border-l-4 border-l-accent bg-surface px-3.5 py-3">
              <div className="flex items-start gap-2.5">
                <span
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent"
                  aria-hidden
                >
                  <UserRound className="size-4" strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  {customer ? (
                    <>
                      <p className="truncate text-sm font-bold text-foreground">
                        {customer.name}
                      </p>
                      <p className="text-xs tabular-nums text-muted">
                        {formatCustomerPhone(customer.phone) ||
                          t("loyalty.noPhone")}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm font-bold text-foreground">
                      {t("cart.walkInCustomer")}
                    </p>
                  )}
                </div>
              </div>
              {customer ? (
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-dashed border-border pt-3 text-xs">
                  <div>
                    <dt className="text-muted">
                      {t("completed.previousBalance")}
                    </dt>
                    <dd className="font-semibold tabular-nums text-foreground">
                      {settlement.previousBalance} {t("completed.pts")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">
                      {t("completed.loyaltyUsed")}
                    </dt>
                    <dd className="font-semibold tabular-nums text-destructive">
                      −{settlement.used} {t("completed.pts")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">
                      {t("completed.newPointsEarned")}
                    </dt>
                    <dd className="font-semibold tabular-nums text-foreground">
                      {settlement.earned} {t("completed.pts")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">
                      {t("completed.currentBalance")}
                    </dt>
                    <dd className="font-bold tabular-nums text-primary">
                      {settlement.currentBalance} {t("completed.pts")}
                    </dd>
                  </div>
                </dl>
              ) : null}
            </section>

            <section>
              <p className="mb-2 text-[10px] font-bold tracking-wide text-muted uppercase">
                {t("completed.itemSummary")}
              </p>
              {entry.lines.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted">
                  {t("txns.noLines")}
                </p>
              ) : (
                <ul className="max-h-56 space-y-2 overflow-auto pr-0.5">
                  {entry.lines.map((line) => {
                    const generic = [
                      line.genericName?.trim(),
                      line.strength?.trim(),
                    ]
                      .filter(Boolean)
                      .join(" ");
                    return (
                      <li
                        key={line.id}
                        className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-bold text-foreground">
                              {line.productName}
                            </p>
                            {generic ? (
                              <p className="truncate text-xs text-muted">
                                {generic}
                              </p>
                            ) : null}
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              <span className="rounded border border-border bg-shell px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                                {line.unitQty}{" "}
                                {unitDisplayLabel(line.unitType)}
                              </span>
                              <span className="rounded border border-border bg-shell px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                                {t("completed.batch")} {line.batchNumber}
                              </span>
                              {line.fefoOverride ? (
                                <span className="inline-flex items-center gap-1 rounded border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-accent uppercase">
                                  <KeyRound
                                    className="size-3"
                                    strokeWidth={2}
                                    aria-hidden
                                  />
                                  {t("completed.authOverride")}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <span className="shrink-0 font-bold tabular-nums text-primary">
                            {formatTaka(line.lineTotal)}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section>
              <p className="mb-2 text-[10px] font-bold tracking-wide text-muted uppercase">
                {isTender
                  ? t("completed.settlementSummary")
                  : t("completed.financialSummary")}
              </p>
              <dl className="space-y-2 rounded-lg border border-border bg-surface px-3.5 py-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">
                    {t("completed.merchandiseSubtotal")}
                  </dt>
                  <dd className="font-semibold tabular-nums text-foreground">
                    {formatTaka(entry.cartSubtotal)}
                  </dd>
                </div>
                {entry.loyaltyTaka > 0 ? (
                  <div className="flex justify-between gap-3">
                    <dt className="inline-flex items-center gap-1.5 text-muted">
                      <Gift
                        className="size-3.5 text-primary"
                        strokeWidth={2}
                        aria-hidden
                      />
                      {t("completed.loyaltyRedemption")}
                    </dt>
                    <dd className="font-bold tabular-nums text-primary">
                      −{formatTaka(entry.loyaltyTaka)}
                    </dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-3 border-t border-border pt-2">
                  <dt className="font-semibold text-foreground">
                    {t("completed.total")}
                  </dt>
                  <dd className="font-bold tabular-nums text-foreground">
                    {formatTaka(entry.total)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">
                    {t("completed.paymentMethod")}
                  </dt>
                  <dd className="font-semibold text-foreground">
                    {methodLabel(entry.paymentMethod)}
                  </dd>
                </div>
                {cash ? (
                  <>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">
                        {t("completed.cashReceived")}
                      </dt>
                      <dd className="font-semibold tabular-nums text-foreground">
                        {formatTaka(cash.cashReceived)}
                      </dd>
                    </div>
                    {cash.changeReturned > 0 ? (
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted">
                          {t("completed.changeReturned")}
                        </dt>
                        <dd className="font-semibold tabular-nums text-foreground">
                          {formatTaka(cash.changeReturned)}
                        </dd>
                      </div>
                    ) : null}
                  </>
                ) : null}
                {card ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">{t("txns.cardStatus")}</dt>
                    <dd className="font-semibold text-foreground">
                      {card.status}
                    </dd>
                  </div>
                ) : null}
                {mfs ? (
                  <>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">{t("txns.mfsMobile")}</dt>
                      <dd className="font-semibold tabular-nums text-foreground">
                        {mfs.payerMobile}
                      </dd>
                    </div>
                    {mfs.trxId ? (
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted">{t("txns.mfsTrx")}</dt>
                        <dd className="min-w-0 truncate font-semibold text-foreground">
                          {mfs.trxId}
                        </dd>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </dl>
            </section>

            <section className="space-y-2.5 border-t border-border pt-3">
              {failed ? (
                <div
                  className="rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-3"
                  aria-live="polite"
                >
                  <p className="inline-flex items-center gap-2 text-sm font-semibold text-destructive">
                    <AlertTriangle
                      className="size-4 shrink-0"
                      strokeWidth={2}
                      aria-hidden
                    />
                    {t("completed.printFailedTitle")}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {t("completed.printFailedBody")}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      ref={retryRef}
                      type="button"
                      onClick={() => void startPrint("retrying")}
                      className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <Printer
                        className="size-4"
                        strokeWidth={1.75}
                        aria-hidden
                      />
                      {t("completed.retryPrintEnter")}
                    </button>
                    <button
                      ref={backRef}
                      type="button"
                      onClick={onBack}
                      className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-shell px-3 py-2.5 text-sm font-semibold text-foreground hover:bg-shell/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      {t("txns.backToList")}
                    </button>
                  </div>
                  <p className="mt-2.5 text-[11px] text-muted">
                    {t("completed.printFailedHint")}
                  </p>
                </div>
              ) : (
                <>
                  {busy ? (
                    <div
                      className="rounded-lg border border-border bg-shell/60 px-3.5 py-3"
                      aria-live="polite"
                    >
                      <p className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                        <Loader2
                          className="size-4 shrink-0 animate-spin text-primary"
                          strokeWidth={2}
                          aria-hidden
                        />
                        {printPhase === "retrying"
                          ? t("completed.retryingPrint")
                          : t("completed.printingReceipt")}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {printPhase === "retrying"
                          ? t("completed.retryingBody")
                          : t("completed.printingBody")}
                      </p>
                    </div>
                  ) : null}

                  {printed ? (
                    <div
                      className="rounded-lg border border-primary/25 bg-primary/5 px-3.5 py-3"
                      aria-live="polite"
                    >
                      <p className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
                        <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check
                            className="size-3"
                            strokeWidth={3}
                            aria-hidden
                          />
                        </span>
                        {t("completed.printedSuccess")}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {t("completed.printedFor").replace(
                          "{txn}",
                          entry.txnLabel,
                        )}
                      </p>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-2 gap-2">
                    {busy ? (
                      <button
                        type="button"
                        disabled
                        className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-md border border-border bg-shell px-3 py-2.5 text-sm font-semibold text-muted"
                      >
                        <Loader2
                          className="size-4 animate-spin"
                          strokeWidth={1.75}
                          aria-hidden
                        />
                        {t("completed.printingEllipsis")}
                      </button>
                    ) : (
                      <button
                        ref={reprintRef}
                        type="button"
                        onClick={() => void startPrint("printing")}
                        className="inline-flex items-center justify-center gap-2 rounded-md border-2 border-primary bg-surface px-3 py-2.5 text-sm font-semibold text-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        <Printer
                          className="size-4"
                          strokeWidth={1.75}
                          aria-hidden
                        />
                        {t("completed.reprint")}
                      </button>
                    )}
                    <button
                      ref={backRef}
                      type="button"
                      onClick={onBack}
                      className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-shell px-3 py-2.5 text-sm font-semibold text-foreground hover:bg-shell/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      {t("txns.backToList")}
                    </button>
                  </div>
                </>
              )}
            </section>
          </div>
        </div>
      </div>

      <div className="flex min-h-72 shrink-0 flex-col border-t border-border lg:min-h-0 lg:w-[26rem] lg:border-t-0 lg:border-l">
        <ReceiptPreviewPanel
          receipt={receipt}
          paperWidth={paperWidth}
          onPaperWidthChange={setPaperWidth}
        />
      </div>
    </div>
  );
}
