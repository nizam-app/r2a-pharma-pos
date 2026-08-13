import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { CheckCircle2, Minus, Plus, ShieldCheck, X } from "lucide-react";
import { useLocale, type MessageKey } from "@/i18n";
import { useConnectivity } from "@/features/shell";
import type { CartLine, CartLineFefoOverride } from "@/features/pos/cartTypes";
import { formatTaka } from "@/lib/format";
import {
  availablePcsForEditLine,
  buildPackagingOptions,
  lineTotal,
  loadProductUnits,
  quantityBase,
  stockBreakdown,
  type PackagingUnitOption,
  type PackagingUnitType,
} from "@/lib/qtyPackaging";
import type { ChangeBatchDraft } from "@/lib/changeBatch";
import {
  toCartLineFefoOverride,
  type StagedFefoOverride,
} from "@/lib/fefoOverrideAuth";
import { formatExpiryMonthYear } from "@/lib/productSearch";

function packagingLabel(
  unitType: PackagingUnitType,
  t: (key: MessageKey) => string,
): string {
  if (unitType === "PIECE") return t("pos.piece");
  if (unitType === "STRIP") return t("pos.strip");
  return t("pos.box");
}

function formatAvailableLocalized(
  quantityOnHand: number,
  options: PackagingUnitOption[],
  t: (key: MessageKey) => string,
): string {
  const parts = stockBreakdown(quantityOnHand, options);
  if (parts.kind === "strips_plus_pieces") {
    const stripWord =
      parts.strips === 1 ? t("pos.strip") : t("pos.strips");
    return `${t("pos.available")}: ${parts.strips} ${stripWord} + ${parts.pieces} ${t("pos.pieces")}`;
  }
  if (parts.kind === "strips_only") {
    const stripWord =
      parts.strips === 1 ? t("pos.strip") : t("pos.strips");
    return `${t("pos.available")}: ${parts.strips} ${stripWord}`;
  }
  return `${t("pos.available")}: ${parts.pieces} ${t("pos.pieces")}`;
}

export type EditSaleItemModalProps = {
  line: CartLine;
  /** Base PIECE qty from other cart lines sharing this batch. */
  otherSameBatchQuantityBase: number;
  /** Restore packaging draft after returning from Change Batch. */
  initialDraft?: ChangeBatchDraft | null;
  /**
   * Batch P — authorized FEFO override not yet saved to cart.
   * Drives Override Authorized banner / purple batch / audit.
   */
  stagedFefoOverride?: StagedFefoOverride | null;
  onClose: () => void;
  onSave: (line: CartLine) => void;
  /** Opens Change Batch (Batch N). Passes current packaging draft for the required-pcs banner. */
  onChangeBatch: (draft: ChangeBatchDraft) => void;
};

/**
 * Edit Sale Item modal (Batch M + P override-authorized state).
 * Esc → Cancel · Enter → Save Changes.
 * Change Batch → Batch N.
 */
