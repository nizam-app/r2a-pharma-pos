import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  type KeyboardEvent,
} from "react";
import { CheckCircle2, Info, UserRound, X } from "lucide-react";
import { useLocale } from "@/i18n";
import {
  formatCustomerPhone,
  type SaleCustomer,
} from "@/lib/customerSearch";
import { formatTaka } from "@/lib/format";
import {
  LOYALTY_REDEEM_ELIGIBILITY_MIN,
  previewLoyaltyRedeem,
} from "@/lib/loyaltyRedeem";

export type RedeemLoyaltyModalProps = {
  customer: SaleCustomer;
  /** Merchandise total before loyalty (subtotal − discount). */
  saleTotalTaka: number;
  onClose: () => void;
  /**
   * Continue without redeeming — gate toward tender Slice 3
   * (no Cash/Card/MFS invent). Default / primary CTA (right).
   */
  onContinueWithout: () => void;
  /** Open OTP verify for usable points. */
  onRedeem: (usablePoints: number) => void;
};

/**
 * Redeem Loyalty Points (Batch S).
 *
 * CTA lock (overrides mock if needed):
 * - Continue without redeeming = RIGHT, colorful primary, default focus
 * - Redeem = LEFT, secondary
 *
 * Chrome stays Search Results - Napa (modal content only).
 */
