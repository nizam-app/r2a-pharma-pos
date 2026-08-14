import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { Search } from "lucide-react";
import { useConnectivity } from "@/features/shell/ConnectivityProvider";
import { useLocalDb } from "@/features/shell/LocalDbProvider";
import { PosToast, type PosToastTone } from "@/features/shell/PosToast";
import { useLocale } from "@/i18n";
import {
  isDuplicateBatchError,
  listReceiveBatches,
  patchReceiveQty,
  postReceiveLot,
  receiveErrorMessage,
  searchReceiveProducts,
  type ReceiveBatchRow,
  type ReceiveProductHit,
} from "@/lib/receiveStock";

type ReceiveMode = "add" | "adjust";

type ToastState = { message: string; tone: PosToastTone };

const inputClass =
  "mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:bg-shell disabled:text-muted";

function parseNonNegInt(raw: string): number | null {
  const s = raw.trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

function parseNonNegNumber(raw: string): number | null {
  const s = raw.trim();
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function isYmd(raw: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(raw.trim());
}

/**
 * Settings → Receive stock form (M5 Batch C).
 * Owner/Manager only (parent omits the section for Cashier).
 * Online POST /batches + PATCH qty; catalogPull after save. No GRN queue.
 * ↑/↓ fields · Enter save / pick · Esc handled by Settings. No Tab nav.
 */
export function ReceiveStockSection() {
  const { t } = useLocale();
  const { mode, forcedOffline } = useConnectivity();
  const { pullCacheNow } = useLocalDb();
  const titleId = useId();
  const productListId = useId();
  const batchListId = useId();

  const online = mode === "online" && !forcedOffline;

  const [receiveMode, setReceiveMode] = useState<ReceiveMode>("add");
  const [query, setQuery] = useState("");
  const [productHits, setProductHits] = useState<ReceiveProductHit[]>([]);
  const [productFocus, setProductFocus] = useState(0);
  const [productLoading, setProductLoading] = useState(false);
  const [product, setProduct] = useState<ReceiveProductHit | null>(null);

  const [batchNumber, setBatchNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [qty, setQty] = useState("");
  const [costPerBase, setCostPerBase] = useState("");
  const [sellPerBase, setSellPerBase] = useState("");

  const [batches, setBatches] = useState<ReceiveBatchRow[]>([]);
  const [batchFocus, setBatchFocus] = useState(0);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<ReceiveBatchRow | null>(
    null,
  );

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const modeAddRef = useRef<HTMLButtonElement>(null);
  const modeAdjustRef = useRef<HTMLButtonElement>(null);
  const productSearchRef = useRef<HTMLInputElement>(null);
  const clearProductRef = useRef<HTMLButtonElement>(null);
  const batchNumberRef = useRef<HTMLInputElement>(null);
  const expiryRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const costRef = useRef<HTMLInputElement>(null);
  const sellRef = useRef<HTMLInputElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);

  const showToast = useCallback((message: string, tone: PosToastTone) => {
    setToast({ message, tone });
  }, []);

  const blockIfOffline = useCallback((): boolean => {
    if (online) return false;
    showToast(t("settings.receiveStockOffline"), "info");
    return true;
  }, [online, showToast, t]);

  useEffect(() => {
    queueMicrotask(() => productSearchRef.current?.focus());
  }, []);

  useEffect(() => {
    if (product) {
      setQuery("");
      setProductHits([]);
      return;
    }
    const needle = query.trim();
    if (!needle) {
      setProductHits([]);
      setProductLoading(false);
      setProductFocus(0);
      return;
    }
    if (!online) {
      setProductHits([]);
      setProductLoading(false);
      setProductFocus(0);
      return;
    }
    let cancelled = false;
    setProductLoading(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const list = await searchReceiveProducts(needle);
          if (cancelled) return;
          setProductHits(list);
          setProductFocus(0);
        } catch {
          if (cancelled) return;
          setProductHits([]);
        } finally {
          if (!cancelled) setProductLoading(false);
        }
      })();
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, product, online]);

  useEffect(() => {
    if (receiveMode !== "adjust" || !product) {
      setBatches([]);
      setSelectedBatch(null);
      return;
    }
    if (!online) {
      setBatches([]);
      setBatchesLoading(false);
      return;
    }
    let cancelled = false;
    setBatchesLoading(true);
    setSelectedBatch(null);
    void (async () => {
      try {
        const list = await listReceiveBatches(product.id);
        if (cancelled) return;
        setBatches(list);
        setBatchFocus(0);
      } catch {
        if (cancelled) return;
        setBatches([]);
      } finally {
        if (!cancelled) setBatchesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [receiveMode, product, online]);

  const clearProduct = useCallback(() => {
    setProduct(null);
    setSelectedBatch(null);
    setBatches([]);
    setQuery("");
    setProductHits([]);
    queueMicrotask(() => productSearchRef.current?.focus());
  }, []);

  const selectProduct = useCallback((hit: ReceiveProductHit) => {
    setProduct(hit);
    setQuery("");
    setProductHits([]);
    setSelectedBatch(null);
    queueMicrotask(() => {
      if (receiveMode === "add") batchNumberRef.current?.focus();
      else qtyRef.current?.focus();
    });
  }, [receiveMode]);

  const selectBatch = useCallback((row: ReceiveBatchRow) => {
    setSelectedBatch(row);
    setQty(String(row.quantityOnHand));
    queueMicrotask(() => qtyRef.current?.focus());
  }, []);

  const switchMode = useCallback((next: ReceiveMode) => {
    setReceiveMode(next);
    setSelectedBatch(null);
    setBatchNumber("");
    setExpiryDate("");
    setQty("");
    setCostPerBase("");
    setSellPerBase("");
  }, []);

  const collectFocusables = useCallback((): HTMLElement[] => {
    const els: HTMLElement[] = [];
    const push = (ref: RefObject<HTMLElement | null>) => {
      if (ref.current) els.push(ref.current);
    };
    push(modeAddRef);
    push(modeAdjustRef);
    if (product) push(clearProductRef);
    else push(productSearchRef);
    if (receiveMode === "add") {
      push(batchNumberRef);
      push(expiryRef);
      push(qtyRef);
      push(costRef);
      push(sellRef);
    } else {
      push(qtyRef);
    }
    push(saveRef);
    return els;
  }, [product, receiveMode]);

  const productPickerOpen = !product && productHits.length > 0;
  const batchPickerOpen =
    receiveMode === "adjust" &&
    product != null &&
    selectedBatch == null &&
    batches.length > 0;

  const save = useCallback(async () => {
    if (saving) return;
    if (blockIfOffline()) return;

    if (!product) {
      showToast(t("settings.receiveStockNeedProduct"), "error");
      productSearchRef.current?.focus();
      return;
    }

    if (receiveMode === "add") {
      const number = batchNumber.trim();
      if (!number) {
        showToast(t("settings.receiveStockNeedBatchNumber"), "error");
        batchNumberRef.current?.focus();
        return;
      }
      if (!isYmd(expiryDate)) {
        showToast(t("settings.receiveStockNeedExpiry"), "error");
        expiryRef.current?.focus();
        return;
      }
      const qtyN = parseNonNegInt(qty);
      if (qtyN == null) {
        showToast(t("settings.receiveStockNeedQty"), "error");
        qtyRef.current?.focus();
        return;
      }
      const costN = parseNonNegNumber(costPerBase);
      if (costN == null) {
        showToast(t("settings.receiveStockNeedCost"), "error");
        costRef.current?.focus();
        return;
      }
      const sellN = parseNonNegNumber(sellPerBase);
      if (sellN == null) {
        showToast(t("settings.receiveStockNeedSell"), "error");
        sellRef.current?.focus();
        return;
      }
      setSaving(true);
      try {
        await postReceiveLot({
          productId: product.id,
          batchNumber: number,
          expiryDate: expiryDate.trim(),
          quantityOnHand: qtyN,
          costPerBase: costN,
          sellPerBase: sellN,
        });
        await pullCacheNow();
        showToast(t("settings.receiveStockLotSaved"), "success");
        setBatchNumber("");
        setExpiryDate("");
        setQty("");
        setCostPerBase("");
        setSellPerBase("");
        queueMicrotask(() => batchNumberRef.current?.focus());
      } catch (err) {
        if (isDuplicateBatchError(err)) {
          showToast(t("settings.receiveStockDuplicate"), "error");
        } else {
          showToast(
            receiveErrorMessage(err, t("settings.receiveStockSaveFailed")),
            "error",
          );
        }
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!selectedBatch) {
      showToast(t("settings.receiveStockNeedBatch"), "error");
      return;
    }
    const qtyN = parseNonNegInt(qty);
    if (qtyN == null) {
      showToast(t("settings.receiveStockNeedQty"), "error");
      qtyRef.current?.focus();
      return;
    }
    setSaving(true);
    try {
      await patchReceiveQty(selectedBatch.id, qtyN);
      await pullCacheNow();
      showToast(t("settings.receiveStockQtySaved"), "success");
      setSelectedBatch({ ...selectedBatch, quantityOnHand: qtyN });
      setBatches((prev) =>
        prev.map((b) =>
          b.id === selectedBatch.id ? { ...b, quantityOnHand: qtyN } : b,
        ),
      );
    } catch (err) {
      showToast(
        receiveErrorMessage(err, t("settings.receiveStockSaveFailed")),
        "error",
      );
    } finally {
      setSaving(false);
    }
  }, [
    saving,
    blockIfOffline,
    product,
    receiveMode,
    batchNumber,
    expiryDate,
    qty,
    costPerBase,
    sellPerBase,
    selectedBatch,
    pullCacheNow,
    showToast,
    t,
  ]);

  const onKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      const active = document.activeElement;
      if (active === modeAddRef.current || active === modeAdjustRef.current) {
        event.preventDefault();
        event.stopPropagation();
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          const next = active === modeAddRef.current ? "adjust" : "add";
          if (next === "add") modeAddRef.current?.focus();
          else modeAdjustRef.current?.focus();
        }
        return;
      }
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (productPickerOpen) {
        event.preventDefault();
        event.stopPropagation();
        const delta = event.key === "ArrowDown" ? 1 : -1;
        setProductFocus(
          (i) => (i + delta + productHits.length) % productHits.length,
        );
        return;
      }
      if (batchPickerOpen) {
        event.preventDefault();
        event.stopPropagation();
        const delta = event.key === "ArrowDown" ? 1 : -1;
        setBatchFocus((i) => (i + delta + batches.length) % batches.length);
        return;
      }

      const els = collectFocusables();
      const active = document.activeElement;
      let idx = els.findIndex((el) => el === active);
      if (idx < 0) return;
      event.preventDefault();
      event.stopPropagation();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      const next = (idx + delta + els.length) % els.length;
      els[next]?.focus();
      return;
    }

    if (event.key === "Enter") {
      const active = document.activeElement;
      if (active === modeAddRef.current) {
        event.preventDefault();
        event.stopPropagation();
        switchMode("add");
        return;
      }
      if (active === modeAdjustRef.current) {
        event.preventDefault();
        event.stopPropagation();
        switchMode("adjust");
        return;
      }
      if (productPickerOpen) {
        const hit = productHits[productFocus];
        if (hit) {
          event.preventDefault();
          event.stopPropagation();
          selectProduct(hit);
        }
        return;
      }
      if (batchPickerOpen) {
        const row = batches[batchFocus];
        if (row) {
          event.preventDefault();
          event.stopPropagation();
          selectBatch(row);
        }
      }
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (productPickerOpen) {
      const hit = productHits[productFocus];
      if (hit) selectProduct(hit);
      return;
    }
    if (batchPickerOpen) {
      const row = batches[batchFocus];
      if (row) selectBatch(row);
      return;
    }
    void save();
  };

  const modeBtnClass = (id: ReceiveMode) =>
    [
      "min-w-[8rem] rounded-md border px-4 py-2.5 text-sm font-medium transition-colors",
      receiveMode === id
        ? "border-primary bg-primary text-primary-foreground shadow-sm"
        : "border-border bg-surface text-foreground hover:bg-shell",
    ].join(" ");

  const productEmptyHint = !online
    ? t("settings.receiveStockOffline")
    : !query.trim()
      ? t("settings.receiveStockProductHint")
      : productLoading
        ? t("settings.receiveStockSearching")
        : t("settings.receiveStockNoProducts");

  return (
    <div
      className="mx-auto w-full max-w-lg"
      data-receive-form="true"
      data-receive-mode={receiveMode}
      onKeyDownCapture={onKeyDownCapture}
    >
      {toast ? (
        <PosToast
          message={toast.message}
          tone={toast.tone}
          onDismiss={() => setToast(null)}
        />
      ) : null}

      <h2 id={titleId} className="text-base font-semibold text-foreground">
        {t("settings.receiveStock")}
      </h2>
      <p className="mt-1.5 text-sm text-muted">
        {t("settings.receiveStockHelp")}
      </p>

      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <div
          className="flex flex-wrap gap-3"
          role="group"
          aria-label={t("settings.receiveStockModes")}
        >
          <button
            ref={modeAddRef}
            type="button"
            className={modeBtnClass("add")}
            aria-pressed={receiveMode === "add"}
            onClick={() => switchMode("add")}
          >
            {t("settings.receiveStockModeAdd")}
          </button>
          <button
            ref={modeAdjustRef}
            type="button"
            className={modeBtnClass("adjust")}
            aria-pressed={receiveMode === "adjust"}
            onClick={() => switchMode("adjust")}
          >
            {t("settings.receiveStockModeAdjust")}
          </button>
        </div>

        {product ? (
          <div className="rounded-md border border-border bg-shell/40 px-3 py-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              {t("settings.receiveStockProduct")}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">
              {product.name}
              {product.sku ? (
                <span className="ml-2 font-normal text-muted">{product.sku}</span>
              ) : null}
            </p>
            <button
              ref={clearProductRef}
              type="button"
              className="mt-1 text-xs font-medium text-primary hover:underline"
              onClick={clearProduct}
            >
              {t("settings.receiveStockChangeProduct")}
            </button>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-foreground">
              {t("settings.receiveStockProduct")}
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
                  strokeWidth={1.75}
                  aria-hidden
                />
                <input
                  ref={productSearchRef}
                  id="receive-product-search"
                  type="search"
                  className={`${inputClass} pl-10`}
                  value={query}
                  autoComplete="off"
                  placeholder={t("settings.receiveStockProductPlaceholder")}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </label>
            <div
              id={productListId}
              role="listbox"
              aria-label={t("settings.receiveStockProduct")}
              className="mt-1 max-h-40 overflow-auto rounded-md border border-border"
            >
              {productHits.length === 0 ? (
                <p className="px-3 py-3 text-sm text-muted">{productEmptyHint}</p>
              ) : (
                <ul className="divide-y divide-border">
                  {productHits.map((hit, index) => {
                    const selected = index === productFocus;
                    return (
                      <li
                        key={hit.id}
                        role="option"
                        aria-selected={selected}
                      >
                        <button
                          type="button"
                          className={[
                            "flex w-full items-center justify-between px-3 py-2 text-left text-sm",
                            selected ? "bg-primary/10 text-foreground" : "text-foreground hover:bg-shell",
                          ].join(" ")}
                          onMouseEnter={() => setProductFocus(index)}
                          onClick={() => selectProduct(hit)}
                        >
                          <span className="font-medium">{hit.name}</span>
                          {hit.sku ? (
                            <span className="text-xs text-muted">{hit.sku}</span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}

        {receiveMode === "add" ? (
          <>
            <label className="block text-sm font-medium text-foreground">
              {t("settings.receiveStockBatchNumber")}
              <input
                ref={batchNumberRef}
                type="text"
                className={inputClass}
                value={batchNumber}
                autoComplete="off"
                onChange={(e) => setBatchNumber(e.target.value)}
              />
            </label>
            <label className="block text-sm font-medium text-foreground">
              {t("settings.receiveStockExpiry")}
              <input
                ref={expiryRef}
                type="text"
                className={inputClass}
                value={expiryDate}
                autoComplete="off"
                placeholder={t("settings.receiveStockExpiryPlaceholder")}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
            </label>
            <label className="block text-sm font-medium text-foreground">
              {t("settings.receiveStockQty")}
              <input
                ref={qtyRef}
                type="text"
                inputMode="numeric"
                className={inputClass}
                value={qty}
                autoComplete="off"
                onChange={(e) => setQty(e.target.value)}
              />
            </label>
            <label className="block text-sm font-medium text-foreground">
              {t("settings.receiveStockCost")}
              <input
                ref={costRef}
                type="text"
                inputMode="decimal"
                className={inputClass}
                value={costPerBase}
                autoComplete="off"
                onChange={(e) => setCostPerBase(e.target.value)}
              />
            </label>
            <label className="block text-sm font-medium text-foreground">
              {t("settings.receiveStockSell")}
              <input
                ref={sellRef}
                type="text"
                inputMode="decimal"
                className={inputClass}
                value={sellPerBase}
                autoComplete="off"
                onChange={(e) => setSellPerBase(e.target.value)}
              />
            </label>
          </>
        ) : (
          <>
            {product ? (
              <div>
                <p className="text-sm font-medium text-foreground">
                  {t("settings.receiveStockPickBatch")}
                </p>
                {selectedBatch ? (
                  <div className="mt-1 rounded-md border border-border bg-shell/40 px-3 py-2">
                    <p className="text-sm font-semibold text-foreground">
                      {selectedBatch.batchNumber}
                    </p>
                    <p className="text-xs text-muted">
                      {selectedBatch.expiryDate} · {t("settings.receiveStockCurrentQty")}{" "}
                      {selectedBatch.quantityOnHand}
                    </p>
                    <button
                      type="button"
                      className="mt-1 text-xs font-medium text-primary hover:underline"
                      onClick={() => {
                        setSelectedBatch(null);
                        setQty("");
                      }}
                    >
                      {t("settings.receiveStockChangeBatch")}
                    </button>
                  </div>
                ) : (
                  <div
                    id={batchListId}
                    role="listbox"
                    aria-label={t("settings.receiveStockPickBatch")}
                    className="mt-1 max-h-40 overflow-auto rounded-md border border-border"
                  >
                    {batchesLoading ? (
                      <p className="px-3 py-3 text-sm text-muted">
                        {t("settings.receiveStockSearching")}
                      </p>
                    ) : batches.length === 0 ? (
                      <p className="px-3 py-3 text-sm text-muted">
                        {t("settings.receiveStockNoBatches")}
                      </p>
                    ) : (
                      <ul className="divide-y divide-border">
                        {batches.map((row, index) => {
                          const selected = index === batchFocus;
                          return (
                            <li
                              key={row.id}
                              role="option"
                              aria-selected={selected}
                            >
                              <button
                                type="button"
                                className={[
                                  "flex w-full items-center justify-between px-3 py-2 text-left text-sm",
                                  selected
                                    ? "bg-primary/10 text-foreground"
                                    : "text-foreground hover:bg-shell",
                                ].join(" ")}
                                onMouseEnter={() => setBatchFocus(index)}
                                onClick={() => selectBatch(row)}
                              >
                                <span className="font-medium">{row.batchNumber}</span>
                                <span className="text-xs tabular-nums text-muted">
                                  {row.expiryDate} · {row.quantityOnHand}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            ) : null}
            <label className="block text-sm font-medium text-foreground">
              {t("settings.receiveStockQty")}
              <input
                ref={qtyRef}
                type="text"
                inputMode="numeric"
                className={inputClass}
                value={qty}
                autoComplete="off"
                disabled={!selectedBatch}
                onChange={(e) => setQty(e.target.value)}
              />
            </label>
          </>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            ref={saveRef}
            type="submit"
            className="rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
            disabled={saving}
          >
            {saving
              ? t("settings.receiveStockSaving")
              : receiveMode === "add"
                ? t("settings.receiveStockSaveLot")
                : t("settings.receiveStockSaveQty")}
          </button>
        </div>
      </form>

      <p className="mt-8 text-xs text-muted">
        <kbd className="font-medium text-foreground">[Esc]</kbd>{" "}
        {t("settings.back")}
        {" · "}
        {t("settings.receiveStockFooter")}
      </p>
    </div>
  );
}
