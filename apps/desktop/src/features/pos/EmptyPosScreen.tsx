import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { ArrowDown, ArrowUp, PackagePlus, Search, X } from "lucide-react";
import { useLocale } from "@/i18n";
import { useConnectivity } from "@/features/shell";
import {
  searchPosProducts,
  type PosSearchResult,
} from "@/lib/productSearch";
import { SearchResultRow } from "./SearchResultRow";

const SEARCH_DEBOUNCE_MS = 120;

const SEARCH_HINT_KEYS = [
  "pos.hintName",
  "pos.hintGeneric",
  "pos.hintStrength",
  "pos.hintManufacturer",
  "pos.hintBarcode",
] as const;

export type EmptyPosScreenProps = {
  searchInputRef: RefObject<HTMLInputElement | null>;
  onCancelSale: () => void;
  /** Opens Select Batch (Batch I). */
  onSelectProduct?: (product: PosSearchResult) => void;
  /** When cart has lines, empty search shows “Ready for next item” (Batch K). */
  hasCartItems?: boolean;
  /**
   * F4 context (Batch AG): focused search row while results are visible.
   * Null when search is empty / no hits. Expired rows still report.
   */
  onFocusedProductChange?: (product: PosSearchResult | null) => void;
};

/**
 * New Sale main panel (Batches G + H + K empty prompt).
 * Catalog card search layout (teal chrome); Select Batch owned by App.
 */
