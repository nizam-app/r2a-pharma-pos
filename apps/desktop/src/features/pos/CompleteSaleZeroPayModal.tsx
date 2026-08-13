import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
} from "react";
import {
  Check,
  CheckCheck,
  Package,
  Receipt,
  UserRound,
  X,
} from "lucide-react";
import type { CartLine } from "@/features/pos/cartTypes";
import { useLocale } from "@/i18n";
import {
  formatCustomerPhone,
  type SaleCustomer,
} from "@/lib/customerSearch";
import { formatTaka } from "@/lib/format";
import type { PackagingUnitType } from "@/lib/qtyPackaging";

export type CompleteSaleZeroPayModalProps = {
  customer: SaleCustomer;
  lines: CartLine[];
  cartSubtotal: number;
  loyaltyPointsUsed: number;
  loyaltyTaka: number;
  /** Points remaining after redeem (before earn — earn applied on complete). */
  loyaltyBalanceAfterRedeem: number;
  submitting?: boolean;
  onBack: () => void;
  onComplete: () => void;
};

/**
 * Complete Sale? — zero payable after loyalty (Batch T).
 * Visual lock: Complete Sale - Zero Payable. **No Baki** (strip mock debt UI).
 * Enter = Complete · Esc = Back · ←→ navigate · Tab never a POS navigator.
 */
