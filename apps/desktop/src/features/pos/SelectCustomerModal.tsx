import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  Footprints,
  Search,
  Target,
  UserRound,
  X,
} from "lucide-react";
import { useLocale } from "@/i18n";
import { useConnectivity } from "@/features/shell";
import {
  formatCustomerPhone,
  searchPosCustomers,
  type SaleCustomer,
} from "@/lib/customerSearch";

export type SelectCustomerModalProps = {
  onClose: () => void;
  /** Attach customer + points snapshot to the active sale. */
  onSelect: (customer: SaleCustomer) => void;
  /** Clear customer → walk-in. */
  onWalkIn: () => void;
};

type LoadIssue = "offline" | "failed" | null;

/**
 * Select Customer (F8) — Batch R (+ Slice 5 lock).
 * Search phone/name · Enter select · Esc close · Walk-in.
 * Create Customer is **not** on POS — Owner web only (deferred).
 * Chrome stays Search Results - Napa (modal content only).
 */
export function SelectCustomerModal({
  onClose,
  onSelect,
  onWalkIn,
}: SelectCustomerModalProps) {
  const { t } = useLocale();
  const { isOnline } = useConnectivity();
  const titleId = useId();
  const listId = useId();
  const searchId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const walkInRef = useRef<HTMLButtonElement>(null);

  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<SaleCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [loadIssue, setLoadIssue] = useState<LoadIssue>(null);

  useEffect(() => {
    dialogRef.current?.focus();
    queueMicrotask(() => {
      searchRef.current?.focus();
      searchRef.current?.select();
    });
  }, []);

  useEffect(() => {
    const needle = query.trim();
    if (!needle) {
      setRows([]);
      setLoading(false);
      setLoadIssue(null);
      setFocusedIndex(0);
      return;
    }

    if (!isOnline) {
      setRows([]);
      setLoading(false);
      setLoadIssue("offline");
      setFocusedIndex(0);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadIssue(null);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const list = await searchPosCustomers(needle, { online: true });
          if (cancelled) return;
          setRows(list);
          setFocusedIndex(0);
          setLoadIssue(null);
        } catch {
          if (cancelled) return;
          setRows([]);
          setLoadIssue("failed");
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, isOnline]);

  const selectFocused = useCallback(() => {
    const row = rows[focusedIndex];
    if (!row) return;
    onSelect(row);
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
      if (rows.length > 0) {
        moveFocus(1);
      } else {
        walkInRef.current?.focus();
      }
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      if (rows.length === 0) {
        searchRef.current?.focus();
        return;
      }
      if (focusedIndex <= 0) {
        searchRef.current?.focus();
        setFocusedIndex(0);
        return;
      }
      moveFocus(-1);
      return;
    }

    if (event.key === "Enter") {
      const active = document.activeElement;
      if (active === walkInRef.current) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (rows[focusedIndex]) {
        selectFocused();
      }
      return;
    }
  };

  const needle = query.trim();
  const emptyHint = !needle
    ? t("customer.typeToFind")
    : loading
      ? t("customer.searching")
      : loadIssue === "offline"
        ? t("customer.offlineSearch")
        : loadIssue === "failed"
          ? t("customer.searchFailed")
          : t("customer.noMatch");

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
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-xl outline-none"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="text-base font-bold tracking-tight text-foreground"
            >
              {t("customer.selectTitle")}
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              {t("customer.searchSubtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted hover:bg-canvas hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label={t("customer.close")}
          >
            <X className="size-4" strokeWidth={2} aria-hidden />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <label htmlFor={searchId} className="sr-only">
            {t("customer.searchAria")}
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
              strokeWidth={1.75}
              aria-hidden
            />
            <input
              ref={searchRef}
              id={searchId}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("customer.searchPlaceholder")}
              autoComplete="off"
              className="w-full rounded-md border border-border bg-canvas py-2.5 pr-3 pl-10 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div
            id={listId}
            role="listbox"
            aria-label={t("customer.resultsAria")}
            className="max-h-64 min-h-30 overflow-auto rounded-md border border-border"
          >
            {rows.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">
                {emptyHint}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {rows.map((row, index) => {
                  const selected = index === focusedIndex;
                  const phoneLabel = formatCustomerPhone(row.phone);
                  return (
                    <li key={row.customerId} role="option" aria-selected={selected}>
                      <button
                        type="button"
                        onMouseEnter={() => setFocusedIndex(index)}
                        onClick={() => onSelect(row)}
                        className={[
                          "flex w-full items-center gap-3 px-3 py-3 text-left transition-colors",
                          selected
                            ? "border-l-[3px] border-l-primary bg-primary/10"
                            : "border-l-[3px] border-l-transparent hover:bg-canvas",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "flex size-10 shrink-0 items-center justify-center rounded-md",
                            selected
                              ? "bg-primary text-primary-foreground"
                              : "bg-shell text-muted",
                          ].join(" ")}
                        >
                          <UserRound
                            className="size-5"
                            strokeWidth={1.75}
                            aria-hidden
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-foreground">
                            {row.name}
                          </span>
                          {phoneLabel ? (
                            <span className="mt-0.5 block truncate text-xs text-muted tabular-nums">
                              {phoneLabel}
                            </span>
                          ) : null}
                          <span
                            className={[
                              "mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase",
                              selected
                                ? "bg-primary/15 text-primary"
                                : "bg-shell text-muted",
                            ].join(" ")}
                          >
                            <Target
                              className="size-3"
                              strokeWidth={2}
                              aria-hidden
                            />
                            {row.loyaltyPoints} {t("customer.points")}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button
            ref={walkInRef}
            type="button"
            onClick={onWalkIn}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <Footprints className="size-4" strokeWidth={1.75} aria-hidden />
            {t("customer.continueWalkIn")}
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-shell px-5 py-2 text-[11px] text-muted">
          <p>
            <kbd className="font-semibold text-foreground">[Enter]</kbd>{" "}
            {t("customer.selectAction")}{" "}
            <span className="mx-1.5 text-border">·</span>
            <kbd className="font-semibold text-foreground">[Esc]</kbd>{" "}
            {t("customer.close")}{" "}
            <span className="mx-1.5 text-border">·</span>
            <kbd className="font-semibold text-foreground">[↑↓]</kbd>{" "}
            {t("customer.navigate")}
          </p>
        </div>
      </div>
    </div>
  );
}