export function EditSaleItemModal({
  line,
  otherSameBatchQuantityBase,
  initialDraft = null,
  stagedFefoOverride = null,
  onClose,
  onSave,
  onChangeBatch,
}: EditSaleItemModalProps) {
  const { t } = useLocale();
  const { isOnline } = useConnectivity();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);

  const overrideStaged = Boolean(stagedFefoOverride);
  const displayBatchNumber =
    stagedFefoOverride?.requestedBatch.batchNumber ?? line.batchNumber;
  const displayExpiry =
    stagedFefoOverride?.requestedBatch.expiryDate ?? line.expiryDate;
  const displayBatchQtyOnHand =
    stagedFefoOverride?.requestedBatch.quantityOnHand ?? line.batchQtyOnHand;
  const displaySellPerBase =
    stagedFefoOverride?.requestedBatch.sellPerBase ?? line.sellPerBase;
  const fefoNoteBatch = stagedFefoOverride?.fefoBatch ?? null;

  const availablePcs = availablePcsForEditLine(
    displayBatchQtyOnHand,
    otherSameBatchQuantityBase,
  );

  const [options, setOptions] = useState<PackagingUnitOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [unitType, setUnitType] = useState<PackagingUnitType>(
    initialDraft?.unitType ?? line.unitType,
  );
  const [qty, setQty] = useState(initialDraft?.unitQty ?? line.unitQty);

  const clampQty = useCallback((n: number, max: number) => {
    if (max < 1) return 1;
    return Math.min(max, Math.max(1, Math.trunc(n)));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadFailed(false);

    void (async () => {
      try {
        const units = await loadProductUnits(line.productId, {
          online: isOnline,
          nameHint: line.productName,
        });
        if (cancelled) return;
        const next = buildPackagingOptions(
          units,
          availablePcs,
          displaySellPerBase,
        );
        setOptions(next);

        const preferredType = initialDraft?.unitType ?? line.unitType;
        const preferredQty = initialDraft?.unitQty ?? line.unitQty;
        const current = next.find((o) => o.unitType === preferredType);
        const pick =
          current?.enabled
            ? current.unitType
            : (next.find((o) => o.enabled)?.unitType ?? preferredType);
        setUnitType(pick);
        const pickOpt = next.find((o) => o.unitType === pick);
        const max = pickOpt?.enabled ? pickOpt.maxQty : 1;
        setQty(clampQty(preferredQty, max));
      } catch {
        if (cancelled) return;
        setOptions([]);
        setLoadFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    line.productId,
    line.productName,
    line.unitType,
    line.unitQty,
    displaySellPerBase,
    initialDraft?.unitType,
    initialDraft?.unitQty,
    availablePcs,
    isOnline,
    clampQty,
  ]);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const selected = options.find((o) => o.unitType === unitType) ?? null;
  const maxQty = selected?.enabled ? selected.maxQty : 0;
  const canSave =
    Boolean(selected?.enabled) && qty >= 1 && qty <= maxQty && !loading;
  const selectUnit = useCallback(
    (next: PackagingUnitOption) => {
      if (!next.enabled) return;
      setUnitType(next.unitType);
      setQty((q) => clampQty(q, next.maxQty));
    },
    [clampQty],
  );

  const bumpQty = useCallback(
    (delta: number) => {
      if (!selected?.enabled) return;
      setQty((q) => clampQty(q + delta, selected.maxQty));
    },
    [selected, clampQty],
  );

  const moveUnit = useCallback(
    (delta: number) => {
      const enabled = options.filter((o) => o.enabled);
      if (enabled.length === 0) return;
      const cur = enabled.findIndex((o) => o.unitType === unitType);
      const from = cur >= 0 ? cur : 0;
      const next = enabled[(from + delta + enabled.length) % enabled.length]!;
      selectUnit(next);
    },
    [options, unitType, selectUnit],
  );

  const openChangeBatch = useCallback(() => {
    const factor = selected?.factorToBase ?? line.factorToBase;
    const unitQty = clampQty(qty, selected?.maxQty ?? (line.maxUnitQty || 1));
    onChangeBatch({
      unitType,
      unitQty,
      factorToBase: factor,
      quantityBase: quantityBase(factor, unitQty),
    });
  }, [
    selected,
    line.factorToBase,
    line.maxUnitQty,
    qty,
    unitType,
    clampQty,
    onChangeBatch,
  ]);

  const overrideMeta: CartLineFefoOverride | null | undefined = useMemo(() => {
    if (!stagedFefoOverride) return line.fefoOverride;
    return toCartLineFefoOverride(stagedFefoOverride);
  }, [stagedFefoOverride, line.fefoOverride]);

  const saveChanges = useCallback(() => {
    if (!selected?.enabled || !canSave) return;
    const unitQty = clampQty(qty, selected.maxQty);
    const unitPrice = selected.unitPrice;
    const requested = stagedFefoOverride?.requestedBatch;
    onSave({
      ...line,
      ...(requested
        ? {
            batchId: requested.batchId,
            batchNumber: requested.batchNumber,
            expiryDate: requested.expiryDate,
            batchQtyOnHand: requested.quantityOnHand,
            sellPerBase: requested.sellPerBase,
            fefo: false,
          }
        : {}),
      unitType: selected.unitType,
      unitQty,
      unitPrice,
      lineTotal: lineTotal(unitPrice, unitQty),
      quantityBase: quantityBase(selected.factorToBase, unitQty),
      factorToBase: selected.factorToBase,
      maxUnitQty: selected.maxQty,
      fefoOverride: overrideMeta ?? null,
    });
  }, [
    selected,
    canSave,
    qty,
    clampQty,
    line,
    onSave,
    stagedFefoOverride,
    overrideMeta,
  ]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      saveChanges();
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveUnit(-1);
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveUnit(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      bumpQty(1);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      bumpQty(-1);
      return;
    }
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      bumpQty(1);
      return;
    }
    if (event.key === "-" && event.target !== qtyInputRef.current) {
      event.preventDefault();
      bumpQty(-1);
    }
  };

  const availableText = formatAvailableLocalized(availablePcs, options, t);
  const unitPrice = selected?.unitPrice ?? 0;
  const updatedTotal = selected
    ? lineTotal(unitPrice, clampQty(qty, maxQty || 1))
    : 0;
  const genericLine =
    line.genericName?.trim() ||
    [line.strength, line.form].filter(Boolean).join(" ") ||
    null;
  const unitLabel = packagingLabel(unitType, t);
  const showAppliedOverride =
    !overrideStaged && Boolean(line.fefoOverride) && !line.fefo;

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
        className="flex w-full max-w-md flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-xl outline-none"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="text-lg font-bold tracking-tight text-foreground"
            >
              {t("edit.title")}
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              {t("edit.editingInCurrentSale")}
            </p>
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

        {overrideStaged && stagedFefoOverride ? (
          <div
            className="mx-5 mt-4 flex items-start gap-2.5 rounded-md border border-primary/25 bg-primary/10 px-3 py-2.5"
            role="status"
          >
            <CheckCircle2
              className="mt-0.5 size-4 shrink-0 text-primary"
              strokeWidth={2}
              aria-hidden
            />
            <p className="text-sm leading-snug text-foreground">
              <span className="font-bold text-primary">
                {t("edit.overrideAuthorized")}
              </span>{" "}
              <span className="font-semibold">
                {stagedFefoOverride.requestedBatch.batchNumber}
              </span>{" "}
              {t("edit.isApprovedForItem")}
            </p>
          </div>
        ) : null}

        <div className="space-y-4 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-base font-bold text-foreground">
                {line.productName}
              </p>
              {genericLine ? (
                <p className="mt-0.5 text-sm text-muted italic">{genericLine}</p>
              ) : null}
              {line.manufacturer ? (
                <p className="mt-0.5 text-xs text-muted">{line.manufacturer}</p>
              ) : null}
            </div>
            {overrideStaged ? (
              <span className="shrink-0 text-sm font-bold tabular-nums text-foreground">
                {formatTaka(unitPrice || line.unitPrice)}
              </span>
            ) : (
              <span className="inline-flex shrink-0 items-center rounded-md bg-expiry-ok/15 px-2 py-1 text-[10px] font-bold tracking-wide text-expiry-ok uppercase">
                {t("edit.inStock")}
              </span>
            )}
          </div>

          {overrideStaged || showAppliedOverride ? (
            <div className="rounded-md border border-border bg-shell/60 px-3 py-2.5 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">
                    {t("edit.selectedBatch")}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-accent">
                      {displayBatchNumber}
                    </span>
                    <span className="inline-flex items-center rounded-md bg-accent/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-accent uppercase">
                      {t("edit.authorizedFefoOverride")}
                    </span>
                  </div>
                  <p className="text-xs text-muted">
                    {t("edit.exp")}:{" "}
                    <span className="font-medium text-foreground">
                      {formatExpiryMonthYear(displayExpiry)}
                    </span>
                  </p>
                  {(() => {
                    const fefoNo =
                      fefoNoteBatch?.batchNumber ??
                      line.fefoOverride?.fefoBatchNumber;
                    const fefoExp =
                      fefoNoteBatch?.expiryDate ??
                      line.fefoOverride?.fefoExpiryDate;
                    if (!fefoNo) return null;
                    return (
                      <p className="text-xs text-muted">
                        {t("edit.fefoRecommended")}:{" "}
                        <span className="font-medium text-foreground">
                          {fefoNo}
                        </span>
                        {fefoExp
                          ? ` — ${t("edit.exp")} ${formatExpiryMonthYear(fefoExp)}`
                          : null}
                      </p>
                    );
                  })()}
                  <button
                    type="button"
                    onClick={openChangeBatch}
                    className="pt-0.5 text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    {t("edit.changeBatch")}
                  </button>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-base font-bold tabular-nums text-primary">
                    {availablePcs} {t("pos.pieces")}
                  </p>
                  <p className="text-[11px] text-muted">
                    {t("edit.availableInStock")}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border bg-shell/60 px-3 py-2.5 text-sm">
              <span className="font-medium text-foreground">
                {t("edit.batch")}:{" "}
                <span className="font-semibold">{line.batchNumber}</span>
              </span>
              <span className="text-muted" aria-hidden>
                |
              </span>
              <span className="font-medium text-foreground">
                {t("edit.expiry")}:{" "}
                <span className="font-semibold text-expiry-danger">
                  {formatExpiryMonthYear(line.expiryDate)}
                </span>
              </span>
              {line.fefo ? (
                <>
                  <span className="text-muted" aria-hidden>
                    |
                  </span>
                  <span className="font-medium text-muted">
                    {t("pos.fefoRecommended")}
                  </span>
                </>
              ) : null}
              <button
                type="button"
                onClick={openChangeBatch}
                className="ml-auto text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                {t("edit.changeBatch")}
              </button>
            </div>
          )}

          {loading ? (
            <p className="py-6 text-center text-sm text-muted">
              {t("pos.loadingPackaging")}
            </p>
          ) : loadFailed ? (
            <p className="py-6 text-center text-sm text-destructive">
              {t("pos.couldNotLoadPackaging")}
            </p>
          ) : (
            <>
              <div
                className="space-y-2"
                role="radiogroup"
                aria-label={t("pos.packagingUnit")}
              >
                {options.map((opt) => {
                  const selectedCard = opt.unitType === unitType;
                  const label = packagingLabel(opt.unitType, t);
                  return (
                    <button
                      key={opt.unitType}
                      type="button"
                      role="radio"
                      aria-checked={selectedCard && opt.enabled}
                      aria-disabled={!opt.enabled}
                      disabled={!opt.enabled}
                      onClick={() => selectUnit(opt)}
                      className={[
                        "flex w-full items-center gap-3 rounded-md border px-3 py-3 text-left transition-colors",
                        !opt.enabled
                          ? "cursor-not-allowed border-border bg-shell/70 text-muted opacity-80"
                          : selectedCard
                            ? "border-primary bg-primary/5 ring-1 ring-primary/25"
                            : "border-border bg-surface hover:border-primary/40",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "flex size-4 shrink-0 items-center justify-center rounded-full border-2",
                          selectedCard && opt.enabled
                            ? "border-primary"
                            : "border-muted",
                        ].join(" ")}
                        aria-hidden
                      >
                        {selectedCard && opt.enabled ? (
                          <span className="size-2 rounded-full bg-primary" />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={[
                            "block text-sm font-semibold",
                            !opt.enabled
                              ? "text-muted"
                              : selectedCard
                                ? "text-primary"
                                : "text-foreground",
                          ].join(" ")}
                        >
                          {label}
                        </span>
                        {opt.unitType !== "PIECE" ? (
                          <span className="mt-0.5 block text-xs text-muted">
                            {opt.factorToBase} {t("pos.pieces")}
                          </span>
                        ) : null}
                        {!opt.enabled ? (
                          <span className="mt-0.5 block text-xs font-semibold tracking-wide text-expiry-danger uppercase">
                            {t("pos.insufficientStock")}
                          </span>
                        ) : null}
                      </span>
                      {opt.enabled ? (
                        <span
                          className={[
                            "shrink-0 text-sm tabular-nums",
                            selectedCard
                              ? "font-semibold text-primary"
                              : "text-muted",
                          ].join(" ")}
                        >
                          {formatTaka(opt.unitPrice)} / {label}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              <div>
                <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
                  <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                    {t("pos.quantity")}
                  </p>
                  <div className="text-right text-[11px] text-muted">
                    <p>{availableText}</p>
                    <p>
                      {t("edit.availableForThisItem")}:{" "}
                      <span className="font-medium text-foreground">
                        {availablePcs} {t("pos.pieces")}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="inline-flex items-center overflow-hidden rounded-md border border-border bg-surface">
                  <button
                    type="button"
                    onClick={() => bumpQty(-1)}
                    disabled={!canSave || qty <= 1}
                    className="flex size-10 items-center justify-center text-muted hover:bg-shell disabled:opacity-40"
                    aria-label={t("pos.decreaseQty")}
                  >
                    <Minus className="size-4" strokeWidth={2} />
                  </button>
                  <input
                    ref={qtyInputRef}
                    type="text"
                    inputMode="numeric"
                    value={String(qty)}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "");
                      if (digits === "") {
                        setQty(1);
                        return;
                      }
                      setQty(clampQty(Number(digits), maxQty || 1));
                    }}
                    className="w-14 border-x border-border bg-surface py-2 text-center text-base font-semibold tabular-nums text-foreground outline-none"
                    aria-label={t("pos.quantity")}
                  />
                  <button
                    type="button"
                    onClick={() => bumpQty(1)}
                    disabled={!selected?.enabled || qty >= maxQty}
                    className="flex size-10 items-center justify-center text-muted hover:bg-shell disabled:opacity-40"
                    aria-label={t("pos.increaseQty")}
                  >
                    <Plus className="size-4" strokeWidth={2} />
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-muted italic">
                  {t("edit.includesAllocatedNote")}
                </p>
              </div>

              {(overrideStaged || showAppliedOverride) &&
              (stagedFefoOverride || line.fefoOverride) ? (
                <div className="flex items-start gap-2 rounded-md border border-border bg-shell/40 px-3 py-2.5">
                  <ShieldCheck
                    className="mt-0.5 size-4 shrink-0 text-primary"
                    strokeWidth={2}
                    aria-hidden
                  />
                  <div className="min-w-0 text-xs leading-snug">
                    <p className="font-semibold text-foreground">
                      {t("edit.authorizedBy")}:{" "}
                      {stagedFefoOverride?.authorizedByName ??
                        line.fefoOverride?.authorizedByName}
                    </p>
                    <p className="mt-0.5 text-muted">
                      {t("edit.managerAuthRecorded")}
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="flex items-end justify-between gap-3 border-t border-border pt-3">
                <div className="text-xs text-muted">
                  <p>
                    {t("pos.unitPrice")}:{" "}
                    <span className="font-medium text-foreground">
                      {formatTaka(unitPrice)}
                    </span>{" "}
                    / {unitLabel}
                    {" · "}
                    {t("edit.qty")}:{" "}
                    <span className="font-medium text-foreground">
                      {clampQty(qty, maxQty || 1)}
                    </span>
                  </p>
                  <p className="mt-1 font-medium text-foreground">
                    {t("edit.updatedLineTotal")}
                  </p>
                </div>
                <p className="text-2xl font-bold tabular-nums text-primary">
                  {formatTaka(updatedTotal)}
                </p>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border bg-shell/40 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {t("footer.cancel")}
            <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-muted">
              Esc
            </kbd>
          </button>
          <button
            type="button"
            onClick={saveChanges}
            disabled={!canSave}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {t("edit.saveChanges")}
            <kbd className="rounded border border-white/30 bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold">
              Enter
            </kbd>
          </button>
        </div>
      </div>
    </div>
  );
}
