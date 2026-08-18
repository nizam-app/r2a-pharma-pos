import {
  AlertCircle,
  ArrowRight,
  Boxes,
  CalendarDays,
  CheckCircle2,
  Info,
  PackagePlus,
  ReceiptText,
} from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useLocale, type MessageKey } from "@/i18n";
import { ApiError } from "@/lib/api";
import { formatCount, formatDetailDate, formatPct, formatTaka, utcYmd } from "@/lib/format";
import { useOwnerPath } from "@/lib/OwnerPathProvider";
import {
  fetchOwnerProduct,
  receiveOwnerStock,
  type BatchReturnStatus,
  type OwnerProductDetail,
  type OwnerProductUnit,
  type ProductUnitType,
  type ReceiveStockPayload,
} from "@/lib/ownerProduct";
import { useTenantChrome } from "@/lib/TenantContextProvider";

const UNIT_KEYS: Record<ProductUnitType, MessageKey> = {
  PIECE: "sales.detail.unit.piece",
  STRIP: "sales.detail.unit.strip",
  BOX: "sales.detail.unit.box",
};

const INPUT_CLASS =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-teal-600 focus:ring-1 focus:ring-teal-600 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

function numericValue(value: string): number {
  return value.trim() === "" ? Number.NaN : Number(value);
}

