import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Check, Minus, Package, Plus, X } from "lucide-react";
import { useLocale, type MessageKey } from "@/i18n";
import { useConnectivity } from "@/features/shell";
import type { PosBatchRow } from "@/lib/batchSelect";
import { formatTaka } from "@/lib/format";
import {
  buildPackagingOptions,
  defaultPackagingUnit,
  lineTotal,
  loadProductUnits,
  quantityBase,
  stockBreakdown,
  type PackagingUnitOption,
  type PackagingUnitType,
} from "@/lib/qtyPackaging";
import {
  formatExpiryMonthYear,
  type PosSearchResult,
} from "@/lib/productSearch";
import type { CartLine } from "@/features/pos/cartTypes";

export type QuantityPackagingModalProps = {
  product: PosSearchResult;
  batch: PosBatchRow;
  onBack: () => void;
  onClose: () => void;
  onAddToSale: (line: CartLine) => void;
};

function unitTitle(
  unitType: PackagingUnitType,
  factorToBase: number,
  t: (key: MessageKey) => string,
): string {
  if (unitType === "PIECE") return t("pos.piece");
  if (unitType === "STRIP") {
    return `${t("pos.strip")} (${factorToBase} ${t("pos.pcs")})`;
  }
  return `${t("pos.box")} (${factorToBase} ${t("pos.pcs")})`;
}

function unitNoun(
  unitType: PackagingUnitType,
  t: (key: MessageKey) => string,
): string {
  if (unitType === "PIECE") return t("pos.unitNounPiece");
  if (unitType === "STRIP") return t("pos.unitNounStrip");
  return t("pos.unitNounBox");
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
    return `${t("pos.available")}: ${parts.strips} ${stripWord} + ${parts.pieces} ${t("pos.pieces")}.`;
  }
  if (parts.kind === "strips_only") {
    const stripWord =
      parts.strips === 1 ? t("pos.strip") : t("pos.strips");
    return `${t("pos.available")}: ${parts.strips} ${stripWord}.`;
  }
  return `${t("pos.available")}: ${parts.pieces} ${t("pos.pieces")}.`;
}

/**
 * Quantity & Packaging modal (Batch J) — modal content only; chrome stays locked.
 * Esc → Back to Batch Selection · Enter → Add to Sale.
 * Display labels localized; unitType / cart payload remain PIECE|STRIP|BOX.
 */
