import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { ChevronRight, LayoutList, Receipt, X } from "lucide-react";
import { useAuth } from "@/features/auth";
import { TransactionDetailView } from "@/features/transactions/TransactionDetailView";
import { useLocale } from "@/i18n";
import { formatCustomerPhone } from "@/lib/customerSearch";
import { formatTaka } from "@/lib/format";
import {
  formatTransactionListTime,
  transactionLogStore,
  type LoggedTransaction,
  type TransactionPaymentMethod,
} from "@/lib/transactionLogStore";

export type TransactionsPanelProps = {
  onClose: () => void;
};

type PanelView = "list" | "detail";

/**
 * Transactions — List (AJ) + Detail / Reprint (AK).
 * Local completed-sale log (no cloud GET /sales yet — TODO).
 * List: ↑/↓ · Enter → detail · Esc close.
 * Detail: items / totals / method / customer / loyalty + Receipt Preview;
 * Reprint → print stub. Esc / Back → list. No Tab. No Baki. No Shift.
 */
export function TransactionsPanel({ onClose }: TransactionsPanelProps) {
  const { t } = useLocale();
  const { user } = useAuth();
  const titleId = useId();
  const listId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  const [rows, setRows] = useState<LoggedTransaction[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [view, setView] = useState<PanelView>("list");
  const [selected, setSelected] = useState<LoggedTransaction | null>(null);

  const reload = useCallback(() => {
    if (!user?.tenantId) {
      setRows([]);
      return;
    }
    setRows(transactionLogStore.list(user.tenantId, user.storeId ?? null));
  }, [user?.tenantId, user?.storeId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (view === "list") {
      panelRef.current?.focus();
    }
  }, [view]);

  useEffect(() => {
    if (rows.length === 0) {
      setFocusedIndex(0);
      return;
    }
    setFocusedIndex((i) => Math.min(Math.max(0, i), rows.length - 1));
  }, [rows.length]);

  const openDetail = useCallback((entry: LoggedTransaction) => {
    setSelected(entry);
    setView("detail");
  }, []);

  const backToList = useCallback(() => {
    setView("list");
    setSelected(null);
    queueMicrotask(() => panelRef.current?.focus());
  }, []);

  const moveFocus = useCallback(
    (delta: number) => {
      if (rows.length === 0) return;
      setFocusedIndex((i) => (i + delta + rows.length) % rows.length);
    },
    [rows.length],
  );

  const methodLabel = useCallback(
    (method: TransactionPaymentMethod, entry?: LoggedTransaction) => {
      switch (method) {
        case "CARD":
          return t("completed.card");
        case "MFS":
          return entry?.mfsSettlement?.providerLabel?.trim() || t("completed.mfs");
        case "LOYALTY":
          return t("txns.methodLoyalty");
        case "CASH":
        default:
          return t("completed.cash");
      }
    },
    [t],
  );

  const customerLabel = useCallback(
    (entry: LoggedTransaction) => {
      if (!entry.customer) return t("cart.walkInCustomer");
      const phone = formatCustomerPhone(entry.customer.phone);
      return phone
        ? `${entry.customer.name} · ${phone}`
        : entry.customer.name;
    },
    [t],
  );

  const focused = rows[focusedIndex] ?? null;

  const emptyHint = useMemo(() => t("txns.emptyHint"), [t]);

  const onKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (view === "detail") {
        backToList();
        return;
      }
      onClose();
      return;
    }

    if (view === "detail") {
      // Detail owns ←/→ CTA nav; Esc handled above.
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();
      moveFocus(1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      moveFocus(-1);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      if (focused) openDetail(focused);
    }
  };

  return (
    <div
      ref={panelRef}
      className="absolute inset-0 z-40 flex flex-col bg-surface"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      onKeyDownCapture={onKeyDownCapture}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <LayoutList
            className="size-5 shrink-0 text-primary"
            strokeWidth={1.75}
            aria-hidden
          />
          <div className="min-w-0">
            <h2
              id={titleId}
              className="truncate text-sm font-semibold text-foreground"
            >
              {view === "detail"
                ? t("txns.detailTitle")
                : t("txns.title")}
            </h2>
            <p className="truncate text-xs text-muted">
              {view === "detail"
                ? t("txns.detailSubtitle")
                : t("txns.subtitle")}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="inline-flex size-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-shell hover:text-foreground"
          aria-label={t("txns.close")}
          onClick={onClose}
        >
          <X className="size-4" strokeWidth={1.75} aria-hidden />
        </button>
      </header>

      {view === "list" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 border-b border-border bg-shell/60 px-4 py-2">
            <div className="grid grid-cols-[7.5rem_minmax(0,1.1fr)_minmax(0,1.4fr)_5.5rem_5.5rem_1.5rem] gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
              <span>{t("txns.colTime")}</span>
              <span>{t("txns.colTxn")}</span>
              <span>{t("txns.colCustomer")}</span>
              <span>{t("txns.colMethod")}</span>
              <span className="text-right">{t("txns.colTotal")}</span>
              <span className="sr-only">{t("txns.openDetail")}</span>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center">
              <Receipt
                className="size-12 text-border"
                strokeWidth={1.25}
                aria-hidden
              />
              <p className="text-sm font-medium text-foreground">
                {t("txns.empty")}
              </p>
              <p className="max-w-sm text-xs text-muted">{emptyHint}</p>
            </div>
          ) : (
            <ul
              id={listId}
              role="listbox"
              aria-label={t("txns.listLabel")}
              className="min-h-0 flex-1 overflow-auto"
            >
              {rows.map((entry, index) => {
                const active = index === focusedIndex;
                return (
                  <li key={`${entry.saleId}-${entry.eventId}-${entry.txnLabel}`}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={[
                        "grid w-full grid-cols-[7.5rem_minmax(0,1.1fr)_minmax(0,1.4fr)_5.5rem_5.5rem_1.5rem] items-center gap-2 border-b border-border px-4 py-2.5 text-left text-sm transition-colors",
                        active
                          ? "bg-primary/10 text-foreground"
                          : "hover:bg-shell/80",
                      ].join(" ")}
                      onClick={() => {
                        setFocusedIndex(index);
                        openDetail(entry);
                      }}
                      onMouseEnter={() => setFocusedIndex(index)}
                    >
                      <span className="truncate font-mono text-xs text-muted">
                        {formatTransactionListTime(entry.completedAt)}
                      </span>
                      <span className="truncate font-semibold text-foreground">
                        {entry.txnLabel}
                      </span>
                      <span className="truncate text-muted">
                        {customerLabel(entry)}
                      </span>
                      <span className="truncate text-xs font-medium text-foreground">
                        {methodLabel(entry.paymentMethod, entry)}
                      </span>
                      <span className="truncate text-right font-semibold tabular-nums text-foreground">
                        {formatTaka(entry.total)}
                      </span>
                      <ChevronRight
                        className={[
                          "size-4 justify-self-end",
                          active ? "text-primary" : "text-border",
                        ].join(" ")}
                        strokeWidth={1.75}
                        aria-hidden
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <footer className="shrink-0 border-t border-border bg-shell/40 px-4 py-2 text-[11px] text-muted">
            {t("txns.listFooter")}
          </footer>
        </div>
      ) : selected && user?.tenantId ? (
        <>
          <TransactionDetailView
            entry={selected}
            tenantId={user.tenantId}
            storeId={user.storeId ?? null}
            onBack={backToList}
          />
          <footer className="shrink-0 border-t border-border bg-shell/40 px-4 py-2 text-[11px] text-muted">
            {t("txns.detailFooter")}
          </footer>
        </>
      ) : null}
    </div>
  );
}