export function EmptyPosScreen({
  searchInputRef,
  onCancelSale,
  onSelectProduct,
  hasCartItems = false,
  onFocusedProductChange,
}: EmptyPosScreenProps) {
  const { t } = useLocale();
  const { isOnline } = useConnectivity();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PosSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqSeq = useRef(0);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, [searchInputRef]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setResults([]);
      setLoading(false);
      setFocusedIndex(0);
      return;
    }

    setLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      const seq = ++reqSeq.current;
      void (async () => {
        try {
          const hits = await searchPosProducts(trimmed, { online: isOnline });
          if (seq !== reqSeq.current) return;
          setResults(hits);
          setFocusedIndex(0);
        } catch {
          if (seq !== reqSeq.current) return;
          setResults([]);
        } finally {
          if (seq === reqSeq.current) setLoading(false);
        }
      })();
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, isOnline]);

  // Report focused search product for F4 (Batch AG) — prefer over cart when results show.
  useEffect(() => {
    if (!onFocusedProductChange) return;
    const trimmed = query.trim();
    if (!trimmed || results.length === 0) {
      onFocusedProductChange(null);
      return;
    }
    onFocusedProductChange(results[focusedIndex] ?? null);
  }, [query, results, focusedIndex, onFocusedProductChange]);

  const clearSearch = useCallback(() => {
    setQuery("");
    setResults([]);
    setFocusedIndex(0);
    searchInputRef.current?.focus();
  }, [searchInputRef]);

  const activateFocused = useCallback(() => {
    const row = results[focusedIndex];
    if (!row || !row.selectable) return;
    onSelectProduct?.(row);
  }, [results, focusedIndex, onSelectProduct]);

  const moveFocus = useCallback(
    (delta: number) => {
      if (results.length === 0) return;
      setFocusedIndex((i) => {
        const next = (i + delta + results.length) % results.length;
        return next;
      });
    },
    [results.length],
  );

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveFocus(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveFocus(-1);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      activateFocused();
    }
  };

  const showEmptyPrompt = query.trim().length === 0;
  const showResults = !showEmptyPrompt;

  return (
    <div className="flex h-full min-h-0 flex-col px-6 py-5">
      <h1 className="text-xl font-bold tracking-tight text-foreground">
        {t("sidebar.newSale")}
      </h1>

      <div className="relative mt-4">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
          strokeWidth={1.75}
          aria-hidden
        />
        <input
          ref={searchInputRef}
          type="search"
          name="product-search"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onSearchKeyDown}
          placeholder={t("pos.searchPlaceholder")}
          className="w-full rounded-lg border border-border bg-surface py-2.5 pr-28 pl-10 text-sm text-foreground shadow-sm outline-none placeholder:text-muted focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
          aria-label={t("pos.searchAria")}
          aria-controls={showResults ? listId : undefined}
          aria-autocomplete="list"
          role="combobox"
          aria-expanded={showResults}
        />
        <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1">
          {query ? (
            <button
              type="button"
              onClick={clearSearch}
              className="rounded p-1 text-muted hover:bg-shell hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              aria-label={t("pos.clearSearch")}
            >
              <X className="size-3.5" strokeWidth={2} />
            </button>
          ) : null}
          <kbd className="rounded border border-border bg-shell px-1.5 py-0.5 text-[11px] font-medium text-muted">
            Ctrl K
          </kbd>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
        <span className="font-medium text-foreground/70">{t("pos.searchBy")}</span>
        {SEARCH_HINT_KEYS.map((key) => (
          <span key={key} className="rounded bg-shell px-1.5 py-0.5">
            {t(key)}
          </span>
        ))}
        <span className="ml-auto inline-flex items-center gap-1.5">
          <ArrowUp className="size-3" aria-hidden />
          <ArrowDown className="size-3" aria-hidden />
          <span>{t("pos.navigate")}</span>
          <kbd className="rounded border border-border bg-surface px-1 py-px font-medium">
            Enter
          </kbd>
          <span>{t("pos.select")}</span>
        </span>
      </div>

      {showEmptyPrompt ? (
        <div className="mt-4 flex min-h-0 flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-canvas/60 px-6 py-10 text-center">
          <PackagePlus
            className="size-14 text-border"
            strokeWidth={1.25}
            aria-hidden
          />
          {hasCartItems ? (
            <>
              <p className="mt-4 text-base font-semibold text-foreground">
                {t("pos.readyForNextItem")}
              </p>
              <p className="mt-1.5 max-w-md text-sm text-muted">
                {t("pos.readyForNextItemHint")}
              </p>
            </>
          ) : (
            <>
              <p className="mt-4 text-base font-semibold text-foreground">
                {t("pos.searchForMedicine")}
              </p>
              <p className="mt-1.5 max-w-sm text-sm text-muted">
                {t("pos.searchForMedicineHint")}
              </p>
            </>
          )}
          <button
            type="button"
            onClick={onCancelSale}
            className="mt-6 text-sm font-semibold text-destructive hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
          >
            {t("pos.cancelSale")}
          </button>
        </div>
      ) : (
        <div className="mt-3 flex min-h-0 flex-1 flex-col">
          <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
            <p className="text-xs font-semibold tracking-wide text-muted uppercase">
              {t("pos.searchResults")}
              {!loading ? (
                <span className="ml-1.5 tabular-nums text-foreground">
                  · {results.length}
                </span>
              ) : null}
            </p>
            <button
              type="button"
              onClick={clearSearch}
              className="text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {t("pos.clearSearch")}
            </button>
          </div>

          {loading && results.length === 0 ? (
            <p className="px-1 py-3 text-sm text-muted">{t("pos.searching")}</p>
          ) : results.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-canvas/40 px-6 py-8 text-center">
              <p className="text-sm font-medium text-foreground">
                {t("pos.noMedicinesFound")}
              </p>
              <p className="mt-1 text-xs text-muted tabular-nums">
                “{query.trim()}”
              </p>
              <p className="mt-1 text-xs text-muted">{t("pos.tryAnotherSearch")}</p>
              <button
                type="button"
                onClick={onCancelSale}
                className="mt-5 text-sm font-semibold text-destructive hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
              >
                {t("pos.cancelSale")}
              </button>
            </div>
          ) : (
            <ul
              id={listId}
              role="listbox"
              aria-label={t("pos.searchResults")}
              className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-2"
            >
              {results.map((result, index) => (
                <SearchResultRow
                  key={result.productId}
                  result={result}
                  selected={index === focusedIndex}
                  onHover={() => setFocusedIndex(index)}
                  onActivate={() => {
                    setFocusedIndex(index);
                    if (result.selectable) onSelectProduct?.(result);
                  }}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
