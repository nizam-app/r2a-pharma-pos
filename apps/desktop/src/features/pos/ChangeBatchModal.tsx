import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { AlertTriangle, ArrowLeft, X } from "lucide-react";
import { useLocale, type MessageKey } from "@/i18n";
import { useConnectivity } from "@/features/shell";
import type { CartLine } from "@/features/pos/cartTypes";
import {
  loadBatchesForProduct,
  type PosBatchRow,
} from "@/lib/batchSelect";
import {
  changeBatchStatusKind,
  defaultChangeBatchFocusIndex,
  needsFefoOverride,
  type ChangeBatchDraft,
  type ChangeBatchStatusKind,
} from "@/lib/changeBatch";
import { formatExpiryMonthYear } from "@/lib/productSearch";
import type { PackagingUnitType } from "@/lib/qtyPackaging";

export type ChangeBatchModalProps = {
  line: CartLine;
  draft: ChangeBatchDraft;
  onBack: () => void;
  /** Keep Current Batch — return to Edit without changing batch. */
  onKeepCurrent: () => void;
  /**
   * Non-FEFO selection — opens Manager Authorization (Batch O).
   * Passes requested lot + current FEFO lot for the compare UI.
   */
  onRequestAuthorization: (
    requested: PosBatchRow,
    fefo: PosBatchRow | null,
  ) => void;
};

function packagingLabel(
  unitType: PackagingUnitType,
  t: (key: MessageKey) => string,
): string {
  if (unitType === "PIECE") return t("pos.piece");
  if (unitType === "STRIP") return t("pos.strip");
  return t("pos.box");
}

function statusLabel(
  kind: ChangeBatchStatusKind,
  t: (key: MessageKey) => string,
): string {
  switch (kind) {
    case "current_fefo":
      return t("changeBatch.statusCurrentFefo");
    case "current":
      return t("changeBatch.statusCurrent");
    case "can_fulfill":
      return t("changeBatch.statusCanFulfill");
    case "auth_required":
      return t("changeBatch.statusAuthRequired");
    case "expired":
      return t("changeBatch.statusExpired");
  }
}

/**
 * Change Batch modal (Batch N) — edit-flow content only; chrome stays locked.
 * Esc / Back → Edit · Enter → Keep Current or Request Authorization.
 */
