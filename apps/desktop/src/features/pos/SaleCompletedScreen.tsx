import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  FileText,
  Gift,
  Info,
  KeyRound,
  Loader2,
  Printer,
  ShoppingCart,
  UserRound,
} from "lucide-react";
import type { CartLine } from "@/features/pos/cartTypes";
import { ReceiptPreviewPanel } from "@/features/pos/ReceiptPreviewPanel";
import { useLocale } from "@/i18n";
import {
  formatCustomerPhone,
  type SaleCustomer,
} from "@/lib/customerSearch";
import { formatTaka } from "@/lib/format";
import type { LoyaltySettlement } from "@/lib/loyaltyCalc";
import { isPrintBusy, type PrintPhase } from "@/lib/printStub";
import type { ReceiptPaperWidth, ReceiptPrintModel } from "@/lib/receiptModel";
import type { PackagingUnitType } from "@/lib/qtyPackaging";

/** Cash tender block on shared Sale Completed shell (Batch X). */
export type CashSettlementView = {
  /** Applied to sale (= amount due). */
  amountPaid: number;
  cashReceived: number;
  changeReturned: number;
};

/** Card tender block on shared Sale Completed shell (Batch AC). */
export type CardSettlementView = {
  /** Applied to sale (= amount due). */
  amountPaid: number;
  /** Stub terminal approved — real SDK auth code later. */
  status: "Approved";
};

/** MFS tender block on shared Sale Completed shell (Batch AD). */
export type MfsSettlementView = {
  /** Applied to sale (= amount due). */
  amountPaid: number;
  /** bKash / Nagad / Rocket display label. */
  providerLabel: string;
  payerMobile: string;
  trxId: string | null;
};

export type SaleCompletedScreenProps = {
  txnLabel: string;
  /** Null = walk-in — hide loyalty grid / points. */
  customer: SaleCustomer | null;
  lines: CartLine[];
  cartSubtotal: number;
  loyaltyTaka: number;
  settlement: LoyaltySettlement;
  /** Present for cash tender; omit for loyalty / card / MFS. */
  cashSettlement?: CashSettlementView | null;
  /** Present for card tender (Batch AC); omit for loyalty / cash / MFS. */
  cardSettlement?: CardSettlementView | null;
  /** Present for MFS tender (Batch AD); omit for loyalty / cash / card. */
  mfsSettlement?: MfsSettlementView | null;
  /** Dynamic receipt for right-side preview + future IPC. */
  receipt: ReceiptPrintModel;
  /** Batch Y print stub phase (auto-started from App). */
  printPhase: PrintPhase;
  onRetryPrint: (paperWidth: ReceiptPaperWidth) => void;
  onReprintReceipt: (paperWidth: ReceiptPaperWidth) => void;
  onNewSale: () => void;
};

/**
 * Shared Sale Completed shell (Batch X + Y + AA + AC + AD).
 * Left: settlement card. Right: Receipt Preview (same model as future IPC).
 * Print stub runs in parallel with the visible preview.
 * Arrow keys navigate CTAs — Tab is not a POS navigator.
 */
