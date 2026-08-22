import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { UserRound, X } from "lucide-react";
import { useLocale } from "@/i18n";
import {
  formatCustomerPhone,
  type SaleCustomer,
} from "@/lib/customerSearch";
import { formatTaka } from "@/lib/format";

/** Cash tender draft → Sale Completed ingest (Batch X). */
export type CashSettlementDraft = {
  amountDue: number;
  cashReceived: number;
  changeDue: number;
};

export type CashPaymentModalProps = {
  amountDue: number;
  /** Null = walk-in — no points row. */
  customer: SaleCustomer | null;
  /** Ingest in flight — disable Complete. */
  submitting?: boolean;
  onBackToMethods: () => void;
  onClose: () => void;
  /** Received ≥ due → parent ingests CASH (= amount due) + Sale Completed. */
  onComplete: (draft: CashSettlementDraft) => void;
};

function parseCashReceived(raw: string): number {
  const cleaned = raw.replace(/[^\d.]/g, "");
  if (!cleaned) return 0;
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

/**
 * Cash Payment (Batch W) — Empty + With Change states.
 * Exact Amount · Complete when received ≥ due · Back to Payment Methods.
 * ←→ navigate · Tab never a POS navigator. Chrome = Search Results - Napa.
 */
export function CashPaymentModal({
  amountDue,
  customer,
  submitting = false,
  onBackToMethods,
  onClose,
  onComplete,
}: CashPaymentModalProps) {
  const { t } = useLocale();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const exactRef = useRef<HTMLButtonElement>(null);
  const completeRef = useRef<HTMLButtonElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);

  const [receivedText, setReceivedText] = useState("0.00");

  const cashReceived = useMemo(
    () => parseCashReceived(receivedText),
    [receivedText],
  );
  const changeDue = Math.max(0, Math.round((cashReceived - amountDue) * 100) / 100);
  const canComplete =
    !submitting && cashReceived + 1e-9 >= amountDue;

  useEffect(() => {
    dialogRef.current?.focus();
    queueMicrotask(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, []);

  const applyExactAmount = useCallback(() => {
    setReceivedText(amountDue.toFixed(2));
    queueMicrotask(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [amountDue]);

  const tryComplete = useCallback(() => {
    if (!canComplete || submitting) return;
    onComplete({
      amountDue,
      cashReceived,
      changeDue,
    });
  }, [canComplete, submitting, onComplete, amountDue, cashReceived, changeDue]);

  const focusCtaRelative = (delta: number) => {
    const buttons = [
      exactRef.current,
      completeRef.current,
      backRef.current,
    ].filter((b): b is HTMLButtonElement => b != null && !b.disabled);
    if (buttons.length === 0) return;
    const active = document.activeElement;
    let idx = buttons.indexOf(active as HTMLButtonElement);
    if (idx < 0) {
      idx = delta > 0 ? -1 : 0;
    }
    const next = (idx + delta + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Tab") {
      event.preventDefault();
      return;
    }

    if (event.key === "Escape") {
      if (submitting) return;
      event.preventDefault();
      event.stopPropagation();
      onBackToMethods();
      return;
    }

    const active = document.activeElement;
    const onInput = active === inputRef.current;

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      if (onInput) {
        // Allow caret movement inside the cash field.
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      focusCtaRelative(event.key === "ArrowLeft" ? -1 : 1);
      return;
    }

    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();
      if (onInput && event.key === "ArrowDown") {
        (canComplete ? completeRef : exactRef).current?.focus();
        return;
      }
      if (!onInput && event.key === "ArrowUp") {
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }
      focusCtaRelative(event.key === "ArrowUp" ? -1 : 1);
      return;
    }

    if (event.key === "Enter") {
      if (
        active instanceof HTMLButtonElement &&
        dialogRef.current?.contains(active)
      ) {
        // Native button activation.
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      tryComplete();
    }
  };

  const phoneLabel = customer ? formatCustomerPhone(customer.phone) : null;
  const changeHighlight = changeDue > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[1px]"
      role="presentation"
      onMouseDown={(e) => {
        if (submitting) return;
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-xl outline-none"
      >
        <div className="relative border-b border-border px-5 py-4">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="absolute top-3.5 right-4 rounded-md p-1 text-muted hover:bg-shell hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label={t("pos.close")}
          >
            <X className="size-5" strokeWidth={1.75} />
          </button>
          <h2
            id={titleId}
            className="pr-8 text-xl font-bold tracking-tight text-foreground"
          >
            {t("cash.title")}
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            {t("cash.amountDuePrefix")}{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {formatTaka(amountDue)}
            </span>
          </p>
        </div>

        <div className="space-y-4 px-5 py-4">
          {customer ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-shell/60 px-3.5 py-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <UserRound
                  className="size-4 shrink-0 text-primary"
                  strokeWidth={1.75}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">
                    {customer.name}
                  </p>
                  {phoneLabel ? (
                    <p className="text-xs tabular-nums text-muted">
                      {phoneLabel}
                    </p>
                  ) : null}
                </div>
              </div>
              <span className="shrink-0 rounded-md bg-primary/10 px-2 py-1 text-xs font-bold tabular-nums text-primary">
                {customer.loyaltyPoints} {t("customer.points")}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 rounded-lg border border-border bg-shell/60 px-3.5 py-2.5 text-sm text-muted">
              <UserRound
                className="size-4 shrink-0"
                strokeWidth={1.75}
                aria-hidden
              />
              <p className="font-semibold">{t("cart.walkInCustomer")}</p>
            </div>
          )}

          <div>
            <label
              htmlFor="cash-received"
              className="text-[10px] font-bold tracking-wide text-muted uppercase"
            >
              {t("cash.received")}
            </label>
            <div className="relative mt-1.5">
              <span
                className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-lg font-semibold text-muted"
                aria-hidden
              >
                ৳
              </span>
              <input
                ref={inputRef}
                id="cash-received"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={receivedText}
                onChange={(e) => {
                  const next = e.target.value.replace(/[^\d.]/g, "");
                  const parts = next.split(".");
                  const normalized =
                    parts.length <= 1
                      ? next
                      : `${parts[0]}.${parts.slice(1).join("").slice(0, 2)}`;
                  setReceivedText(normalized);
                }}
                onBlur={() => {
                  setReceivedText(cashReceived.toFixed(2));
                }}
                className="w-full rounded-lg border-2 border-border bg-surface py-3 pr-3.5 pl-8 text-2xl font-bold tabular-nums text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                aria-describedby="cash-summary"
              />
            </div>
          </div>

          <div
            id="cash-summary"
            className="space-y-2 rounded-lg border border-border bg-canvas px-3.5 py-3 text-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted">{t("payment.amountDue")}</span>
              <span className="font-semibold tabular-nums text-foreground">
                {formatTaka(amountDue)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted">{t("cash.received")}</span>
              <span className="font-semibold tabular-nums text-foreground">
                {formatTaka(cashReceived)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
              <span className="font-semibold text-foreground">
                {t("cash.changeDue")}
              </span>
              <span
                className={[
                  "text-base font-bold tabular-nums",
                  changeHighlight ? "text-primary" : "text-foreground",
                ].join(" ")}
              >
                {formatTaka(changeDue)}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2.5">
              <button
                ref={exactRef}
                type="button"
                disabled={submitting}
                onClick={applyExactAmount}
                className="shrink-0 rounded-md border border-foreground/80 bg-surface px-4 py-2.5 text-sm font-semibold whitespace-nowrap text-foreground hover:bg-shell focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t("cash.exactAmount")}
              </button>
              <button
                ref={completeRef}
                type="button"
                disabled={!canComplete}
                onClick={tryComplete}
                className={[
                  "min-w-0 flex-1 rounded-md px-4 py-2.5 text-sm font-bold whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  canComplete
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "cursor-not-allowed bg-shell text-muted",
                ].join(" ")}
              >
                {submitting
                  ? t("cash.completing")
                  : t("cash.completeEnter")}
              </button>
            </div>
            <button
              ref={backRef}
              type="button"
              disabled={submitting}
              onClick={onBackToMethods}
              className="rounded-md px-3 py-2 text-sm font-semibold text-muted hover:bg-shell hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t("cash.backToMethods")}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-border bg-shell px-5 py-2.5 text-xs text-muted">
          <span>
            <kbd className="font-medium text-foreground">[Enter]</kbd>{" "}
            {t("cash.completeHint")}
          </span>
          <span className="text-sm font-semibold text-foreground/55" aria-hidden>
            ›
          </span>
          <span>
            <kbd className="font-medium text-foreground">[Esc]</kbd>{" "}
            {t("cash.methodsHint")}
          </span>
          <span className="text-sm font-semibold text-foreground/55" aria-hidden>
            ›
          </span>
          <span>
            <kbd className="font-medium text-foreground">[←→]</kbd>{" "}
            {t("payment.navigate")}
          </span>
        </div>
      </div>
    </div>
  );
}
