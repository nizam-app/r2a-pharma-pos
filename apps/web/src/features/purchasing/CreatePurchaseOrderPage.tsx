import {
  AlertCircle,
  CalendarClock,
  Check,
  ClipboardList,
  Loader2,
  PackageCheck,
  PackagePlus,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  Truck,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocale } from "@/i18n";
import { ApiError } from "@/lib/api";
import { formatCount, formatTaka } from "@/lib/format";
import {
  fetchInventorySummary,
  fetchOwnerInventory,
  type InventoryRowStatus,
  type OwnerInventoryRow,
} from "@/lib/ownerInventory";
import { useOwnerPath } from "@/lib/OwnerPathProvider";
import { createPurchaseOrder } from "@/lib/purchaseOrders";
import { fetchActiveSuppliers, type SupplierOption } from "@/lib/suppliers";
import { useTenantChrome } from "@/lib/TenantContextProvider";

const SEARCH_LIMIT = 12;
const SUGGESTION_LIMIT = 25;

type LineDraft = {
  productId: string;
  name: string;
  genericName: string | null;
  sku: string | null;
  quantityOnHand: number;
  status: InventoryRowStatus;
  costPerBase: number | null;
  sellPerBase: number | null;
  qty: string;
  cost: string;
};

/**
 * Create Purchase Order (Batch U). Content region only — chrome is Batch B.
 * Live GET /owner/suppliers, GET /owner/inventory, GET /owner/inventory-summary,
 * and POST /owner/purchase-orders. Creating a PO never changes inventory.
 */