export function CompleteSaleZeroPayModal({
  customer,
  lines,
  cartSubtotal,
  loyaltyPointsUsed,
  loyaltyTaka,
  loyaltyBalanceAfterRedeem,
  submitting = false,
  onBack,
  onComplete,
}: CompleteSaleZeroPayModalProps) {
  const { t } = useLocale();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const completeRef = useRef<HTMLButtonElement>(null);

  const unitDisplayLabel = (unitType: PackagingUnitType) => {
    if (unitType === "PIECE") return t("pos.piece");
    if (unitType === "STRIP") return t("pos.strip");
    return t("pos.box");
  };

  useEffect(() => {
    dialogRef.current?.focus();
    queueMicrotask(() => completeRef.current?.focus());
  }, []);

  const focusCtaRelative = (delta: number) => {
    const buttons = [backRef.current, completeRef.current].filter(
      (b): b is HTMLButtonElement => b != null && !b.disabled,
    );
    if (buttons.length === 0) return;
    const active = document.activeElement;
    let idx = buttons.indexOf(active as HTMLButtonElement);
    if (idx < 0) idx = buttons.length - 1;
    const next = (idx + delta + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (!submitting) onBack();
      return;
    }
    if (
      event.key === "ArrowLeft" ||
      event.key === "ArrowUp" ||
      event.key === "ArrowRight" ||
      event.key === "ArrowDown"
    ) {
      event.preventDefault();
      event.stopPropagation();
      const back =
        event.key === "ArrowLeft" || event.key === "ArrowUp";
      focusCtaRelative(back ? -1 : 1);
      return;
    }
    if (event.key === "Enter") {
      const active = document.activeElement;
      if (
        active instanceof HTMLButtonElement &&
        dialogRef.current?.contains(active)
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (!submitting) onComplete();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[1px]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onBack();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="flex w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-xl outline-none"
      >
        <div className="relative border-b border-border px-5 py-4">
          <button
            type="button"
            onClick={onBack}
            disabled={submitting}
            className="absolute top-3.5 right-4 rounded-md p-1 text-muted hover:bg-shell hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
            aria-label={t("pos.close")}
          >
            <X className="size-5" strokeWidth={1.75} />
          </button>
          <div className="flex items-start justify-between gap-3 pr-10">
            <div>
              <h2
                id={titleId}
                className="text-xl font-bold tracking-tight text-primary"
              >
                {t("zeroPay.title")}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {t("zeroPay.noPaymentRequired")}
              </p>
            </div>
            <span
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
              aria-hidden
            >
              <Check className="size-5" strokeWidth={2.5} />
            </span>
          </div>
        </div>

        <div className="grid gap-3 px-5 py-4 sm:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-3">
            <section className="rounded-lg border border-border bg-surface px-3.5 py-3">
              <header className="mb-2.5 flex items-center gap-1.5 text-[10px] font-bold tracking-wide text-primary uppercase">
                <UserRound className="size-3.5" strokeWidth={2} aria-hidden />
                {t("zeroPay.customerProfile")}
              </header>
              <p className="text-sm font-bold text-foreground">{customer.name}</p>
              {formatCustomerPhone(customer.phone) ? (
                <p className="mt-0.5 text-xs tabular-nums text-muted">
                  {formatCustomerPhone(customer.phone)}
                </p>
              ) : null}
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-muted">{t("completed.loyaltyUsed")}</dt>
                  <dd className="mt-0.5 font-bold tabular-nums text-primary">
                    {loyaltyPointsUsed} {t("loyalty.points")}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">{t("completed.currentBalance")}</dt>
                  <dd className="mt-0.5 font-bold tabular-nums text-foreground">
                    {loyaltyBalanceAfterRedeem} {t("loyalty.points")}
                  </dd>
                </div>
              </dl>
              {/* Baki intentionally omitted — Slice 2 lock: no Baki UI. */}
            </section>

            <section className="rounded-lg border border-border bg-surface px-3.5 py-3">
              <header className="mb-2.5 flex items-center gap-1.5 text-[10px] font-bold tracking-wide text-primary uppercase">
                <Package className="size-3.5" strokeWidth={2} aria-hidden />
                {t("cart.items")} ({lines.length})
              </header>
              <ul className="max-h-40 space-y-2.5 overflow-auto">
                {lines.map((line) => (
                  <li
                    key={line.id}
                    className="flex items-start justify-between gap-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">
                        {line.productName}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {line.unitQty} {unitDisplayLabel(line.unitType)} ·{" "}
                        {t("completed.batch")} {line.batchNumber}
                      </p>
                    </div>
                    <span className="shrink-0 font-bold tabular-nums text-foreground">
                      {formatTaka(line.lineTotal)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className="rounded-lg border border-border bg-surface px-3.5 py-3">
            <header className="mb-2.5 flex items-center gap-1.5 text-[10px] font-bold tracking-wide text-primary uppercase">
              <Receipt className="size-3.5" strokeWidth={2} aria-hidden />
              {t("completed.financialSummary")}
            </header>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">{t("cart.subtotal")}</dt>
                <dd className="font-semibold tabular-nums text-foreground">
                  {formatTaka(cartSubtotal)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">{t("completed.loyaltyRedemption")}</dt>
                <dd className="font-bold tabular-nums text-primary">
                  −{formatTaka(loyaltyTaka)}
                </dd>
              </div>
            </dl>
            <div className="mt-4 rounded-md bg-primary/10 px-3 py-3">
              <p className="text-[10px] font-bold tracking-wide text-primary uppercase">
                {t("completed.amountDue")}
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-primary">
                {formatTaka(0)}
              </p>
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold tracking-wide text-muted uppercase">
            <span>
              <kbd className="rounded bg-foreground px-1.5 py-0.5 text-[10px] text-white">
                Enter
              </kbd>{" "}
              {t("zeroPay.completeHint")}
            </span>
            <span>
              <kbd className="rounded bg-foreground px-1.5 py-0.5 text-[10px] text-white">
                Esc
              </kbd>{" "}
              {t("zeroPay.escHint")}
            </span>
            <span>
              <kbd className="rounded bg-foreground px-1.5 py-0.5 text-[10px] text-white">
                ←→
              </kbd>{" "}
              {t("payment.navigate")}
            </span>
          </p>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-stretch">
            <button
              ref={backRef}
              type="button"
              onClick={onBack}
              disabled={submitting}
              className="rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-shell focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
            >
              {t("payment.backToSale")}
            </button>
            <button
              ref={completeRef}
              type="button"
              onClick={onComplete}
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60"
            >
              <CheckCheck className="size-4" strokeWidth={2} aria-hidden />
              {submitting ? t("zeroPay.completing") : t("zeroPay.complete")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