function formatPackageQuantity(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function packagingBreakdown(
  quantity: number,
  units: OwnerProductUnit[],
): Array<{ unit: OwnerProductUnit; quantity: number }> {
  if (!Number.isInteger(quantity) || quantity <= 0) return [];
  let remaining = quantity;
  const result: Array<{ unit: OwnerProductUnit; quantity: number }> = [];
  const descending = [...units].sort((a, b) => b.factorToBase - a.factorToBase);

  for (const unit of descending) {
    const count = Math.floor(remaining / unit.factorToBase);
    if (count > 0 || (unit.unitType === "PIECE" && result.length === 0)) {
      result.push({ unit, quantity: count });
      remaining -= count * unit.factorToBase;
    }
  }
  return result;
}

/** Batch M: online Owner receive using the existing POST /api/v1/batches route. */
export function ReceiveStockPage({ productId }: { productId: string }) {
  const { t } = useLocale();
  const { navigate } = useOwnerPath();
  const { storeId, storeName } = useTenantChrome();
  const [product, setProduct] = useState<OwnerProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [batchNumber, setBatchNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [quantity, setQuantity] = useState("");
  const [costPerBase, setCostPerBase] = useState("");
  const [sellPerBase, setSellPerBase] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [returnStatus, setReturnStatus] =
    useState<BatchReturnStatus>("NOT_ELIGIBLE");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void fetchOwnerProduct(productId)
      .then((payload) => {
        if (cancelled) return;
        setProduct(payload);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoading(false);
        if (error instanceof ApiError && error.statusCode === 404) {
          setLoadError(t("inventory.receive.notFound"));
        } else if (error instanceof ApiError) {
          setLoadError(error.message);
        } else {
          setLoadError(t("inventory.receive.loadError"));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [productId, reload, t]);

  const quantityNumber = numericValue(quantity);
  const costNumber = numericValue(costPerBase);
  const sellNumber = numericValue(sellPerBase);
  const validQuantity = Number.isInteger(quantityNumber) && quantityNumber > 0;
  const validCost = Number.isFinite(costNumber) && costNumber >= 0;
  const validSell = Number.isFinite(sellNumber) && sellNumber >= 0;
  const totalCost = validQuantity && validCost ? quantityNumber * costNumber : 0;
  const retailValue = validQuantity && validSell ? quantityNumber * sellNumber : 0;
  const marginPct = validCost && validSell && sellNumber > 0
    ? ((sellNumber - costNumber) / sellNumber) * 100
    : null;
  const newStock = (product?.kpis.currentStock ?? 0) + (validQuantity ? quantityNumber : 0);
  const breakdown = product && validQuantity
    ? packagingBreakdown(quantityNumber, product.units)
    : [];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!product) return;
    if (!batchNumber.trim() || !expiryDate || !validQuantity || !validCost || !validSell) {
      setSubmitError(t("inventory.receive.validation"));
      return;
    }

    const payload: ReceiveStockPayload = {
      productId: product.id,
      ...(storeId ? { storeId } : {}),
      batchNumber: batchNumber.trim(),
      expiryDate,
      quantityOnHand: quantityNumber,
      costPerBase: costNumber,
      sellPerBase: sellNumber,
      ...(supplierName.trim() ? { supplierName: supplierName.trim() } : {}),
      returnStatus,
    };

    setSubmitting(true);
    setSubmitError(null);
    try {
      await receiveOwnerStock(payload);
      navigate(`/inventory/${encodeURIComponent(product.id)}`);
    } catch (error: unknown) {
      setSubmitting(false);
      if (error instanceof ApiError || error instanceof Error) {
        setSubmitError(error.message);
      } else {
        setSubmitError(t("inventory.receive.submitError"));
      }
    }
  }

  const productSubtitle = product
    ? [product.genericName, product.strength, product.manufacturer].filter(Boolean).join(" | ")
    : "";
  const primaryUnit = product?.units.find((unit) => unit.isPrimary) ?? product?.units[0];

  return (
    <div className="w-full px-5 py-4">
      <nav aria-label={t("header.breadcrumb")} className="mb-2 flex items-center gap-1.5 text-xs text-muted">
        <button type="button" className="hover:text-foreground hover:underline" onClick={() => navigate("/inventory")}>
          {t("nav.inventory")}
        </button>
        <span>›</span>
        {product ? (
          <>
            <button
              type="button"
              className="max-w-52 truncate hover:text-foreground hover:underline"
              onClick={() => navigate(`/inventory/${encodeURIComponent(product.id)}`)}
            >
              {product.name}
            </button>
            <span>›</span>
          </>
        ) : null}
        <span className="font-medium text-foreground">{t("inventory.receive.crumb")}</span>
      </nav>

      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("inventory.receive.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("inventory.receive.subtitle")}</p>
      </div>

      {loading && !product ? <p className="text-sm text-muted">{t("inventory.receive.loading")}</p> : null}

      {loadError && !product ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
          <AlertCircle className="size-4 text-destructive" />
          <p className="text-destructive">{loadError}</p>
          <button type="button" className="rounded-md border border-border px-3 py-1 hover:bg-canvas" onClick={() => setReload((value) => value + 1)}>
            {t("inventory.retry")}
          </button>
          <button type="button" className="rounded-md border border-border px-3 py-1 hover:bg-canvas" onClick={() => navigate("/inventory")}>
            {t("inventory.detail.back")}
          </button>
        </div>
      ) : null}

      {product ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3 border-b border-slate-100 pb-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-teal-100 bg-teal-50 text-teal-700">
                <PackagePlus className="size-5" />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold text-slate-950">{product.name}</h2>
                {productSubtitle ? <p className="mt-0.5 text-xs text-slate-500">{productSubtitle}</p> : null}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
              <ContextField label={t("inventory.receive.sku")} value={product.sku ?? "—"} />
              <ContextField label={t("inventory.receive.primaryUnit")} value={primaryUnit ? t(UNIT_KEYS[primaryUnit.unitType]) : "—"} />
              <ContextField label={t("inventory.receive.currentStock")} value={`${formatCount(product.kpis.currentStock)} ${t("inventory.pcs")}`} />
              <ContextField label={t("inventory.receive.activeBatches")} value={formatCount(product.kpis.activeBatchCount)} />
            </div>
          </section>

          {submitError ? (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          ) : null}

          <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
            <div className="space-y-4 xl:col-span-8">
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
                  <CalendarDays className="size-4 text-teal-600" />
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-800">{t("inventory.receive.receivingDetails")}</h2>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label={t("inventory.receive.receivedDate")}>
                    <input className={INPUT_CLASS} value={formatDetailDate(new Date().toISOString())} readOnly disabled />
                    <p className="mt-1 text-[11px] text-slate-500">{t("inventory.receive.receivedDateHint")}</p>
                  </Field>
                  <Field label={t("inventory.receive.store")}>
                    <input className={INPUT_CLASS} value={storeName ?? (storeId ? t("inventory.receive.currentStore") : t("inventory.receive.jwtStore"))} readOnly disabled />
                  </Field>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Boxes className="size-4 text-teal-600" />
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-800">{t("inventory.receive.batchDetails")}</h2>
                  </div>
                  <span className="rounded bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700">{t("inventory.receive.newBatch")}</span>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label={t("inventory.receive.batchNumber")} required>
                    <input
                      className={INPUT_CLASS}
                      value={batchNumber}
                      onChange={(event) => setBatchNumber(event.target.value)}
                      placeholder={t("inventory.receive.batchPlaceholder")}
                      required
                      autoFocus
                    />
                    <p className="mt-1 text-[11px] text-slate-500">{t("inventory.receive.batchHint")}</p>
                  </Field>
                  <Field label={t("inventory.receive.expiryDate")} required>
                    <input className={INPUT_CLASS} type="date" min={utcYmd(new Date())} value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} required />
                  </Field>
                  <Field label={t("inventory.receive.supplier")}>
                    <input
                      className={INPUT_CLASS}
                      value={supplierName}
                      maxLength={160}
                      onChange={(event) => setSupplierName(event.target.value)}
                      placeholder={t("inventory.receive.supplierPlaceholder")}
                    />
                  </Field>
                  <Field label={t("inventory.receive.returnEligibility")}>
                    <select
                      className={INPUT_CLASS}
                      value={returnStatus}
                      onChange={(event) =>
                        setReturnStatus(event.target.value as BatchReturnStatus)
                      }
                    >
                      <option value="NOT_ELIGIBLE">{t("inventory.expiry.return.notEligible")}</option>
                      <option value="ELIGIBLE">{t("inventory.expiry.return.eligible")}</option>
                      <option value="MANIFEST_PREPARED">{t("inventory.expiry.return.manifestPrepared")}</option>
                    </select>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {t("inventory.receive.returnHint")}
                    </p>
                  </Field>
                </div>

                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <Field label={t("inventory.receive.quantity")} required badge={t("inventory.receive.baseUnitPiece")}>
                    <div className="relative">
                      <input
                        className={`${INPUT_CLASS} pr-14`}
                        type="number"
                        min="1"
                        step="1"
                        value={quantity}
                        onChange={(event) => setQuantity(event.target.value)}
                        required
                      />
                      <span className="pointer-events-none absolute right-3 top-2 text-sm text-slate-500">{t("inventory.pcs")}</span>
                    </div>
                  </Field>
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label={t("inventory.receive.costPerPiece")} required>
                      <MoneyInput value={costPerBase} onChange={setCostPerBase} />
                    </Field>
                    <Field label={t("inventory.receive.sellPerPiece")} required>
                      <MoneyInput value={sellPerBase} onChange={setSellPerBase} />
                    </Field>
                  </div>
                </div>
              </section>
            </div>

            <aside className="space-y-4 xl:col-span-4">
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Boxes className="size-4 text-teal-600" />
                  <h2 className="text-sm font-semibold text-slate-900">{t("inventory.receive.packagingReference")}</h2>
                </div>
                <div className="divide-y divide-slate-100 text-sm">
                  {[...product.units]
                    .sort((a, b) => a.factorToBase - b.factorToBase)
                    .filter((unit) => unit.unitType !== "PIECE")
                    .map((unit) => (
                      <div key={unit.unitType} className="flex items-center justify-between gap-3 py-2.5">
                        <span>1 {t(UNIT_KEYS[unit.unitType])}</span>
                        <span className="text-right font-semibold text-slate-900">
                          {unit.unitType === "BOX" && unit.stripsEquivalent != null
                            ? `${formatCount(unit.stripsEquivalent)} ${t("inventory.detail.strips")} (${formatCount(unit.factorToBase)} ${t("inventory.pcs")})`
                            : `${formatCount(unit.factorToBase)} ${t("inventory.pcs")}`}
                        </span>
                      </div>
                    ))}
                </div>
                <div className="mt-3 rounded-md bg-slate-50 p-3">
                  <p className="text-[11px] text-slate-500">{t("inventory.receive.equivalentPackaging")}</p>
                  {breakdown.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {breakdown.map(({ unit, quantity: count }) => (
                        <span key={unit.unitType} className="rounded bg-white px-2 py-1 text-xs font-semibold text-slate-800 ring-1 ring-slate-200">
                          {formatPackageQuantity(count)} {t(UNIT_KEYS[unit.unitType])}
                        </span>
                      ))}
                    </div>
                  ) : <p className="mt-2 text-sm font-semibold text-slate-700">—</p>}
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <ReceiptText className="size-4 text-teal-600" />
                  <h2 className="text-sm font-semibold text-slate-900">{t("inventory.receive.summary")}</h2>
                </div>
                <SummaryRow label={t("inventory.receive.receivingQuantity")} value={validQuantity ? `${formatCount(quantityNumber)} ${t("inventory.pcs")}` : "—"} />
                <SummaryRow label={t("inventory.receive.unitCost")} value={validCost ? formatTaka(costNumber) : "—"} />
                <div className="my-1 border-t border-dashed border-slate-200" />
                <SummaryRow label={t("inventory.receive.totalCost")} value={validQuantity && validCost ? formatTaka(totalCost) : "—"} strong />
                <SummaryRow label={t("inventory.receive.retailValue")} value={validQuantity && validSell ? formatTaka(retailValue) : "—"} />
                <div className="mt-2 flex items-center justify-between rounded bg-slate-100 px-2.5 py-2 text-sm">
                  <span>{t("inventory.receive.margin")}</span>
                  <span className={marginPct != null && marginPct < 0 ? "font-semibold text-red-600" : "font-semibold text-teal-700"}>
                    {marginPct == null ? "—" : `${marginPct < 0 ? "-" : ""}${formatPct(marginPct)}%`}
                  </span>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="border-b border-slate-100 pb-3 text-sm font-semibold text-slate-900">{t("inventory.receive.stockImpact")}</h2>
                <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
                  <div>
                    <p className="text-[11px] text-slate-500">{t("inventory.receive.current")}</p>
                    <p className="mt-1 font-semibold text-slate-900">{formatCount(product.kpis.currentStock)}</p>
                  </div>
                  <div className="flex flex-col items-center gap-1 text-teal-700">
                    <ArrowRight className="size-4" />
                    <span className="rounded bg-teal-50 px-2 py-0.5 text-xs font-semibold">+{validQuantity ? formatCount(quantityNumber) : "0"}</span>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500">{t("inventory.receive.newTotal")}</p>
                    <p className="mt-1 font-semibold text-slate-950">{formatCount(newStock)}</p>
                  </div>
                </div>
              </section>
            </aside>
          </div>

          <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white/95 px-1 py-3 backdrop-blur">
            <p className="flex items-center gap-2 text-xs text-slate-500">
              <Info className="size-3.5" />
              {t("inventory.receive.confirmHint")}
            </p>
            <div className="flex items-center gap-2">
              <button type="button" disabled={submitting} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50" onClick={() => navigate(`/inventory/${encodeURIComponent(product.id)}`)}>
                {t("inventory.receive.cancel")}
              </button>
              <button type="submit" disabled={submitting || !validQuantity} className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50">
                {submitting ? <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <CheckCircle2 className="size-4" />}
                {submitting ? t("inventory.receive.submitting") : `${t("inventory.receive.submit")} ${validQuantity ? formatCount(quantityNumber) : "0"} ${t("inventory.pcs")}`}
              </button>
            </div>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function Field({ label, required, badge, children }: { label: string; required?: boolean; badge?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-2 text-xs font-medium text-slate-700">
        {label}{required ? <span className="text-red-500">*</span> : null}
        {badge ? <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-normal text-slate-600">{badge}</span> : null}
      </span>
      {children}
    </label>
  );
}

function MoneyInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-2 text-sm text-slate-500">৳</span>
      <input className={`${INPUT_CLASS} pl-7`} type="number" min="0" step="0.0001" value={value} onChange={(event) => onChange(event.target.value)} required />
    </div>
  );
}

function ContextField({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[11px] text-slate-500">{label}</p><p className="mt-1 truncate text-sm font-semibold text-slate-900">{value}</p></div>;
}

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className="flex items-center justify-between gap-3 py-2 text-sm"><span className="text-slate-600">{label}</span><span className={strong ? "font-bold text-slate-950" : "font-medium text-slate-900"}>{value}</span></div>;
}