export function QuantityPackagingModal({
  product,
  batch,
  onBack,
  onClose,
  onAddToSale,
}: QuantityPackagingModalProps) {
  const { t } = useLocale();
  const { isOnline } = useConnectivity();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);

  const [options, setOptions] = useState<PackagingUnitOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [unitType, setUnitType] = useState<PackagingUnitType>("STRIP");
  const [qty, setQty] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadFailed(false);

    void (async () => {
      try {
        const units = await loadProductUnits(product.productId, {
          online: isOnline,
          nameHint: product.name,
        });
        if (cancelled) return;
        const next = buildPackagingOptions(
          units,
          batch.quantityOnHand,
          batch.sellPerBase,
        );
        setOptions(next);
        const def = defaultPackagingUnit(next);
        setUnitType(def);
        setQty(1);
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
    product.productId,
    product.name,
    batch.quantityOnHand,
    batch.sellPerBase,
    isOnline,
  ]);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const selected = options.find((o) => o.unitType === unitType) ?? null;
  const maxQty = selected?.enabled ? selected.maxQty : 0;
  const canAdd =
    Boolean(selected?.enabled) && qty >= 1 && qty <= maxQty && !loading;

  const clampQty = useCallback(
    (n: number, max: number) => {
      if (max < 1) return 1;
      return Math.min(max, Math.max(1, Math.trunc(n)));
    },
    [],
  );

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

  /** ←/→ cycle enabled packaging cards (skip insufficient stock). */
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

  const addToSale = useCallback(() => {
    if (!selected?.enabled || !canAdd) return;
    const unitQty = clampQty(qty, selected.maxQty);
    const unitPrice = selected.unitPrice;
    const line: CartLine = {
      id: crypto.randomUUID(),
      productId: product.productId,
      productName: product.name,
      genericName: product.genericName,
      manufacturer: product.manufacturer,
      strength: product.strength,
      form: product.form,
      batchId: batch.batchId,
      batchNumber: batch.batchNumber,
      expiryDate: batch.expiryDate,
      batchQtyOnHand: batch.quantityOnHand,
      unitType: selected.unitType,
      unitQty,
      unitPrice,
      lineTotal: lineTotal(unitPrice, unitQty),
      quantityBase: quantityBase(selected.factorToBase, unitQty),
      factorToBase: selected.factorToBase,
      maxUnitQty: selected.maxQty,
      sellPerBase: batch.sellPerBase,
      fefo: batch.status === "fefo",
    };
    onAddToSale(line);
  }, [
    selected,
    canAdd,
    qty,
    clampQty,
    product,
    batch,
    onAddToSale,
  ]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onBack();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      addToSale();
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

  const productLine = product.genericName
    ? `${product.name} (${product.genericName})`
    : product.name;

  const availableText = formatAvailableLocalized(
    batch.quantityOnHand,
    options,
    t,
  );
  const unitPrice = selected?.unitPrice ?? 0;
  const subtotal = selected ? lineTotal(unitPrice, clampQty(qty, maxQty || 1)) : 0;
  const noun = selected ? unitNoun(selected.unitType, t) : t("pos.unit");
  const showFefo = batch.status === "fefo";

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
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-xl outline-none"
      >
        <div className="flex items-center justify-between gap-3 bg-primary px-5 py-3.5 text-primary-foreground">
          <div className="flex min-w-0 items-center gap-2">
            <Package className="size-5 shrink-0 opacity-90" strokeWidth={1.75} aria-hidden />
            <h2 id={titleId} className="text-base font-bold tracking-tight">
              {t("pos.quantityPackaging")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-primary-foreground/90 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            aria-label={t("pos.close")}
          >
            <X className="size-5" strokeWidth={1.75} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-foreground">{productLine}</p>
            {product.manufacturer ? (
              <p className="mt-0.5 text-xs text-muted">{product.manufacturer}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/25 bg-primary/10 px-3 py-2.5 text-sm">
            <span className="font-semibold text-foreground">
              {t("pos.batchLabel")}: {batch.batchNumber}
            </span>
            <span className="text-muted" aria-hidden>
              ·
            </span>
            <span className="font-medium text-foreground">
              {t("pos.expLabel")}: {formatExpiryMonthYear(batch.expiryDate)}
            </span>
            {showFefo ? (
              <span className="ml-auto inline-flex items-center rounded-full bg-expiry-ok/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-expiry-ok uppercase">
                {t("pos.fefoRecommended")}
              </span>
            ) : null}
          </div>

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
                className="grid grid-cols-3 gap-2"
                role="listbox"
                aria-label={t("pos.packagingUnit")}
              >
                {options.map((opt) => {
                  const selectedCard = opt.unitType === unitType;
                  const title = unitTitle(opt.unitType, opt.factorToBase, t);
                  const nounOpt = unitNoun(opt.unitType, t);
                  return (
                    <button
                      key={opt.unitType}
                      type="button"
                      role="option"
                      aria-selected={selectedCard}
                      aria-disabled={!opt.enabled}
                      disabled={!opt.enabled}
                      onClick={() => selectUnit(opt)}
                      className={[
                        "relative flex flex-col items-start rounded-md border px-3 py-3 text-left transition-colors",
                        !opt.enabled
                          ? "cursor-not-allowed border-border bg-shell/80 text-muted opacity-70"
                          : selectedCard
                            ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/30"
                            : "border-border bg-surface text-foreground hover:border-primary/40",
                      ].join(" ")}
                    >
                      {selectedCard && opt.enabled ? (
                        <span className="absolute top-2 right-2 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="size-2.5" strokeWidth={3} aria-hidden />
                        </span>
                      ) : null}
                      <span
                        className={[
                          "text-sm font-semibold",
                          selectedCard && opt.enabled
                            ? "text-primary"
                            : "text-foreground",
                          !opt.enabled ? "text-muted" : "",
                        ].join(" ")}
                      >
                        {title}
                      </span>
                      {opt.enabled ? (
                        <span
                          className={[
                            "mt-1 text-xs tabular-nums",
                            selectedCard ? "text-primary" : "text-muted",
                          ].join(" ")}
                        >
                          {formatTaka(opt.unitPrice)} / {nounOpt}
                        </span>
                      ) : (
                        <span className="mt-1 text-xs text-muted">
                          {t("pos.insufficientStock")}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="mb-2 text-xs font-medium text-muted">
                    {availableText}
                  </p>
                  <div className="inline-flex items-center overflow-hidden rounded-md border border-border bg-surface">
                    <button
                      type="button"
                      onClick={() => bumpQty(-1)}
                      disabled={!canAdd || qty <= 1}
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
                </div>

                <div className="min-w-[9.5rem] rounded-md border border-border bg-shell/70 px-3 py-2.5 text-right">
                  <p className="text-[11px] text-muted">
                    {t("pos.unitPrice")}:{" "}
                    <span className="font-medium text-foreground">
                      {formatTaka(unitPrice)} / {noun}
                    </span>
                  </p>
                  <p className="mt-1 text-xs font-medium text-muted">
                    {t("cart.subtotal")}
                  </p>
                  <p className="text-xl font-bold tabular-nums text-accent">
                    {formatTaka(subtotal)}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="space-y-2 border-t border-border bg-shell/50 px-5 py-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5">
              <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 font-medium text-foreground">
                ←
              </kbd>
              <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 font-medium text-foreground">
                →
              </kbd>
              <span>{t("pos.unit")}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 font-medium text-foreground">
                ↑
              </kbd>
              <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 font-medium text-foreground">
                ↓
              </kbd>
              <span>{t("pos.qty")}</span>
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground hover:bg-shell focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <kbd className="rounded border border-border bg-canvas px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                Esc
              </kbd>
              {t("pos.backToBatchSelection")}
            </button>
            <button
              type="button"
              onClick={addToSale}
              disabled={!canAdd}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {t("pos.addToSale")}
              <kbd className="rounded border border-white/30 bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold">
                Enter
              </kbd>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
