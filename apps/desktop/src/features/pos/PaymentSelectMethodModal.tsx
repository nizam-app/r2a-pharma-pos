import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  Banknote,
  CreditCard,
  Smartphone,
  UserRound,
  X,
} from "lucide-react";
import { useLocale, type MessageKey } from "@/i18n";
import {
  formatCustomerPhone,
  type SaleCustomer,
} from "@/lib/customerSearch";
import { formatTaka } from "@/lib/format";

export type PaymentMethodId = "CASH" | "CARD" | "MFS";

export type PaymentSelectMethodModalProps = {
  amountDue: number;
  /** Null = walk-in — hide customer + points row. */
  customer: SaleCustomer | null;
  onClose: () => void;
  /** Cash selected → open Cash Payment (Batch W). */
  onSelectCash: () => void;
  /** Card selected → open Card Payment stub (Batch AB). */
  onSelectCard: () => void;
  /** MFS selected → open MFS provider flow (Batch AD). */
  onSelectMfs: () => void;
};

const METHODS: {
  id: PaymentMethodId;
  labelKey: MessageKey;
  descKey: MessageKey;
  Icon: typeof Banknote;
}[] = [
  {
    id: "CASH",
    labelKey: "payment.methodCash",
    descKey: "payment.methodCashDesc",
    Icon: Banknote,
  },
  {
    id: "CARD",
    labelKey: "payment.methodCard",
    descKey: "payment.methodCardDesc",
    Icon: CreditCard,
  },
  {
    id: "MFS",
    labelKey: "payment.methodMfs",
    descKey: "payment.methodMfsDesc",
    Icon: Smartphone,
  },
];

/**
 * Payment - Select Method (Batch V + AB + AD).
 * Single tender only. Cash → W · Card → AB/AC · MFS → AD.
 * Chrome = Search Results - Napa. ←→ navigate · Tab never a POS navigator.
 */
