import { CreditCard, Pause, Target, Trash2, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { useLocale } from "@/i18n";
import type { SaleCustomer } from "@/lib/customerSearch";
import { formatTaka } from "@/lib/format";
import { MAX_HELD_SALES } from "@/lib/heldSaleStore";

export type CartPanelProps = {
  itemCount?: number;
  /** Sum of line totals — Discount stays ৳0 until a later slice. */
  subtotal?: number;
  /** Loyalty redeem discount applied after OTP (Batch S). */
  loyaltyDiscount?: number;
  /** Clear all lines; stay on New Sale (Active Cart redesign). */
  onClearSale?: () => void;
  /** Attached customer for this sale (Batch R); null = walk-in. */
  saleCustomer?: SaleCustomer | null;
  /** Open Select Customer (F8). */
  onSelectCustomer?: () => void;
  /**
   * Proceed / F10 path: redeem loyalty when customer attached,
   * else Payment - Select Method (Batch V). Cash → W; Card → AB; MFS → AD.
   */
  onProceed?: () => void;
  /** Hold / park active cart (Batch AN · F6). */
  onHold?: () => void;
  /** Open Held Sales list (Batch AN). */
  onOpenHeld?: () => void;
  /** Current held count on this terminal (0–3). */
  heldCount?: number;
  /** Cart line list / empty state — filled by POS batches. */
  children?: ReactNode;
};

/**
 * Right Active Cart frame — ~40/60 with search (flex).
 * Totals + Proceed; Payment Select Method opens from F10 / Proceed.
 * Teal accents (chrome lock) — ignore purple from denser mock.
 */
export function CartPanel({
  itemCount = 0,
  subtotal = 0,
  loyaltyDiscount = 0,
  onClearSale,
  saleCustomer = null,
  onSelectCustomer,
  onProceed,
  onHold,
  onOpenHeld,
  heldCount = 0,
  children,
}: CartPanelProps) {
  const { t } = useLocale();
  const itemWord = itemCount === 1 ? t("cart.item") : t("cart.items");
  const itemLabel = `${itemCount} ${itemWord}`;
  const hasItems = itemCount > 0;
  const discount = 0;
  const loyalty = Math.max(0, loyaltyDiscount);
  const total = Math.max(0, subtotal - discount - loyalty);
  const customerLabel = saleCustomer?.name ?? t("cart.walkInCustomer");
  /** Snapshot minus points already redeemed on this sale (1 pt = ৳1). */
  const displayLoyaltyPoints = saleCustomer
    ? Math.max(0, saleCustomer.loyaltyPoints - Math.trunc(loyalty))
    : 0;

  return (
    <aside
      className="flex min-w-0 flex-[3] flex-col border-l border-border bg-surface"
      aria-label={t("cart.activeCart")}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 className="text-sm font-bold tracking-wide text-foreground uppercase">
            {t("cart.activeCart")}
          </h2>
          <span className="text-[11px] font-semibold tracking-wide text-muted uppercase">
            · {itemLabel}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onOpenHeld ? (
            <button
              type="button"
              onClick={onOpenHeld}
              className={[
                "inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                heldCount > 0
                  ? "bg-primary/10 text-primary hover:bg-primary/15"
                  : "text-muted hover:bg-shell hover:text-foreground",
              ].join(" ")}
              aria-label={`${t("hold.badge")
                .replaceAll("{count}", String(heldCount))
                .replaceAll("{max}", String(MAX_HELD_SALES))} [F7]`}
              title={`${t("hold.title")} [F7]`}
            >
              {t("hold.badge")
                .replaceAll("{count}", String(heldCount))
                .replaceAll("{max}", String(MAX_HELD_SALES))}{" "}
              [F7]
            </button>
          ) : null}
          {hasItems && onHold ? (
            <button
              type="button"
              onClick={onHold}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <Pause className="size-3.5" strokeWidth={2} aria-hidden />
              {t("hold.action")} [F6]
            </button>
          ) : null}
          {hasItems && onClearSale ? (
            <button
              type="button"
              onClick={onClearSale}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
            >
              <Trash2 className="size-3.5" strokeWidth={2} aria-hidden />
              {t("cart.clearSale")}
            </button>
          ) : null}
        </div>
      </div>

      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-canvas px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <UserRound
              className={[
                "size-4 shrink-0",
                saleCustomer ? "text-primary" : "text-muted",
              ].join(" ")}
              strokeWidth={1.75}
            />
            <div className="min-w-0">
              <span className="block truncate text-sm font-medium text-foreground">
                {customerLabel}
              </span>
              {saleCustomer ? (
                <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-semibold tracking-wide text-primary uppercase">
                  <Target className="size-2.5" strokeWidth={2} aria-hidden />
                  {displayLoyaltyPoints} {t("cart.pts")}
                </span>
              ) : null}
            </div>
          </div>
          {onSelectCustomer ? (
            <button
              type="button"
              className="shrink-0 text-xs font-semibold text-primary hover:underline"
              onClick={onSelectCustomer}
            >
              {saleCustomer
                ? `${t("cart.change")} [F8]`
                : `+ ${t("cart.add")} [F8]`}
            </button>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-3 py-3">{children}</div>

      <div className="mt-auto space-y-3 border-t border-border px-4 py-4">
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between text-muted">
            <dt>{t("cart.subtotal")}</dt>
            <dd className="tabular-nums text-foreground">{formatTaka(subtotal)}</dd>
          </div>
          <div className="flex justify-between text-muted">
            <dt>{t("cart.discount")}</dt>
            <dd className="tabular-nums text-foreground">{formatTaka(discount)}</dd>
          </div>
          <div className="flex justify-between text-muted">
            <dt>{t("cart.loyalty")}</dt>
            <dd
              className={[
                "tabular-nums",
                loyalty > 0 ? "font-semibold text-primary" : "text-foreground",
              ].join(" ")}
            >
              {loyalty > 0 ? `−${formatTaka(loyalty)}` : formatTaka(0)}
            </dd>
          </div>
          <div className="flex justify-between border-t border-border pt-2">
            <dt className="text-sm font-semibold text-foreground uppercase">
              {t("cart.total")}
            </dt>
            <dd className="text-lg font-bold tabular-nums text-accent">
              {formatTaka(total)}
            </dd>
          </div>
        </dl>

        {hasItems ? (
          <button
            type="button"
            onClick={onProceed}
            disabled={!onProceed}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
            title={t("cart.proceedTitle")}
          >
            <CreditCard className="size-4" strokeWidth={1.75} />
            {t("cart.proceedToPayment")} [F10]
          </button>
        ) : (
          <button
            type="button"
            disabled
            className="flex w-full items-center justify-center gap-2 rounded-md bg-shell px-3 py-2.5 text-sm font-semibold text-muted"
            title={t("cart.addItemsBeforePayment")}
          >
            <CreditCard className="size-4" strokeWidth={1.75} />
            {t("cart.proceedToPayment")}
          </button>
        )}
      </div>
    </aside>
  );
}