export function SaleCompletedScreen({
  txnLabel,
  customer,
  lines,
  cartSubtotal,
  loyaltyTaka,
  settlement,
  cashSettlement = null,
  cardSettlement = null,
  mfsSettlement = null,
  receipt,
  printPhase,
  onRetryPrint,
  onReprintReceipt,
  onNewSale,
}: SaleCompletedScreenProps) {
  const { t } = useLocale();
  const newSaleRef = useRef<HTMLButtonElement>(null);
  const printRef = useRef<HTMLButtonElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const [paperWidth, setPaperWidth] = useState<ReceiptPaperWidth>("80mm");
  const isCash = cashSettlement != null;
  const isCard = cardSettlement != null;
  const isMfs = mfsSettlement != null;
  const isTender = isCash || isCard || isMfs;
  const amountPaid = isCash
    ? cashSettlement.amountPaid
    : isCard
      ? cardSettlement.amountPaid
      : isMfs
        ? mfsSettlement.amountPaid
        : 0;
  const amountDueDisplay = 0;
  const busy = isPrintBusy(printPhase);
  const failed = printPhase === "failed";
  const printed = printPhase === "printed";

  const unitDisplayLabel = (unitType: PackagingUnitType) => {
    if (unitType === "PIECE") return t("pos.piece");
    if (unitType === "STRIP") return t("pos.strip");
    return t("pos.box");
  };

  useEffect(() => {
    queueMicrotask(() => {
      if (failed) {
        retryRef.current?.focus();
        return;
      }
      newSaleRef.current?.focus();
    });
  }, [failed, printed, busy, printPhase]);

  const focusCtaRelative = (delta: number) => {
    const buttons = (
      failed
        ? [retryRef.current, newSaleRef.current]
        : busy
          ? [newSaleRef.current]
          : printed
            ? [printRef.current, newSaleRef.current]
            : [newSaleRef.current]
    ).filter((b): b is HTMLButtonElement => b != null);
    if (buttons.length === 0) return;
    const active = document.activeElement;
    let idx = buttons.indexOf(active as HTMLButtonElement);
    if (idx < 0) idx = 0;
    const next = (idx + delta + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };

  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden bg-canvas lg:flex-row"
      onKeyDown={(event) => {
        if (event.key === "Enter" && failed) {
          const tag = (event.target as HTMLElement | null)?.tagName;
          if (tag !== "BUTTON") {
            event.preventDefault();
            onRetryPrint(paperWidth);
          }
          return;
        }
        if (
          event.key === "ArrowLeft" ||
          event.key === "ArrowUp" ||
          event.key === "ArrowRight" ||
          event.key === "ArrowDown"
        ) {
          event.preventDefault();
          const back =
            event.key === "ArrowLeft" || event.key === "ArrowUp";
          focusCtaRelative(back ? -1 : 1);
        }
      }}
    >
      {/* Sale Completed card */}
      <div className="min-h-0 flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
          {/* Success header — mint band (Figma Canonical Ready) */}
          <div className="flex flex-col items-center bg-primary/10 px-6 py-7 text-center">
            <span
              className="inline-flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm ring-4 ring-white/80"
              aria-hidden
            >
              <Check className="size-8" strokeWidth={2.75} />
            </span>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">
              {t("completed.title")}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {t("completed.successSubtitle")}
            </p>
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold tabular-nums text-muted">
              <FileText className="size-3.5" strokeWidth={2} aria-hidden />
              {txnLabel}
            </span>
          </div>

          <div className="grid gap-0 sm:grid-cols-2">
            {/* Left: customer + items */}
            <div className="flex min-w-0 flex-col gap-4 border-border p-5 sm:border-r">
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

              <section className="min-h-0 flex-1">
                <p className="mb-2 text-[10px] font-bold tracking-wide text-muted uppercase">
                  {t("completed.itemSummary")}
                </p>
                <ul className="max-h-56 space-y-2 overflow-auto pr-0.5">
                  {lines.map((line) => {
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
              </section>
            </div>

            {/* Settlement + print states + actions */}
            <section className="flex flex-col p-5">
              <p className="mb-3 text-[10px] font-bold tracking-wide text-muted uppercase">
                {isTender
                  ? t("completed.settlementSummary")
                  : t("completed.financialSummary")}
              </p>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">
                    {t("completed.merchandiseSubtotal")}
                  </dt>
                  <dd className="font-semibold tabular-nums text-foreground">
                    {formatTaka(cartSubtotal)}
                  </dd>
                </div>
                {isTender ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">
                      {t("completed.discountLoyalty")}
                    </dt>
                    <dd className="font-semibold tabular-nums text-foreground">
                      {formatTaka(loyaltyTaka)}
                    </dd>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">{t("completed.discount")}</dt>
                      <dd className="font-semibold tabular-nums text-foreground">
                        {formatTaka(0)}
                      </dd>
                    </div>
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
                        −{formatTaka(loyaltyTaka)}
                      </dd>
                    </div>
                  </>
                )}
                {isCash ? (
                  <>
                    <div className="flex justify-between gap-3 border-t border-border pt-2">
                      <dt className="text-muted">{t("completed.total")}</dt>
                      <dd className="font-bold tabular-nums text-foreground">
                        {formatTaka(cashSettlement.amountPaid)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">
                        {t("completed.paymentMethod")}
                      </dt>
                      <dd className="font-semibold text-foreground">
                        {t("completed.cash")}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">
                        {t("completed.cashReceived")}
                      </dt>
                      <dd className="font-semibold tabular-nums text-foreground">
                        {formatTaka(cashSettlement.cashReceived)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">
                        {t("completed.changeReturned")}
                      </dt>
                      <dd className="font-bold tabular-nums text-primary">
                        {formatTaka(cashSettlement.changeReturned)}
                      </dd>
                    </div>
                  </>
                ) : null}
                {isCard ? (
                  <>
                    <div className="flex justify-between gap-3 border-t border-border pt-2">
                      <dt className="text-muted">{t("completed.total")}</dt>
                      <dd className="font-bold tabular-nums text-foreground">
                        {formatTaka(cardSettlement.amountPaid)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">
                        {t("completed.paymentMethod")}
                      </dt>
                      <dd className="font-semibold text-foreground">
                        {t("completed.card")}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">
                        {t("completed.cardStatus")}
                      </dt>
                      <dd>
                        <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                          <Check
                            className="size-3"
                            strokeWidth={3}
                            aria-hidden
                          />
                          {t("completed.approved")}
                        </span>
                      </dd>
                    </div>
                  </>
                ) : null}
                {isMfs ? (
                  <>
                    <div className="flex justify-between gap-3 border-t border-border pt-2">
                      <dt className="text-muted">{t("completed.total")}</dt>
                      <dd className="font-bold tabular-nums text-foreground">
                        {formatTaka(mfsSettlement.amountPaid)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">
                        {t("completed.paymentMethod")}
                      </dt>
                      <dd className="font-semibold text-foreground">
                        {t("completed.mfs")}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">{t("completed.provider")}</dt>
                      <dd>
                        <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                          <Check
                            className="size-3"
                            strokeWidth={3}
                            aria-hidden
                          />
                          {mfsSettlement.providerLabel}
                        </span>
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">
                        {t("completed.payerMobile")}
                      </dt>
                      <dd className="font-semibold tabular-nums text-foreground">
                        {formatCustomerPhone(mfsSettlement.payerMobile) ||
                          mfsSettlement.payerMobile}
                      </dd>
                    </div>
                    {mfsSettlement.trxId ? (
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted">{t("completed.trxId")}</dt>
                        <dd className="font-semibold text-foreground">
                          {mfsSettlement.trxId}
                        </dd>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </dl>

              <div className="mt-3 rounded-lg border border-border bg-shell/70 px-3.5 py-3">
                <div className="flex justify-between gap-3 text-sm">
                  <span className="font-semibold text-foreground">
                    {t("completed.amountPaid")}
                  </span>
                  <span className="font-bold tabular-nums text-foreground">
                    {formatTaka(amountPaid)}
                  </span>
                </div>
                <p className="mt-3 text-[10px] font-bold tracking-wide text-muted uppercase">
                  {t("completed.amountDue")}
                </p>
                <p className="mt-0.5 text-3xl font-bold tabular-nums text-foreground">
                  {formatTaka(amountDueDisplay)}
                </p>
                {settlement.fullyCoveredByLoyalty ? (
                  <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-sky-700">
                    <Info
                      className="size-3.5 shrink-0"
                      strokeWidth={2}
                      aria-hidden
                    />
                    {t("completed.fullyCoveredByLoyalty")}
                  </p>
                ) : null}
              </div>

              <div className="mt-auto flex flex-col gap-2.5 pt-6">
                {failed ? (
                  <div
                    className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-3"
                    role="alert"
                  >
                    <p className="inline-flex items-center gap-2 text-sm font-bold text-destructive">
                      <AlertTriangle
                        className="size-4 shrink-0"
                        strokeWidth={2}
                      />
                      {t("completed.printFailedTitle")}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {t("completed.printFailedBody")}
                    </p>
                    <div className="mt-3 flex flex-col gap-2">
                      <button
                        ref={retryRef}
                        type="button"
                        onClick={() => onRetryPrint(paperWidth)}
                        className="inline-flex items-center justify-center gap-2 rounded-md bg-destructive px-3 py-2.5 text-sm font-bold text-white hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
                      >
                        <Printer
                          className="size-4"
                          strokeWidth={1.75}
                          aria-hidden
                        />
                        {t("completed.retryPrintEnter")}
                      </button>
                      <button
                        ref={newSaleRef}
                        type="button"
                        onClick={onNewSale}
                        className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-shell px-3 py-2.5 text-sm font-semibold text-foreground hover:bg-shell/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        <ShoppingCart
                          className="size-4"
                          strokeWidth={1.75}
                          aria-hidden
                        />
                        {t("completed.newSaleF2")}
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
                          {t("completed.printedFor").replace("{txn}", txnLabel)}
                        </p>
                      </div>
                    ) : null}

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
                    ) : printed ? (
                      <button
                        ref={printRef}
                        type="button"
                        onClick={() => onReprintReceipt(paperWidth)}
                        className="inline-flex items-center justify-center gap-2 rounded-md border-2 border-primary bg-surface px-3 py-2.5 text-sm font-semibold text-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        <Printer
                          className="size-4"
                          strokeWidth={1.75}
                          aria-hidden
                        />
                        {t("completed.reprint")}
                      </button>
                    ) : null}

                    <button
                      ref={newSaleRef}
                      type="button"
                      onClick={onNewSale}
                      className={
                        printed
                          ? "inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                          : "inline-flex items-center justify-center gap-2 rounded-md border border-border bg-shell px-3 py-2.5 text-sm font-semibold text-foreground hover:bg-shell/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      }
                    >
                      <ShoppingCart
                        className="size-4"
                        strokeWidth={1.75}
                        aria-hidden
                      />
                      {t("completed.newSaleF2")}
                    </button>

                    {printPhase === "retrying" ? (
                      <p className="text-center text-[11px] text-muted">
                        {t("completed.retryingWait")}
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Receipt preview — always visible; print stub / future IPC use same model */}
      <div className="h-[min(50vh,28rem)] shrink-0 border-t border-border lg:h-auto lg:w-[26rem] lg:border-t-0">
        <ReceiptPreviewPanel
          receipt={{ ...receipt, paperWidth }}
          paperWidth={paperWidth}
          onPaperWidthChange={setPaperWidth}
        />
      </div>
    </div>
  );
}
