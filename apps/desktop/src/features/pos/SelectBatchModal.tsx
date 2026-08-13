import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  Ban,
  CheckCircle2,
  ChevronRight,
  Package,
  X,
} from "lucide-react";
import { useLocale } from "@/i18n";
import { useConnectivity } from "@/features/shell";
import {
  defaultBatchFocusIndex,
  loadBatchesForProduct,
  type PosBatchRow,
} from "@/lib/batchSelect";
import {
  formatExpiryMonthYear,
  type PosSearchResult,
} from "@/lib/productSearch";

export type SelectBatchModalProps = {
  product: PosSearchResult;
  onClose: () => void;
  /** Confirmed sellable batch — opens Quantity & Packaging (Batch J). */
  onConfirm: (batch: PosBatchRow) => void;
};

/**
 * Select Batch modal (Batch I) — modal content only; chrome stays locked.
 * ↑↓ navigate · Enter confirms sellable · Esc closes.
 */
export function SelectBatchModal({
  product,
  onClose,
  onConfirm,
}: SelectBatchModalProps) {
  const { t } = useLocale();
  const { isOnline } = useConnectivity();
  const titleId = useId();
  const listId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState<PosBatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadFailed(false);

    void (async () => {
      try {
        const list = await loadBatchesForProduct(product.productId, {
          online: isOnline,
        });
        if (cancelled) return;
        setRows(list);
        setFocusedIndex(defaultBatchFocusIndex(list));
      } catch {
        if (cancelled) return;
        setRows([]);
        setLoadFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [product.productId, isOnline]);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const confirmFocused = useCallback(() => {
    const row = rows[focusedIndex];
    if (!row || !row.sellable) return;
    onConfirm(row);
  }, [rows, focusedIndex, onConfirm]);

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
      confirmFocused();
    }
  };

  // Match Select Batch mock: "Napa 500mg (Paracetamol 500mg)" — domain data raw.
  const identityGeneric = [product.genericName, product.strength]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+mg$/i, "mg");
  const productLine = identityGeneric
    ? `${product.name} (${identityGeneric})`
    : product.name;

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
        className="flex w-full max-w-xl flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-xl outline-none"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Package
                className="size-5 shrink-0 text-primary"
                strokeWidth={1.75}
                aria-hidden
              />
              <h2
                id={titleId}
                className="text-base font-bold tracking-tight text-foreground"
              >
                {t("pos.selectBatch")}
              </h2>
            </div>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {productLine}
            </p>
            {product.manufacturer ? (
              <p className="mt-0.5 text-xs text-muted">{product.manufacturer}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted hover:bg-shell hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label={t("pos.close")}
          >
            <X className="size-5" strokeWidth={1.75} />
          </button>
        </div>

        <div className="min-h-48 px-3 py-2">
          {loading ? (
            <p className="px-2 py-6 text-center text-sm text-muted">
              {t("pos.loadingBatches")}
            </p>
          ) : loadFailed ? (
            <p className="px-2 py-6 text-center text-sm text-destructive">
              {t("pos.couldNotLoadBatches")}
            </p>
          ) : rows.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted">
              {t("pos.noInStockBatches")}
            </p>
          ) : (
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="text-[11px] font-semibold tracking-wide text-muted uppercase">
                  <th className="w-6 px-1 py-2" aria-hidden />
                  <th className="px-2 py-2 font-semibold">{t("pos.batchNo")}</th>
                  <th className="px-2 py-2 font-semibold">{t("pos.expiryDate")}</th>
                  <th className="px-2 py-2 font-semibold">
                    {t("pos.availableQty")}
                  </th>
                  <th className="px-2 py-2 font-semibold">{t("pos.status")}</th>
                </tr>
              </thead>
              <tbody
                id={listId}
                role="listbox"
                aria-label={t("pos.selectBatch")}
              >
                {rows.map((row, index) => (
                  <BatchRow
                    key={row.batchId}
                    row={row}
                    selected={index === focusedIndex}
                    onHover={() => setFocusedIndex(index)}
                    onActivate={() => {
                      setFocusedIndex(index);
                      if (row.sellable) onConfirm(row);
                    }}
                  />
                ))}
              </tbody>
            </table>
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
            <span>{t("pos.toNavigate")}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 font-medium text-foreground">
              Enter
            </kbd>
            <span>{t("pos.toConfirmBatch")}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function BatchRow({
  row,
  selected,
  onHover,
  onActivate,
}: {
  row: PosBatchRow;
  selected: boolean;
  onHover: () => void;
  onActivate: () => void;
}) {
  const { t } = useLocale();
  const expired = row.status === "expired";
  const fefo = row.status === "fefo";

  return (
    <tr
      role="option"
      aria-selected={selected}
      aria-disabled={expired}
      tabIndex={-1}
      onMouseEnter={onHover}
      onClick={() => {
        if (!expired) onActivate();
      }}
      className={[
        "cursor-default border-t border-border/80 transition-colors",
        expired
          ? "cursor-not-allowed text-destructive"
          : selected
            ? "bg-primary/10"
            : "hover:bg-shell/80",
        expired && selected ? "bg-destructive/5" : "",
      ].join(" ")}
    >
      <td className="px-1 py-2.5 text-center align-middle">
        {expired ? (
          <Ban
            className="mx-auto size-4 text-destructive"
            strokeWidth={2}
            aria-hidden
          />
        ) : selected ? (
          <ChevronRight
            className="mx-auto size-4 text-primary"
            strokeWidth={2.5}
            aria-hidden
          />
        ) : (
          <span className="inline-block size-4" aria-hidden />
        )}
      </td>
      <td
        className={[
          "px-2 py-2.5 font-medium",
          expired ? "text-destructive" : "text-foreground",
        ].join(" ")}
      >
        {row.batchNumber}
      </td>
      <td
        className={[
          "px-2 py-2.5",
          expired ? "text-destructive" : "text-foreground",
        ].join(" ")}
      >
        {formatExpiryMonthYear(row.expiryDate)}
      </td>
      <td
        className={[
          "px-2 py-2.5",
          expired ? "text-destructive" : "text-foreground",
        ].join(" ")}
      >
        {row.quantityOnHand} {t("pos.pcs")}
      </td>
      <td className="px-2 py-2.5">
        {fefo ? (
          <span className="inline-flex items-center gap-1.5 font-semibold text-expiry-ok">
            <CheckCircle2 className="size-3.5 shrink-0" strokeWidth={2} />
            {t("pos.fefoRecommended")}
          </span>
        ) : expired ? (
          <span className="inline-flex items-center gap-1.5 font-semibold text-destructive">
            <Ban className="size-3.5 shrink-0" strokeWidth={2} />
            {t("pos.expiredNotSellable")}
          </span>
        ) : (
          <span className="text-muted">{t("pos.standard")}</span>
        )}
      </td>
    </tr>
  );
}
