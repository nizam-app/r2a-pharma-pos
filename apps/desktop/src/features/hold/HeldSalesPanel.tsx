import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Pause, X } from "lucide-react";
import { ConfirmDialog } from "@/features/pos";
import { useAuth } from "@/features/auth";
import { useLocale } from "@/i18n";
import { formatTaka } from "@/lib/format";
import {
  formatHeldSaleAt,
  heldSaleStore,
  MAX_HELD_SALES,
  type HeldSaleSnapshot,
} from "@/lib/heldSaleStore";

export type HeldSalesPanelProps = {
  onClose: () => void;
  /** True when the active cart has ≥1 line — resume toasts instead of swapping. */
  cartHasItems: boolean;
  onResume: (snapshot: HeldSaleSnapshot) => void | Promise<void>;
  /** After discard so chrome Held n/3 can refresh. */
  onListChanged?: () => void;
};

type RowAction = "resume" | "discard";

function snapshotTotal(snapshot: HeldSaleSnapshot): number {
  return snapshot.lines.reduce((sum, line) => sum + line.lineTotal, 0);
}

/**
 * Held Sales list (M3 Batch AN invent + AO resume recheck).
 * Teal Napa chrome. Soft hold — stock is not reserved; resume rechecks qty/expiry.
 * ↑/↓ rows · ←/→ Resume / Discard · Enter activate · Esc close · no Tab · no Baki.
 */