export function CreatePurchaseOrderPage() {
  const { t } = useLocale();
  const { navigate, setNavigationBlocker } = useOwnerPath();
  const { storeName } = useTenantChrome();

  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(true);
  const [suppliersError, setSuppliersError] = useState<string | null>(null);

  const [supplierId, setSupplierId] = useState("");
  const [reference, setReference] = useState("");
  const [expectedDelivery, setExpectedDelivery] = useState("");
  const [taxInput, setTaxInput] = useState("0");

  const [lines, setLines] = useState<LineDraft[]>([]);

  const [searchInput, setSearchInput] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [searchRows, setSearchRows] = useState<OwnerInventoryRow[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<OwnerInventoryRow[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  const [attention, setAttention] = useState({ lowStock: 0, outOfStock: 0 });

  const [submitting, setSubmitting] = useState<"DRAFT" | "SENT" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [pendingNavigation, setPendingNavigation] = useState<string | null>(
    null,
  );
  const bypassNavigation = useRef(false);

  const dirty =
    supplierId !== "" ||
    reference.trim() !== "" ||
    expectedDelivery !== "" ||
    taxInput !== "0" ||
    lines.length > 0;

  useEffect(() => {
    const blockNavigation = (to: string) => {
      if (bypassNavigation.current || !dirty) return true;
      setPendingNavigation(to);
      return false;
    };
    setNavigationBlocker(blockNavigation);
    return () => setNavigationBlocker(null);
  }, [dirty, setNavigationBlocker]);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  useEffect(() => {
    let cancelled = false;
    setSuppliersLoading(true);
    setSuppliersError(null);
    fetchActiveSuppliers()
      .then((items) => {
        if (cancelled) return;
        setSuppliers(items);
        setSuppliersLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setSuppliers([]);
        setSuppliersLoading(false);
        setSuppliersError(
          err instanceof ApiError ? err.message : t("purchasing.create.loadError"),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    fetchInventorySummary()
      .then((summary) => {
        if (cancelled) return;
        setAttention({
          lowStock: summary.lowStockCount,
          outOfStock: summary.outOfStockCount,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setAttention({ lowStock: 0, outOfStock: 0 });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearchQ(searchInput.trim());
    }, 250);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    if (!searchQ) {
      setSearchRows([]);
      setSearchLoading(false);
      return;
    }
    let cancelled = false;
    setSearchLoading(true);
    fetchOwnerInventory({ q: searchQ, tab: "all", limit: SEARCH_LIMIT, offset: 0 })
      .then((result) => {
        if (cancelled) return;
        setSearchRows(result.items);
        setSearchLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setSearchRows([]);
        setSearchLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [searchQ]);

  useEffect(() => {
    let cancelled = false;
    setSuggestionsLoading(true);
    void Promise.all([
      fetchOwnerInventory({ tab: "low", limit: SUGGESTION_LIMIT, offset: 0 }),
      fetchOwnerInventory({ tab: "out", limit: SUGGESTION_LIMIT, offset: 0 }),
    ])
      .then(([low, out]) => {
        if (cancelled) return;
        const merged = new Map<string, OwnerInventoryRow>();
        for (const row of [...low.items, ...out.items]) {
          if (!merged.has(row.productId)) merged.set(row.productId, row);
        }
        setSuggestions([...merged.values()]);
        setSuggestionsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setSuggestions([]);
        setSuggestionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const totals = useMemo(() => {
    let subtotal = 0;
    let validLines = 0;
    for (const line of lines) {
      const qty = Math.floor(Number(line.qty));
      const cost = Number(line.cost);
      if (Number.isFinite(qty) && qty > 0 && Number.isFinite(cost) && cost >= 0) {
        subtotal += qty * cost;
        validLines += 1;
      }
    }
    const tax = Number(taxInput);
    const taxAmount = Number.isFinite(tax) && tax > 0 ? tax : 0;
    return {
      itemCount: lines.length,
      validLines,
      subtotal: Math.round(subtotal * 100) / 100,
      tax: Math.round(taxAmount * 100) / 100,
      total: Math.round((subtotal + taxAmount) * 100) / 100,
    };
  }, [lines, taxInput]);

  function addLine(row: OwnerInventoryRow) {
    setLines((current) => {
      if (current.some((l) => l.productId === row.productId)) return current;
      return [
        ...current,
        {
          productId: row.productId,
          name: row.name,
          genericName: row.genericName,
          sku: row.sku,
          quantityOnHand: row.quantityOnHand,
          status: row.status,
          costPerBase: row.costPerBase,
          sellPerBase: row.sellPerBase,
          qty: "1",
          cost: row.costPerBase != null ? String(row.costPerBase) : "0",
        },
      ];
    });
    setSearchOpen(false);
  }

  function updateLine(productId: string, patch: Partial<Pick<LineDraft, "qty" | "cost">>) {
    setLines((current) =>
      current.map((line) =>
        line.productId === productId ? { ...line, ...patch } : line,
      ),
    );
  }

  function removeLine(productId: string) {
    setLines((current) => current.filter((line) => line.productId !== productId));
  }

  function lineTotal(line: LineDraft): number {
    const qty = Math.floor(Number(line.qty));
    const cost = Number(line.cost);
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(cost) || cost < 0) {
      return 0;
    }
    return Math.round(qty * cost * 100) / 100;
  }

  function addAllSuggestions() {
    setLines((current) => {
      const next = [...current];
      for (const row of suggestions) {
        if (next.some((l) => l.productId === row.productId)) continue;
        next.push({
          productId: row.productId,
          name: row.name,
          genericName: row.genericName,
          sku: row.sku,
          quantityOnHand: row.quantityOnHand,
          status: row.status,
          costPerBase: row.costPerBase,
          sellPerBase: row.sellPerBase,
          qty: "1",
          cost: row.costPerBase != null ? String(row.costPerBase) : "0",
        });
      }
      return next;
    });
  }

  function buildSubmission() {
    const built: Array<{ productId: string; qtyOrdered: number; costPerBase: number }> =
      [];
    for (const line of lines) {
      const qty = Math.floor(Number(line.qty));
      const cost = Number(line.cost);
      if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(cost) || cost < 0) {
        continue;
      }
      built.push({ productId: line.productId, qtyOrdered: qty, costPerBase: cost });
    }
    return built;
  }

  async function handleSubmit(status: "DRAFT" | "SENT") {
    if (!supplierId) {
      setError(t("purchasing.create.supplierRequired"));
      return;
    }
    const builtLines = buildSubmission();
    if (builtLines.length === 0) {
      setError(t("purchasing.create.validation"));
      return;
    }
    setSubmitting(status);
    setError(null);
    try {
      const created = await createPurchaseOrder({
        supplierId,
        status,
        reference: reference || undefined,
        expectedDelivery: expectedDelivery || null,
        estimatedTax: totals.tax,
        lines: builtLines,
      });
      bypassNavigation.current = true;
      setNavigationBlocker(null);
      navigate(`/purchasing/${encodeURIComponent(created.id)}`);
    } catch (submitError: unknown) {
      setSubmitting(null);
      setError(
        submitError instanceof Error
          ? submitError.message
          : t("purchasing.create.submitError"),
      );
    }
  }

  function cancel() {
    bypassNavigation.current = true;
    setNavigationBlocker(null);
    navigate("/purchasing");
  }

  function discardChanges() {
    const target = pendingNavigation;
    bypassNavigation.current = true;
    setPendingNavigation(null);
    setNavigationBlocker(null);
    if (target) {
      window.history.pushState({}, "", target);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  }

  const addedIds = useMemo(() => new Set(lines.map((l) => l.productId)), [lines]);
  const visibleSuggestions = suggestions.filter((row) => !addedIds.has(row.productId));

  return (
    <div className="w-full px-5 py-4">
      {pendingNavigation ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 px-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={() => setPendingNavigation(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="unsaved-po-title"
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700">
                <AlertCircle className="size-5" />
              </span>
              <div>
                <h2 id="unsaved-po-title" className="text-lg font-semibold text-slate-950">
                  {t("purchasing.create.unsavedTitle")}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  {t("purchasing.create.unsavedBody")}
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                autoFocus
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => setPendingNavigation(null)}
              >
                {t("purchasing.create.keepEditing")}
              </button>
              <button
                type="button"
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                onClick={discardChanges}
              >
                {t("purchasing.create.discardChanges")}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <div className="mb-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          {t("purchasing.create.crumb")}
        </p>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {t("purchasing.create.title")}
            </h1>
            <p className="mt-1 text-sm text-muted">{t("purchasing.create.subtitle")}</p>
          </div>
        </div>
      </div>

      {error ? (
        <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          <section className="rounded-xl border border-border bg-surface p-5">
            <SectionHeader
              icon={<Truck className="size-4 text-primary" strokeWidth={1.75} />}
              title={t("purchasing.create.orderDetails")}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label={t("purchasing.create.supplier")} required>
                  {suppliersLoading ? (
                    <span className="inline-flex items-center gap-2 text-sm text-muted">
                      <Loader2 className="size-3.5 animate-spin" />
                      {t("purchasing.create.loading")}
                    </span>
                  ) : suppliersError ? (
                    <span className="flex flex-wrap items-center gap-2 text-sm text-destructive">
                      {suppliersError}
                      <button
                        type="button"
                        className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-canvas"
                        onClick={() => {
                          setSuppliersError(null);
                          setSuppliersLoading(true);
                          void fetchActiveSuppliers()
                            .then((items) => {
                              setSuppliers(items);
                              setSuppliersLoading(false);
                            })
                            .catch((err: unknown) => {
                              setSuppliers([]);
                              setSuppliersLoading(false);
                              setSuppliersError(
                                err instanceof ApiError
                                  ? err.message
                                  : t("purchasing.create.loadError"),
                              );
                            });
                        }}
                      >
                        {t("purchasing.create.retry")}
                      </button>
                    </span>
                  ) : (
                    <select
                      value={supplierId}
                      onChange={(event) => setSupplierId(event.target.value)}
                      className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                    >
                      <option value="">{t("purchasing.create.supplierPlaceholder")}</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                          {supplier.phone ? ` — ${supplier.phone}` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                  {!suppliersLoading && !suppliersError && suppliers.length === 0 ? (
                    <p className="mt-1 text-xs text-muted">
                      {t("purchasing.create.noActiveSuppliers")}
                    </p>
                  ) : null}
                </Field>
              </div>
              <Field label={t("purchasing.create.reference")}>
                <input
                  type="text"
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  placeholder={t("purchasing.create.referencePlaceholder")}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                />
              </Field>
              <Field label={t("purchasing.create.expectedDelivery")}>
                <input
                  type="date"
                  value={expectedDelivery}
                  onChange={(event) => setExpectedDelivery(event.target.value)}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                />
                <p className="mt-1 text-xs text-muted">{t("purchasing.create.expectedDeliveryHint")}</p>
              </Field>
              <div className="sm:col-span-2">
                <Field label={t("purchasing.create.tax")}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={taxInput}
                    onChange={(event) => setTaxInput(event.target.value)}
                    placeholder="0"
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
                  />
                  <p className="mt-1 text-xs text-muted">{t("purchasing.create.taxHint")}</p>
                </Field>
              </div>
            </div>
            <div className="mt-4 flex items-start gap-3 rounded-lg border border-border bg-canvas px-4 py-3">
              <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted" strokeWidth={1.75} />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {t("purchasing.create.branch")}
                </p>
                <p className="text-sm text-foreground">{storeName ?? t("header.storeUnavailable")}</p>
                <p className="mt-0.5 text-xs text-muted">{t("purchasing.create.branchLocked")}</p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-surface p-5">
            <SectionHeader
              icon={<ShoppingCart className="size-4 text-primary" strokeWidth={1.75} />}
              title={t("purchasing.create.items")}
              hint={t("purchasing.create.itemsHint")}
            />

            <div className="relative">
              <label className="relative block">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted"
                  strokeWidth={1.75}
                />
                <span className="sr-only">{t("purchasing.create.search")}</span>
                <input
                  type="search"
                  value={searchInput}
                  onFocus={() => setSearchOpen(true)}
                  onBlur={() => window.setTimeout(() => setSearchOpen(false), 150)}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder={t("purchasing.create.searchPlaceholder")}
                  className="w-full rounded-md border border-border bg-surface py-2 pl-8 pr-3 text-sm text-foreground placeholder:text-muted"
                />
              </label>
              {searchOpen && searchQ ? (
                <div className="absolute inset-x-0 z-20 mt-1 max-h-72 overflow-auto rounded-lg border border-border bg-surface shadow-xl">
                  {searchLoading ? (
                    <p className="px-3 py-3 text-sm text-muted">{t("purchasing.create.searchLoading")}</p>
                  ) : searchRows.length === 0 ? (
                    <p className="px-3 py-3 text-sm text-muted">{t("purchasing.create.searchEmpty")}</p>
                  ) : (
                    <ul>
                      {searchRows.map((row) => {
                        const inOrder = addedIds.has(row.productId);
                        return (
                          <li key={row.productId}>
                            <button
                              type="button"
                              disabled={inOrder}
                              onClick={() => addLine(row)}
                              className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium text-foreground">{row.name}</span>
                                <span className="block truncate text-xs text-muted">
                                  {[row.genericName, row.sku].filter(Boolean).join(" · ") || "—"}
                                </span>
                              </span>
                              <span className="inline-flex shrink-0 items-center gap-2">
                                <StockBadge row={row} />
                                {inOrder ? (
                                  <Check className="size-4 text-primary" strokeWidth={1.75} />
                                ) : (
                                  <Plus className="size-4 text-primary" strokeWidth={1.75} />
                                )}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>

            {lines.length === 0 ? (
              <p className="mt-4 rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
                {t("purchasing.create.emptyLines")}
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[44rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-slate-50 text-xs font-medium uppercase tracking-wide text-muted">
                      <th className="px-3 py-2 font-medium">{t("purchasing.create.col.product")}</th>
                      <th className="px-3 py-2 font-medium">{t("purchasing.create.col.stock")}</th>
                      <th className="px-3 py-2 font-medium">{t("purchasing.create.col.qty")}</th>
                      <th className="px-3 py-2 font-medium">{t("purchasing.create.col.cost")}</th>
                      <th className="px-3 py-2 text-right font-medium">{t("purchasing.create.col.total")}</th>
                      <th className="px-3 py-2 font-medium">{t("purchasing.create.col.action")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => (
                      <LineRow
                        key={line.productId}
                        line={line}
                        onQty={(value) => updateLine(line.productId, { qty: value })}
                        onCost={(value) => updateLine(line.productId, { cost: value })}
                        onRemove={() => removeLine(line.productId)}
                        total={lineTotal(line)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-5 border-t border-border pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground hover:bg-canvas"
                  onClick={() => setSuggestionsOpen((open) => !open)}
                >
                  <PackagePlus className="size-3.5 text-primary" strokeWidth={1.75} />
                  {t("purchasing.create.suggestions.title")}
                  {suggestionsLoading ? null : (
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                      {formatCount(visibleSuggestions.length)}
                    </span>
                  )}
                </button>
                {suggestionsOpen && visibleSuggestions.length > 0 ? (
                  <button
                    type="button"
                    className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-canvas"
                    onClick={addAllSuggestions}
                  >
                    {t("purchasing.create.suggestions.addAll")}
                  </button>
                ) : null}
              </div>
              {suggestionsOpen ? (
                <div className="mt-3">
                  <p className="text-xs text-muted">{t("purchasing.create.suggestions.hint")}</p>
                  {suggestionsLoading ? (
                    <p className="mt-2 text-sm text-muted">{t("purchasing.create.loading")}</p>
                  ) : visibleSuggestions.length === 0 ? (
                    <p className="mt-2 text-sm text-muted">{t("purchasing.create.suggestions.empty")}</p>
                  ) : (
                    <ul className="mt-2 flex flex-col">
                      {visibleSuggestions.map((row) => (
                        <li
                          key={row.productId}
                          className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-b-0"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-foreground">{row.name}</span>
                            <span className="block truncate text-xs text-muted">
                              {t("purchasing.create.suggestions.currentStock")}: {formatCount(row.quantityOnHand)} {t("inventory.pcs")}
                              {row.costPerBase != null ? ` · ${t("purchasing.create.suggestions.lastCost")}: ${formatTaka(row.costPerBase)}` : ""}
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            <StockBadge row={row} />
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground hover:bg-canvas"
                              onClick={() => addLine(row)}
                            >
                              <Plus className="size-3" strokeWidth={1.75} />
                              {t("purchasing.create.add")}
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-4">
          <section className="rounded-xl border border-border bg-surface p-5">
            <SectionHeader
              icon={<ClipboardList className="size-4 text-primary" strokeWidth={1.75} />}
              title={t("purchasing.create.summary.title")}
            />
            <dl className="mt-3 flex flex-col">
              <SummaryRow
                label={t("purchasing.create.summary.items")}
                value={formatCount(totals.itemCount)}
              />
              <SummaryRow
                label={t("purchasing.create.summary.subtotal")}
                value={formatTaka(totals.subtotal)}
              />
              <SummaryRow
                label={t("purchasing.create.summary.tax")}
                value={formatTaka(totals.tax)}
              />
              <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                <dt className="text-sm font-medium text-foreground">{t("purchasing.create.summary.total")}</dt>
                <dd className="text-lg font-semibold text-foreground">{formatTaka(totals.total)}</dd>
              </div>
            </dl>
            {totals.itemCount === 0 ? (
              <p className="mt-3 text-xs text-muted">{t("purchasing.create.summary.empty")}</p>
            ) : null}
          </section>

          <section className="rounded-xl border border-border bg-surface p-5">
            <SectionHeader
              icon={<PackageCheck className="size-4 text-primary" strokeWidth={1.75} />}
              title={t("purchasing.create.impact.title")}
            />
            <ul className="mt-3 flex flex-col">
              <AttentionRow
                icon={<PackageCheck className="size-4 text-red-600" strokeWidth={1.75} />}
                title={`${formatCount(attention.outOfStock)} ${t("purchasing.create.impact.outOfStock")}`}
                subtitle={t("purchasing.attention.outOfStockHint")}
              />
              <AttentionRow
                icon={<ClipboardList className="size-4 text-orange-600" strokeWidth={1.75} />}
                title={`${formatCount(attention.lowStock)} ${t("purchasing.create.impact.lowStock")}`}
                subtitle={t("purchasing.attention.lowStockHint")}
              />
            </ul>
            <p className="mt-3 text-xs text-muted">{t("purchasing.create.impact.hint")}</p>
          </section>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4">
        <button
          type="button"
          disabled={submitting !== null}
          onClick={cancel}
          className="rounded-md border border-border bg-surface px-5 py-2 text-sm font-medium text-foreground hover:bg-canvas disabled:opacity-50"
        >
          {t("purchasing.create.cancel")}
        </button>
        <button
          type="button"
          disabled={submitting !== null}
          onClick={() => handleSubmit("DRAFT")}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-5 py-2 text-sm font-medium text-foreground hover:bg-canvas disabled:opacity-50"
        >
          {submitting === "DRAFT" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <PackagePlus className="size-4" strokeWidth={1.75} />
          )}
          {submitting === "DRAFT"
            ? t("purchasing.create.savingDraft")
            : t("purchasing.create.saveDraft")}
        </button>
        <button
          type="button"
          disabled={submitting !== null}
          onClick={() => handleSubmit("SENT")}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting === "SENT" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Truck className="size-4" strokeWidth={1.75} />
          )}
          {submitting === "SENT"
            ? t("purchasing.create.submitting")
            : t("purchasing.create.submit")}
        </button>
      </div>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  hint,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <div className="mb-4 flex items-start gap-2 border-b border-border pb-3">
      <span className="mt-0.5">{icon}</span>
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-foreground">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function StockBadge({ row }: { row: { status: InventoryRowStatus } }) {
  const { t } = useLocale();
  if (row.status === "out") {
    return (
      <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
        {t("purchasing.create.lineStockOut")}
      </span>
    );
  }
  if (row.status === "low") {
    return (
      <span className="rounded bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
        {t("purchasing.create.lineStockLow")}
      </span>
    );
  }
  return null;
}

function LineRow({
  line,
  onQty,
  onCost,
  onRemove,
  total,
}: {
  line: LineDraft;
  onQty: (value: string) => void;
  onCost: (value: string) => void;
  onRemove: () => void;
  total: number;
}) {
  const { t } = useLocale();
  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="px-3 py-2.5">
        <p className="font-medium text-foreground">{line.name}</p>
        <p className="text-xs text-muted">
          {[line.genericName, line.sku].filter(Boolean).join(" · ") || "—"}
        </p>
      </td>
      <td className="px-3 py-2.5">
        <span className="flex flex-col gap-1">
          <span className="text-xs text-muted">
            {t("purchasing.create.lineStock")}: {formatCount(line.quantityOnHand)} {t("inventory.pcs")}
          </span>
          <StockBadge row={line} />
        </span>
      </td>
      <td className="px-3 py-2.5">
        <input
          type="number"
          min="1"
          step="1"
          value={line.qty}
          onChange={(event) => onQty(event.target.value)}
          aria-label={t("purchasing.create.col.qty")}
          className="w-24 rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-foreground outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
        />
      </td>
      <td className="px-3 py-2.5">
        <input
          type="number"
          min="0"
          step="0.01"
          value={line.cost}
          onChange={(event) => onCost(event.target.value)}
          aria-label={t("purchasing.create.col.cost")}
          className="w-28 rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-foreground outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
        />
      </td>
      <td className="px-3 py-2.5 text-right font-medium text-foreground">
        {formatTaka(total)}
      </td>
      <td className="px-3 py-2.5">
        <button
          type="button"
          onClick={onRemove}
          aria-label={t("purchasing.create.remove")}
          className="inline-flex items-center rounded-md border border-border bg-surface p-1.5 text-muted hover:bg-canvas hover:text-destructive"
        >
          <Trash2 className="size-3.5" strokeWidth={1.75} />
        </button>
      </td>
    </tr>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-b-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}

function AttentionRow({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <li className="flex items-start gap-3 py-2.5">
      <span className="mt-0.5">{icon}</span>
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted">{subtitle}</p>
      </div>
    </li>
  );
}