export function RedeemLoyaltyModal({
  customer,
  saleTotalTaka,
  onClose,
  onContinueWithout,
  onRedeem,
}: RedeemLoyaltyModalProps) {
  const { t } = useLocale();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const redeemRef = useRef<HTMLButtonElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);

  const preview = useMemo(
    () => previewLoyaltyRedeem(customer.loyaltyPoints, saleTotalTaka),
    [customer.loyaltyPoints, saleTotalTaka],
  );

  const phoneLabel =
    formatCustomerPhone(customer.phone) || t("loyalty.noPhone");
  const canRedeem = preview.eligible && preview.usablePoints > 0;

  useEffect(() => {
    dialogRef.current?.focus();
    queueMicrotask(() => continueRef.current?.focus());
  }, []);

  const redeem = useCallback(() => {
    if (!canRedeem) return;
    onRedeem(preview.usablePoints);
  }, [canRedeem, preview.usablePoints, onRedeem]);

  const focusCtaRelative = (delta: number) => {
    const buttons = [redeemRef.current, continueRef.current].filter(
      (b): b is HTMLButtonElement => b != null && !b.disabled,
    );
    if (buttons.length === 0) return;
    const active = document.activeElement;
    let idx = buttons.indexOf(active as HTMLButtonElement);
    if (idx < 0) idx = buttons.length - 1; // default Continue
    const next = (idx + delta + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
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
        // Native button activation via Enter.
        return;
      }
      // Default: Continue without (primary).
      event.preventDefault();
      event.stopPropagation();
      onContinueWithout();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]"
      role="presentation"
      onMouseDown={(e) => {
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
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-xl outline-none"
      >
        <div className="relative border-b border-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3.5 right-4 rounded-md p-1 text-muted hover:bg-shell hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label={t("pos.close")}
          >
            <X className="size-5" strokeWidth={1.75} />
          </button>
          <h2
            id={titleId}
            className="pr-8 text-xl font-bold tracking-tight text-foreground"
          >
            {t("loyalty.redeemTitle")}
          </h2>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <UserRound
                className="mt-0.5 size-5 shrink-0 text-primary"
                strokeWidth={1.75}
                aria-hidden
              />
              <div className="min-w-0">
                <p className="truncate text-base font-bold text-foreground">
                  {customer.name}
                </p>
                <p className="text-sm tabular-nums text-muted">{phoneLabel}</p>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[10px] font-bold tracking-wide text-muted uppercase">
                {t("loyalty.availablePoints")}
              </p>
              <p className="text-3xl font-bold tabular-nums text-connected">
                {preview.availablePoints}
              </p>
            </div>
          </div>

          <p className="text-xs text-muted">
            {t("loyalty.rateAndThreshold")}{" "}
            {LOYALTY_REDEEM_ELIGIBILITY_MIN} {t("loyalty.points")}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border border-border bg-canvas px-3 py-2.5">
              <p className="text-[10px] font-bold tracking-wide text-muted uppercase">
                {t("loyalty.availableLoyaltyValue")}
              </p>
              <p className="mt-1 text-lg font-bold tabular-nums text-foreground">
                {formatTaka(preview.availableLoyaltyValueTaka)}
              </p>
            </div>
            <div
              className={[
                "flex items-center gap-2 rounded-md border px-3 py-2.5",
                preview.eligible
                  ? "border-connected/30 bg-connected/10"
                  : "border-border bg-canvas",
              ].join(" ")}
            >
              {preview.eligible ? (
                <CheckCircle2
                  className="size-5 shrink-0 text-connected"
                  strokeWidth={2}
                  aria-hidden
                />
              ) : null}
              <p
                className={[
                  "text-xs font-bold tracking-wide uppercase",
                  preview.eligible ? "text-connected" : "text-muted",
                ].join(" ")}
              >
                {preview.eligible
                  ? t("loyalty.eligibleToRedeem")
                  : t("loyalty.notEligibleToRedeem")}
              </p>
            </div>
          </div>

          <div className="space-y-2 rounded-md border border-border bg-canvas px-3 py-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted">
                {t("loyalty.currentSaleTotal")}
              </span>
              <span className="font-semibold tabular-nums text-foreground">
                {formatTaka(preview.saleTotalTaka)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted">
                {t("loyalty.usableOnThisSale")}
              </span>
              <span className="font-bold tabular-nums text-primary">
                {preview.usablePoints} {t("loyalty.pointsEquals")}{" "}
                {formatTaka(preview.usableTaka)}
              </span>
            </div>
            <div className="flex justify-between gap-3 border-t border-border pt-2">
              <span className="text-muted">
                {t("loyalty.remainingAfter")}
              </span>
              <span className="font-semibold tabular-nums text-foreground">
                {preview.remainingAfter} {t("loyalty.points")}
              </span>
            </div>
          </div>

          <div className="flex gap-2.5 rounded-md border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm text-sky-900">
            <Info
              className="mt-0.5 size-4 shrink-0 text-sky-600"
              strokeWidth={2}
              aria-hidden
            />
            <p>
              {t("loyalty.capNotePrefix")}{" "}
              <span className="font-semibold tabular-nums">
                {preview.remainingAfter} {t("loyalty.pointsLower")}
              </span>{" "}
              {t("loyalty.capNoteSuffix")}
            </p>
          </div>
        </div>

        <div className="space-y-3 border-t border-border px-5 py-4">
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold tracking-wide text-muted uppercase">
            <span>
              <kbd className="rounded bg-shell px-1.5 py-0.5 text-foreground">
                Enter
              </kbd>{" "}
              {t("loyalty.activate")}
            </span>
            <span>
              <kbd className="rounded bg-shell px-1.5 py-0.5 text-foreground">
                Esc
              </kbd>{" "}
              {t("footer.cancel")}
            </span>
            <span>
              <kbd className="rounded bg-shell px-1.5 py-0.5 text-foreground">
                ←→
              </kbd>{" "}
              {t("loyalty.navigate")}
            </span>
          </p>

          {/*
            CTA lock: Redeem LEFT · Continue without RIGHT primary (teal).
            Redeem uses accent indigo so it stays secondary but distinct from Continue.
            Navigator = arrows only — Tab is not used.
          */}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-stretch">
            <button
              ref={redeemRef}
              type="button"
              onClick={redeem}
              disabled={!canRedeem}
              className="flex flex-1 flex-col items-center justify-center rounded-md border border-accent bg-accent px-3 py-2.5 text-sm font-bold tracking-wide text-white uppercase hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:border-border disabled:bg-shell disabled:text-muted disabled:opacity-70"
            >
              {t("loyalty.redeemPoints")} {preview.usablePoints}{" "}
              {t("loyalty.points")}
              <span
                className={[
                  "mt-0.5 text-[11px] font-semibold normal-case tracking-normal",
                  canRedeem ? "text-white/85" : "text-muted",
                ].join(" ")}
              >
                {t("loyalty.save")} {formatTaka(preview.usableTaka)}
              </span>
            </button>
            <button
              ref={continueRef}
              type="button"
              onClick={onContinueWithout}
              className="flex flex-1 items-center justify-center rounded-md bg-primary px-3 py-2.5 text-sm font-bold tracking-wide text-primary-foreground uppercase hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {t("loyalty.continueWithout")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