export function HeldSalesPanel({
  onClose,
  cartHasItems,
  onResume,
  onListChanged,
}: HeldSalesPanelProps) {
  const { t } = useLocale();
  const { user } = useAuth();
  const titleId = useId();
  const listId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  const [rows, setRows] = useState<HeldSaleSnapshot[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [rowAction, setRowAction] = useState<RowAction>("resume");
  const [pendingDiscard, setPendingDiscard] =
    useState<HeldSaleSnapshot | null>(null);
  const [resumeBusy, setResumeBusy] = useState(false);

  const reload = useCallback(() => {
    if (!user?.tenantId) {
      setRows([]);
      return;
    }
    setRows(heldSaleStore.list(user.tenantId, user.storeId ?? null));
  }, [user?.tenantId, user?.storeId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (pendingDiscard) return;
    panelRef.current?.focus();
  }, [pendingDiscard]);

  useEffect(() => {
    if (rows.length === 0) {
      setFocusedIndex(0);
      setRowAction("resume");
      return;
    }
    setFocusedIndex((i) => Math.min(Math.max(0, i), rows.length - 1));
  }, [rows.length]);

  const focused = rows[focusedIndex] ?? null;

  const moveFocus = useCallback(
    (delta: number) => {
      if (rows.length === 0) return;
      setFocusedIndex((i) => (i + delta + rows.length) % rows.length);
      setRowAction("resume");
    },
    [rows.length],
  );

  const requestDiscard = useCallback((snapshot: HeldSaleSnapshot) => {
    setPendingDiscard(snapshot);
  }, []);

  const confirmDiscard = useCallback(() => {
    if (!user?.tenantId || !pendingDiscard) return;
    heldSaleStore.remove(
      user.tenantId,
      user.storeId ?? null,
      pendingDiscard.id,
    );
    setPendingDiscard(null);
    reload();
    onListChanged?.();
    queueMicrotask(() => panelRef.current?.focus());
  }, [user?.tenantId, user?.storeId, pendingDiscard, reload, onListChanged]);

  const runResume = useCallback(
    (snapshot: HeldSaleSnapshot) => {
      if (resumeBusy) return;
      setResumeBusy(true);
      void Promise.resolve(onResume(snapshot)).finally(() => {
        setResumeBusy(false);
      });
    },
    [onResume, resumeBusy],
  );

  const activateFocused = useCallback(() => {
    if (!focused || resumeBusy) return;
    if (rowAction === "discard") {
      requestDiscard(focused);
      return;
    }
    runResume(focused);
  }, [focused, rowAction, resumeBusy, runResume, requestDiscard]);

  const onKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
    if (pendingDiscard) {
      // ConfirmDialog owns Esc / ←→ / Enter.
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (resumeBusy) {
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

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      event.stopPropagation();
      if (rows.length === 0) return;
      setRowAction((a) => (a === "resume" ? "discard" : "resume"));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      activateFocused();
    }
  };

  const discardTotal = pendingDiscard ? snapshotTotal(pendingDiscard) : 0;

  return (
    <div
      ref={panelRef}
      className="absolute inset-0 z-40 flex flex-col bg-surface"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-busy={resumeBusy}
      tabIndex={-1}
      onKeyDownCapture={onKeyDownCapture}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Pause
            className="size-5 shrink-0 text-primary"
            strokeWidth={1.75}
            aria-hidden
          />
          <div className="min-w-0">
            <h2
              id={titleId}
              className="truncate text-sm font-semibold text-foreground"
            >
              {t("hold.title")}
            </h2>
            <p className="truncate text-xs text-muted">
              {t("hold.subtitle")
                .replaceAll("{count}", String(rows.length))
                .replaceAll("{max}", String(MAX_HELD_SALES))}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="inline-flex size-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-shell hover:text-foreground"
          aria-label={t("hold.close")}
          onClick={onClose}
        >
          <X className="size-4" strokeWidth={1.75} aria-hidden />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-border bg-shell/60 px-4 py-2">
          <div className="grid grid-cols-[7.5rem_minmax(0,1.4fr)_4.5rem_5.5rem_minmax(9rem,auto)] gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
            <span>{t("hold.colTime")}</span>
            <span>{t("hold.colSale")}</span>
            <span className="text-right">{t("hold.colLines")}</span>
            <span className="text-right">{t("hold.colTotal")}</span>
            <span className="sr-only">{t("hold.actions")}</span>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center">
            <Pause
              className="size-12 text-border"
              strokeWidth={1.25}
              aria-hidden
            />
            <p className="text-sm font-medium text-foreground">
              {t("hold.empty")}
            </p>
            <p className="max-w-sm text-xs text-muted">
              {t("hold.emptyHint").replaceAll("{max}", String(MAX_HELD_SALES))}
            </p>
          </div>
        ) : (
          <ul
            id={listId}
            role="listbox"
            aria-label={t("hold.listLabel")}
            className="min-h-0 flex-1 overflow-auto"
          >
            {rows.map((entry, index) => {
              const active = index === focusedIndex;
              const total = snapshotTotal(entry);
              const lineCount = entry.lines.length;
              const customerHint = entry.customer?.name?.trim()
                ? entry.customer.name
                : t("cart.walkInCustomer");
              return (
                <li key={entry.id}>
                  <div
                    role="option"
                    aria-selected={active}
                    className={[
                      "grid w-full grid-cols-[7.5rem_minmax(0,1.4fr)_4.5rem_5.5rem_minmax(9rem,auto)] items-center gap-2 border-b border-border px-4 py-2.5 text-sm",
                      active ? "bg-primary/10 text-foreground" : "hover:bg-shell/80",
                    ].join(" ")}
                    onMouseEnter={() => {
                      setFocusedIndex(index);
                      if (!active) setRowAction("resume");
                    }}
                    onClick={() => setFocusedIndex(index)}
                  >
                    <span className="truncate font-mono text-xs text-muted">
                      {formatHeldSaleAt(entry.heldAt)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">
                        {entry.label}
                      </p>
                      <p className="truncate text-[11px] text-muted">
                        {customerHint}
                        {entry.loyalty
                          ? ` · ${t("hold.loyaltyApplied")}`
                          : ""}
                      </p>
                    </div>
                    <span className="text-right tabular-nums text-muted">
                      {lineCount}
                    </span>
                    <span className="truncate text-right font-semibold tabular-nums text-foreground">
                      {formatTaka(total)}
                    </span>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <button
                        type="button"
                        disabled={resumeBusy}
                        className={[
                          "rounded-md px-2.5 py-1 text-xs font-semibold",
                          active && rowAction === "resume"
                            ? "bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/40"
                            : "border border-primary/40 bg-surface text-primary hover:bg-primary/5",
                          resumeBusy ? "cursor-not-allowed opacity-60" : "",
                        ].join(" ")}
                        onClick={(e) => {
                          e.stopPropagation();
                          setFocusedIndex(index);
                          setRowAction("resume");
                          runResume(entry);
                        }}
                      >
                        {t("hold.resume")}
                      </button>
                      <button
                        type="button"
                        disabled={resumeBusy}
                        className={[
                          "rounded-md px-2.5 py-1 text-xs font-semibold",
                          active && rowAction === "discard"
                            ? "bg-destructive text-white shadow-sm ring-2 ring-destructive/40"
                            : "border border-destructive/30 bg-surface text-destructive hover:bg-destructive/10",
                          resumeBusy ? "cursor-not-allowed opacity-60" : "",
                        ].join(" ")}
                        onClick={(e) => {
                          e.stopPropagation();
                          setFocusedIndex(index);
                          setRowAction("discard");
                          requestDiscard(entry);
                        }}
                      >
                        {t("hold.discard")}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <footer className="shrink-0 border-t border-border bg-shell/40 px-4 py-2 text-[11px] text-muted">
        {resumeBusy
          ? t("hold.rechecking")
          : rows.length === 0
            ? t("hold.footerEmpty")
            : cartHasItems
              ? t("hold.footerBusyCart")
              : t("hold.footer")}
      </footer>

      {pendingDiscard ? (
        <ConfirmDialog
          title={t("hold.discardTitle")}
          description={t("hold.discardBody")}
          detailCard={{
            title: pendingDiscard.label,
            subtitle: pendingDiscard.customer?.name?.trim()
              ? pendingDiscard.customer.name
              : t("cart.walkInCustomer"),
            highlight: formatTaka(discardTotal),
            fields: [
              {
                label: t("hold.colTime"),
                value: formatHeldSaleAt(pendingDiscard.heldAt),
              },
              {
                label: t("hold.colLines"),
                value: String(pendingDiscard.lines.length),
              },
              {
                label: t("hold.colTotal"),
                value: formatTaka(discardTotal),
              },
            ],
          }}
          warning={t("hold.discardWarn")}
          confirmLabel={t("hold.discard")}
          cancelLabel={t("hold.keepHeld")}
          escHint={t("hold.keepHeld")}
          destructive
          onConfirm={confirmDiscard}
          onCancel={() => {
            setPendingDiscard(null);
            queueMicrotask(() => panelRef.current?.focus());
          }}
        />
      ) : null}
    </div>
  );
}