export function PaymentSelectMethodModal({
  amountDue,
  customer,
  onClose,
  onSelectCash,
  onSelectCard,
  onSelectMfs,
}: PaymentSelectMethodModalProps) {
  const { t } = useLocale();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const methodRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const backRef = useRef<HTMLButtonElement>(null);
  const selectRef = useRef<HTMLButtonElement>(null);
  const [selected, setSelected] = useState<PaymentMethodId>("CASH");

  useEffect(() => {
    dialogRef.current?.focus();
    queueMicrotask(() => methodRefs.current[0]?.focus());
  }, []);

  const confirmSelection = useCallback(() => {
    if (selected === "CASH") {
      onSelectCash();
      return;
    }
    if (selected === "CARD") {
      onSelectCard();
      return;
    }
    onSelectMfs();
  }, [selected, onSelectCash, onSelectCard, onSelectMfs]);

  const focusMethod = (index: number) => {
    const clamped = (index + METHODS.length) % METHODS.length;
    const method = METHODS[clamped];
    if (!method) return;
    setSelected(method.id);
    methodRefs.current[clamped]?.focus();
  };

  const focusFooterRelative = (delta: number) => {
    const buttons = [backRef.current, selectRef.current].filter(
      (b): b is HTMLButtonElement => b != null && !b.disabled,
    );
    if (buttons.length === 0) return;
    const active = document.activeElement;
    let idx = buttons.indexOf(active as HTMLButtonElement);
    if (idx < 0) idx = delta > 0 ? -1 : 0;
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

    const active = document.activeElement;
    const methodIdx = methodRefs.current.findIndex((el) => el === active);
    const onMethod = methodIdx >= 0;
    const onFooter =
      active === backRef.current || active === selectRef.current;

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      event.stopPropagation();
      const delta = event.key === "ArrowLeft" ? -1 : 1;
      if (onFooter) {
        focusFooterRelative(delta);
        return;
      }
      const from = onMethod
        ? methodIdx
        : METHODS.findIndex((m) => m.id === selected);
      focusMethod((from < 0 ? 0 : from) + delta);
      return;
    }

    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();
      if (onFooter && event.key === "ArrowUp") {
        const from = METHODS.findIndex((m) => m.id === selected);
        focusMethod(from < 0 ? 0 : from);
        return;
      }
      if (onMethod && event.key === "ArrowDown") {
        selectRef.current?.focus();
        return;
      }
      return;
    }

    if (event.key === "Enter") {
      if (
        active instanceof HTMLButtonElement &&
        dialogRef.current?.contains(active)
      ) {
        // Native button activation (method card / Back / Select Method).
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      confirmSelection();
    }
  };

  const phoneLabel = customer
    ? formatCustomerPhone(customer.phone)
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[1px]"
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
        className="flex w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-xl outline-none"
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
          <div className="flex items-start justify-between gap-3 pr-10">
            <div>
              <h2
                id={titleId}
                className="text-xl font-bold tracking-tight text-foreground"
              >
                {t("payment.title")}
              </h2>
              <p className="mt-0.5 text-sm text-muted">
                {t("payment.selectSubtitle")}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[10px] font-bold tracking-wide text-muted uppercase">
                {t("payment.amountDue")}
              </p>
              <p className="mt-0.5 text-2xl font-bold tabular-nums text-accent">
                {formatTaka(amountDue)}
              </p>
            </div>
          </div>
        </div>

        {customer ? (
          <div className="flex items-center gap-2 border-b border-border bg-shell/80 px-5 py-2.5 text-sm text-foreground">
            <UserRound
              className="size-4 shrink-0 text-primary"
              strokeWidth={1.75}
              aria-hidden
            />
            <p className="min-w-0 truncate font-semibold">
              <span>{customer.name}</span>
              {phoneLabel ? (
                <>
                  <span className="mx-1.5 text-muted" aria-hidden>
                    •
                  </span>
                  <span className="tabular-nums font-medium text-muted">
                    {phoneLabel}
                  </span>
                </>
              ) : null}
              <span className="mx-1.5 text-muted" aria-hidden>
                •
              </span>
              <span className="tabular-nums font-bold text-primary">
                {customer.loyaltyPoints} {t("customer.points")}
              </span>
            </p>
          </div>
        ) : null}

        <div className="px-5 py-5">
          <div
            className="grid gap-3 sm:grid-cols-3"
            role="listbox"
            aria-label={t("payment.methodsAria")}
          >
            {METHODS.map((method, index) => {
              const isSelected = selected === method.id;
              const { Icon } = method;
              return (
                <button
                  key={method.id}
                  ref={(el) => {
                    methodRefs.current[index] = el;
                  }}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => setSelected(method.id)}
                  onFocus={() => setSelected(method.id)}
                  className={[
                    "flex flex-col items-center gap-2 rounded-xl border-2 px-3 py-6 text-center transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    isSelected
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border bg-surface hover:border-primary/40 hover:bg-shell/60",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "inline-flex size-12 items-center justify-center rounded-full",
                      isSelected
                        ? "bg-primary/15 text-primary"
                        : "bg-shell text-muted",
                    ].join(" ")}
                    aria-hidden
                  >
                    <Icon className="size-6" strokeWidth={1.75} />
                  </span>
                  <span className="text-base font-bold text-foreground">
                    {t(method.labelKey)}
                  </span>
                  <span className="text-xs text-muted">{t(method.descKey)}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* OG layout: buttons row, then black shortcut bar (←→ not Tab). */}
        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-4">
          <button
            ref={backRef}
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md border border-foreground/80 bg-surface px-5 py-2.5 text-sm font-semibold whitespace-nowrap text-foreground hover:bg-shell focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {t("payment.backToSale")}
          </button>
          <button
            ref={selectRef}
            type="button"
            onClick={confirmSelection}
            className="min-w-[12rem] rounded-md bg-primary px-6 py-2.5 text-sm font-bold whitespace-nowrap text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {t("payment.selectMethodEnter")}
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-border bg-shell px-5 py-2.5 text-xs text-muted">
          <span>
            <kbd className="font-medium text-foreground">[Enter]</kbd>{" "}
            {t("payment.selectMethod")}
          </span>
          <span className="text-sm font-semibold text-foreground/55" aria-hidden>
            ›
          </span>
          <span>
            <kbd className="font-medium text-foreground">[Esc]</kbd>{" "}
            {t("payment.backToSale")}
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