export function ChangeBatchModal({
  line,
  draft,
  onBack,
  onKeepCurrent,
  onRequestAuthorization,
}: ChangeBatchModalProps) {
  const { t } = useLocale();
  const { isOnline } = useConnectivity();
  const titleId = useId();
  const listId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState<PosBatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);

  const requiredPcs = Math.max(1, draft.quantityBase);
  const unitLabel = packagingLabel(draft.unitType, t);
  const fefoRow = rows.find((r) => r.status === "fefo") ?? null;
  const focused = rows[focusedIndex] ?? null;
  const override = needsFefoOverride(focused);
  const focusedIsCurrent = Boolean(
    focused && focused.batchId === line.batchId,
  );
  const canPrimary =
    Boolean(focused?.sellable) && (focusedIsCurrent || override);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadFailed(false);

    void (async () => {
      try {
        const list = await loadBatchesForProduct(line.productId, {
          online: isOnline,
        });
        if (cancelled) return;
        setRows(list);
        setFocusedIndex(defaultChangeBatchFocusIndex(list, line.batchId));
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
  }, [line.productId, line.batchId, isOnline]);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const runPrimary = useCallback(() => {
    if (!focused?.sellable) return;
    if (focused.batchId === line.batchId) {
      onKeepCurrent();
      return;
    }
    if (needsFefoOverride(focused)) {
      onRequestAuthorization(focused, fefoRow);
    }
  }, [focused, fefoRow, line.batchId, onKeepCurrent, onRequestAuthorization]);

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
      onBack();
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
      runPrimary();
    }
  };

  const primaryLabel = override
    ? t("changeBatch.requestAuthorization")
    : t("changeBatch.keepCurrentBatch");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onBack();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="flex w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-xl outline-none"
      >
        <div className="relative border-b border-border px-5 pt-4 pb-3">
          <button
            type="button"
            onClick={onBack}
            className="absolute top-4 left-5 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <ArrowLeft className="size-4" strokeWidth={2} aria-hidden />
            {t("changeBatch.backToEdit")}
          </button>
          <button
            type="button"
            onClick={onBack}
            className="absolute top-3.5 right-4 rounded-md p-1 text-muted hover:bg-shell hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label={t("pos.close")}
          >
            <X className="size-5" strokeWidth={1.75} />
          </button>
          <div className="px-8 pt-1 text-center">
            <h2
              id={titleId}
              className="text-xl font-bold tracking-tight text-primary"
            >
              {t("changeBatch.title")}
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              {line.productName} - {t("changeBatch.editingSuffix")}
            </p>
          </div>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div className="flex items-center justify-between gap-3 rounded-md border border-primary/20 bg-primary/10 px-4 py-2.5 text-sm">
            <span className="text-foreground">
              {t("changeBatch.requiredFor")}{" "}
              <span className="font-medium">
                {draft.unitQty} × {unitLabel}
              </span>
              :
            </span>
            <span className="font-bold text-primary tabular-nums">
              {requiredPcs} {t("pos.pieces")}
            </span>
          </div>

          <div className="min-h-[4.75rem]" aria-live="polite">
            {override && focused ? (
              <div
                role="alert"
                className="flex gap-3 rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950"
              >
                <AlertTriangle
                  className="mt-0.5 size-5 shrink-0 text-amber-500"
                  strokeWidth={2}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="font-bold text-sky-950">
                    {t("changeBatch.manualFefoOverride")}
                  </p>
                  <p className="mt-0.5 text-sky-900/90">
                    {fefoRow
                      ? `${fefoRow.batchNumber} ${t("changeBatch.overrideWarnWithFefo")} ${focused.batchNumber}.`
                      : `${t("changeBatch.overrideWarnNoFefoPrefix")} ${focused.batchNumber} ${t("changeBatch.overrideWarnNoFefoSuffix")}`}
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="min-h-48 overflow-hidden rounded-md border border-border">
            {loading ? (
              <p className="px-3 py-8 text-center text-sm text-muted">
                {t("pos.loadingBatches")}
              </p>
            ) : loadFailed ? (
              <p className="px-3 py-8 text-center text-sm text-destructive">
                {t("pos.couldNotLoadBatches")}
              </p>
            ) : rows.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted">
                {t("pos.noInStockBatches")}
              </p>
            ) : (
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-shell/50 text-[11px] font-semibold tracking-wide text-muted uppercase">
                    <th className="px-3 py-2.5 font-semibold">
                      {t("pos.batch")}
                    </th>
                    <th className="px-3 py-2.5 font-semibold">
                      {t("pos.exp")}
                    </th>
                    <th className="px-3 py-2.5 font-semibold">
                      {t("pos.available")}
                    </th>
                    <th className="px-3 py-2.5 font-semibold">
                      {t("pos.status")}
                    </th>
                  </tr>
                </thead>
                <tbody
                  id={listId}
                  role="listbox"
                  aria-label={t("changeBatch.title")}
                >
                  {rows.map((row, index) => {
                    const kind = changeBatchStatusKind(row, {
                      currentBatchId: line.batchId,
                      focusedBatchId: focused?.batchId ?? null,
                      requiredPcs,
                    });
                    return (
                      <ChangeBatchRow
                        key={row.batchId}
                        row={row}
                        kind={kind}
                        selected={index === focusedIndex}
                        isCurrent={row.batchId === line.batchId}
                        onHover={() => {
                          setFocusedIndex((prev) =>
                            prev === index ? prev : index,
                          );
                        }}
                        onActivate={() => {
                          if (!row.sellable) return;
                          setFocusedIndex((prev) =>
                            prev === index ? prev : index,
                          );
                        }}
                      />
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border bg-shell/40 px-5 py-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground hover:bg-shell focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {t("settings.back")}
            <kbd className="rounded border border-border bg-shell px-1.5 py-0.5 text-[10px] font-semibold text-muted">
              Esc
            </kbd>
          </button>
          <button
            type="button"
            onClick={runPrimary}
            disabled={!canPrimary}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {primaryLabel}
            <kbd className="rounded border border-white/30 bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold">
              Enter
            </kbd>
          </button>
        </div>
      </div>
    </div>
  );
}

function ChangeBatchRow({
  row,
  kind,
  selected,
  isCurrent,
  onHover,
  onActivate,
}: {
  row: PosBatchRow;
  kind: ChangeBatchStatusKind;
  selected: boolean;
  isCurrent: boolean;
  onHover: () => void;
  onActivate: () => void;
}) {
  const { t } = useLocale();
  const expired = kind === "expired";
  const statusClass =
    kind === "current_fefo" || kind === "current"
      ? "font-bold text-primary"
      : kind === "can_fulfill"
        ? "font-bold text-sky-600"
        : kind === "auth_required"
          ? "font-bold text-accent"
          : "font-bold text-destructive";

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
        "border-t border-border/80 transition-colors",
        expired
          ? "cursor-not-allowed bg-shell/40 text-muted"
          : selected
            ? isCurrent
              ? "cursor-default bg-primary/5 shadow-[inset_3px_0_0_0_var(--r2a-primary)]"
              : "cursor-default bg-sky-50 shadow-[inset_3px_0_0_0_var(--r2a-primary)]"
            : "cursor-default hover:bg-shell/60",
      ].join(" ")}
    >
      <td
        className={[
          "px-3 py-3 font-semibold",
          expired ? "text-muted line-through" : "text-foreground",
        ].join(" ")}
      >
        {row.batchNumber}
      </td>
      <td
        className={[
          "px-3 py-3 tabular-nums",
          expired
            ? "font-medium text-destructive line-through"
            : "text-foreground",
        ].join(" ")}
      >
        {formatExpiryMonthYear(row.expiryDate)}
      </td>
      <td
        className={[
          "px-3 py-3",
          expired ? "text-muted line-through" : "text-foreground",
        ].join(" ")}
      >
        <span className="font-medium tabular-nums">
          {row.quantityOnHand} {t("pos.pcs")}
        </span>
        {isCurrent && !expired ? (
          <span className="mt-0.5 block text-[11px] text-muted">
            {t("changeBatch.allocated")}
          </span>
        ) : null}
      </td>
      <td className={["px-3 py-3", statusClass].join(" ")}>
        {statusLabel(kind, t)}
      </td>
    </tr>
  );
}
