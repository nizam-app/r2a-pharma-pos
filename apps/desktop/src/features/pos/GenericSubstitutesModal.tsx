import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  AlertTriangle,
  Check,
  Pill,
  RefreshCw,
  X,
} from "lucide-react";
import { useLocale } from "@/i18n";
import { useConnectivity } from "@/features/shell";
import { useAuth } from "@/features/auth";
import { formatTaka } from "@/lib/format";
import {
  formatExpiryShortMonth,
  type PosSearchResult,
} from "@/lib/productSearch";
import {
  fetchProductSubstitutes,
  substituteToSearchResult,
  type PosSubstituteItem,
  type SubstituteSourceProduct,
} from "@/lib/substitutes";

export type GenericSubstitutesModalProps = {
  source: SubstituteSourceProduct;
  onClose: () => void;
  /** Sellable substitute → existing Select Batch → Qty path. */
  onSelect: (product: PosSearchResult) => void;
};

type LoadIssue = "offline" | "failed" | null;

/**
 * Generic Substitutes [F4] — Batch AG (invented).
 * ↑↓ navigate · Enter select sellable · Esc close · no Tab · no Baki.
 * Chrome stays Search Results - Napa (modal content only).
 */
export function GenericSubstitutesModal({
  source,
  onClose,
  onSelect,
}: GenericSubstitutesModalProps) {
  const { t } = useLocale();
  const { isOnline } = useConnectivity();
  const { user } = useAuth();
  const titleId = useId();
  const listId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  const [rows, setRows] = useState<PosSubstituteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [loadIssue, setLoadIssue] = useState<LoadIssue>(null);

  const load = useCallback(async () => {
    if (!isOnline) {
      setRows([]);
      setLoading(false);
      setLoadIssue("offline");
      setFocusedIndex(0);
      return;
    }

    setLoading(true);
    setLoadIssue(null);
    try {
      const list = await fetchProductSubstitutes(source.productId, {
        storeId: user?.storeId,
      });
      setRows(list);
      const firstSelectable = list.findIndex((r) => r.selectable);
      setFocusedIndex(firstSelectable >= 0 ? firstSelectable : 0);
      setLoadIssue(null);
    } catch {
      setRows([]);
      setLoadIssue("failed");
      setFocusedIndex(0);
    } finally {
      setLoading(false);
    }
  }, [isOnline, source.productId, user?.storeId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const selectFocused = useCallback(() => {
    const row = rows[focusedIndex];
    if (!row || !row.selectable) return;
    onSelect(substituteToSearchResult(row));
  }, [rows, focusedIndex, onSelect]);

  const moveFocus = useCallback(
    (delta: number) => {
      if (rows.length === 0) return;
      setFocusedIndex((i) => (i + delta + rows.length) % rows.length);
    },
    [rows.length],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
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
      selectFocused();
    }
  };

  const genericLabel = source.genericName?.trim() || null;
  const emptyHint = loading
    ? t("substitutes.loading")
    : loadIssue === "offline"
      ? t("substitutes.offline")
      : loadIssue === "failed"
        ? t("substitutes.failed")
        : t("substitutes.empty");

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
        onKeyDownCapture={onKeyDown}
        className="flex w-full max-w-xl flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-xl outline-none"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <RefreshCw
                className="size-5 shrink-0 text-primary"
                strokeWidth={1.75}
                aria-hidden
              />
              <h2
                id={titleId}
                className="text-base font-bold tracking-tight text-foreground"
              >
                {t("substitutes.title")}
              </h2>
            </div>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {source.name}
            </p>
            {genericLabel ? (
              <p className="mt-0.5 text-xs text-muted italic">{genericLabel}</p>
            ) : (
              <p className="mt-0.5 text-xs text-muted">
                {t("substitutes.noGeneric")}
              </p>
            )}
            <p className="mt-1.5 text-xs text-muted">
              {t("substitutes.subtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted hover:bg-canvas hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label={t("substitutes.close")}
          >
            <X className="size-4" strokeWidth={2} aria-hidden />
          </button>
        </div>

        <div className="min-h-52 px-3 py-2">
          {rows.length === 0 ? (
            <p className="px-2 py-10 text-center text-sm text-muted">
              {emptyHint}
            </p>
          ) : (
            <ul
              id={listId}
              role="listbox"
              aria-label={t("substitutes.resultsAria")}
              className="flex max-h-72 flex-col gap-1.5 overflow-y-auto py-1"
            >
              {rows.map((row, index) => {
                const selected = index === focusedIndex;
                const blocked = !row.selectable;
                const price =
                  row.nearestSellPerBase != null
                    ? formatTaka(row.nearestSellPerBase)
                    : "—";
                const expiry = row.nearestExpiryDate
                  ? formatExpiryShortMonth(row.nearestExpiryDate)
                  : null;

                return (
                  <li
                    key={row.id}
                    role="option"
                    aria-selected={selected}
                    aria-disabled={blocked}
                  >
                    <button
                      type="button"
                      disabled={blocked}
                      onMouseEnter={() => setFocusedIndex(index)}
                      onClick={() => {
                        if (!blocked) {
                          onSelect(substituteToSearchResult(row));
                        }
                      }}
                      className={[
                        "relative flex w-full items-start gap-3 rounded-md border px-3 py-2.5 text-left transition-colors",
                        blocked
                          ? "cursor-not-allowed border-border bg-shell/60 opacity-80"
                          : selected
                            ? "border-primary/50 bg-primary/5 shadow-sm ring-1 ring-primary/20"
                            : "border-border hover:border-primary/30 hover:bg-shell/40",
                      ].join(" ")}
                    >
                      {selected && !blocked ? (
                        <span
                          className="absolute top-0 bottom-0 left-0 w-1 rounded-l-md bg-primary"
                          aria-hidden
                        />
                      ) : null}
                      <span
                        className={[
                          "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md",
                          selected && !blocked
                            ? "bg-primary text-primary-foreground"
                            : "bg-shell text-muted",
                        ].join(" ")}
                      >
                        <Pill
                          className="size-4"
                          strokeWidth={1.75}
                          aria-hidden
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">
                            {row.name}
                          </span>
                          {row.isExpired ? (
                            <span className="rounded bg-destructive px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase">
                              {t("pos.expired")}
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span
                            className={[
                              "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
                              row.inStock && !row.isExpired
                                ? "border-expiry-ok/40 text-expiry-ok"
                                : "border-destructive/40 text-destructive",
                            ].join(" ")}
                          >
                            {row.inStock && !row.isExpired ? (
                              <Check
                                className="size-3"
                                strokeWidth={2.5}
                                aria-hidden
                              />
                            ) : (
                              <AlertTriangle
                                className="size-3"
                                aria-hidden
                              />
                            )}
                            {t("pos.stock")} {row.availableQuantityBase}{" "}
                            {t("pos.pc")}
                          </span>
                          {expiry ? (
                            <span className="inline-flex items-center rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted">
                              {t("pos.exp")} {expiry}
                            </span>
                          ) : null}
                        </span>
                        {selected && !blocked ? (
                          <span className="mt-1.5 block text-[11px] font-medium text-primary">
                            ⏎ {t("substitutes.enterToSelect")}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-bold tabular-nums text-foreground">
                          {price}
                        </span>
                        <span className="text-[11px] text-muted">
                          {t("pos.perPc")}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-border bg-shell/60 px-5 py-2.5 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 font-medium text-foreground">
              ↑
            </kbd>
            <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 font-medium text-foreground">
              ↓
            </kbd>
            <span>{t("substitutes.navigate")}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 font-medium text-foreground">
              Enter
            </kbd>
            <span>{t("substitutes.select")}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 font-medium text-foreground">
              Esc
            </kbd>
            <span>{t("substitutes.dismiss")}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
