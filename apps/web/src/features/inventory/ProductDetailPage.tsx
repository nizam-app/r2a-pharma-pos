import {
  BriefcaseMedical,
  CircleCheck,
  ClipboardCheck,
  Clock,
  GripVertical,
  Pencil,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocale, type MessageKey } from "@/i18n";
import { ApiError } from "@/lib/api";
import {
  formatCount,
  formatDetailDate,
  formatExpiryShort,
  formatPct,
  formatTaka,
  formatTime,
  utcTodayStart,
} from "@/lib/format";
import { useOwnerPath } from "@/lib/OwnerPathProvider";
import {
  fetchOwnerProduct,
  type InventoryEventType,
  type OwnerProductBatch,
  type OwnerProductDetail,
  type OwnerProductEvent,
  type OwnerProductUnit,
  type ProductLotStatus,
  type ProductUnitType,
} from "@/lib/ownerProduct";

const UNIT_KEYS: Record<ProductUnitType, MessageKey> = {
  PIECE: "sales.detail.unit.piece",
  STRIP: "sales.detail.unit.strip",
  BOX: "sales.detail.unit.box",
};

const LOT_STATUS_KEYS: Record<ProductLotStatus, MessageKey> = {
  fefo: "inventory.detail.status.fefo",
  active: "inventory.detail.status.active",
  expired: "inventory.detail.status.expired",
  empty: "inventory.detail.status.empty",
};

const EVENT_TITLE: Record<InventoryEventType, MessageKey> = {
  RECEIVE: "inventory.detail.activity.receive",
  SALE: "inventory.detail.activity.sale",
  ADJUST: "inventory.detail.activity.adjust",
};

/**
 * Product Details (Batch K). Content region only — chrome is Batch B.
 * Live GET /owner/products/:id. Edit Product / View Inventory History disabled.
 * Receive Stock → /inventory/:id/receive (Batch M).
 */
export function ProductDetailPage({ productId }: { productId: string }) {
  const { t } = useLocale();
  const { navigate } = useOwnerPath();
  const [product, setProduct] = useState<OwnerProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchOwnerProduct(productId)
      .then((payload) => {
        if (cancelled) return;
        setProduct(payload);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setProduct(null);
        setLoading(false);
        if (err instanceof ApiError && err.statusCode === 404) {
          setError(t("inventory.detail.notFound"));
        } else if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError(t("inventory.detail.error"));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [productId, reload, t]);

  return (
    <div className="w-full px-5 py-4">
      <nav
        aria-label={t("header.breadcrumb")}
        className="mb-3 text-sm text-muted"
      >
        <button
          type="button"
          className="hover:text-foreground hover:underline"
          onClick={() => navigate("/inventory")}
        >
          {t("nav.inventory")}
        </button>
        <span className="px-1.5">›</span>
        <span className="text-foreground">{t("inventory.detail.crumb")}</span>
      </nav>

      {loading && !product ? (
        <p className="text-sm text-muted">{t("inventory.detail.loading")}</p>
      ) : null}

      {error && !product ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
          <p className="text-destructive">{error}</p>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1 text-foreground hover:bg-canvas"
            onClick={() => setReload((n) => n + 1)}
          >
            {t("inventory.retry")}
          </button>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1 text-foreground hover:bg-canvas"
            onClick={() => navigate("/inventory")}
          >
            {t("inventory.detail.back")}
          </button>
        </div>
      ) : null}

      {product ? (
        <ProductDetailBody
          product={product}
          onReceive={() =>
            navigate(`/inventory/${encodeURIComponent(product.id)}/receive`)
          }
        />
      ) : null}
    </div>
  );
}

function ProductDetailBody({
  product,
  onReceive,
}: {
  product: OwnerProductDetail;
  onReceive: () => void;
}) {
  const { t } = useLocale();
  const { kpis } = product;
  const nearestDays = daysUntil(kpis.nearestExpiry);
  const subtitleParts = [product.genericName, product.manufacturer].filter(
    Boolean,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {product.name}
            </h1>
            <span
              className={
                product.isActive
                  ? "rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-700"
                  : "rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-600"
              }
            >
              {product.isActive
                ? t("inventory.detail.active")
                : t("inventory.detail.inactive")}
            </span>
            {product.coldChain ? (
              <span className="rounded bg-sky-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-sky-800">
                {t("inventory.coldChain")}
              </span>
            ) : null}
          </div>
          {subtitleParts.length > 0 ? (
            <p className="mt-1 text-sm text-muted">
              {subtitleParts.join(" | ")}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled
            title={t("inventory.detail.editSoon")}
            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-muted"
          >
            <Pencil className="size-3.5" strokeWidth={1.75} />
            {t("inventory.detail.edit")}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            onClick={onReceive}
          >
            <ShoppingCart className="size-3.5" strokeWidth={1.75} />
            {t("inventory.receiveStock")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-3">
        <section className="rounded-xl border border-border bg-surface p-5 xl:col-span-2">
          <h2 className=" text-2xl font-semibold text-foreground">
            {t("inventory.detail.summary")}
          </h2>
          <hr className="my-4 border-border" />
          <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
            <MetaField  
              label={t("inventory.detail.generic")}
              value={product.genericName}
            />
            <MetaField
              label={t("inventory.detail.manufacturer")}
              value={product.manufacturer}
            />
            <MetaField
              label={t("inventory.detail.strength")}
              value={product.strength}
            />
            <MetaField label={t("inventory.detail.form")} value={product.form} />
            <MetaField label={t("inventory.detail.sku")} value={product.sku} />
            <MetaField
              label={t("inventory.detail.barcode")}
              value={product.barcode}
            />
            <MetaField
              label={t("inventory.detail.primaryUnit")}
              value={t(UNIT_KEYS[product.primaryUnit])}
            />
          </div>
        </section>

        <FefoConversionPanel product={product} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label={t("inventory.detail.kpi.stock")}
          value={`${formatCount(kpis.currentStock)} ${t("inventory.pcs")}`}
        />
        <KpiCard
          label={t("inventory.detail.kpi.costValue")}
          value={formatTaka(kpis.stockCostValue)}
        />
        <KpiCard
          label={t("inventory.detail.kpi.retailValue")}
          value={formatTaka(kpis.retailStockValue)}
        />
        <KpiCard
          label={t("inventory.detail.kpi.margin")}
          value={
            kpis.averageMarginPct == null
              ? "—"
              : `${formatPct(kpis.averageMarginPct)}%`
          }
          valueClass="text-sky-600"
        />
        <KpiCard
          label={t("inventory.detail.kpi.activeBatches")}
          value={formatCount(kpis.activeBatchCount)}
        />
        <KpiCard
          label={t("inventory.detail.kpi.nearestExpiry")}
          value={
            kpis.nearestExpiry ? formatExpiryShort(kpis.nearestExpiry) : "—"
          }
          valueClass={
            nearestDays != null && nearestDays <= 30
              ? "text-destructive"
              : undefined
          }
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-3">
        <section className="overflow-hidden rounded-xl border border-border bg-surface xl:col-span-2">
          <h2 className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">
            {t("inventory.detail.batches")}
          </h2>
          {product.batches.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">
              {t("inventory.detail.batchesEmpty")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[48rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-slate-50 text-xs font-medium uppercase tracking-wide text-muted">
                    <th className="px-4 py-2.5 font-medium">
                      {t("inventory.detail.col.batch")}
                    </th>
                    <th className="px-3 py-2.5 font-medium">
                      {t("inventory.detail.col.expiry")}
                    </th>
                    <th className="px-3 py-2.5 font-medium">
                      {t("inventory.detail.col.qty")}
                    </th>
                    <th className="px-3 py-2.5 font-medium">
                      {t("inventory.detail.col.cost")}
                    </th>
                    <th className="px-3 py-2.5 font-medium">
                      {t("inventory.detail.col.sell")}
                    </th>
                    <th className="px-3 py-2.5 font-medium">
                      {t("inventory.detail.col.stockVal")}
                    </th>
                    <th className="px-3 py-2.5 font-medium">
                      {t("inventory.detail.col.fefo")}
                    </th>
                    <th className="px-3 py-2.5 pr-4 font-medium">
                      {t("inventory.detail.col.status")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {product.batches.map((lot) => (
                    <BatchRow key={lot.id} lot={lot} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <UnitHierarchyCard units={product.units} />
      </div>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          {t("inventory.detail.activity")}
        </h2>
        {product.events.length === 0 ? (
          <p className="text-sm text-muted">
            {t("inventory.detail.activity.empty")}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {product.events.map((event) => (
              <ActivityRow key={event.id} event={event} />
            ))}
          </ul>
        )}
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            disabled
            title={t("inventory.detail.historySoon")}
            className="inline-flex cursor-not-allowed items-center gap-1.5 text-sm font-medium text-muted"
          >
            <Clock className="size-3.5" strokeWidth={1.75} />
            {t("inventory.detail.history")}
          </button>
        </div>
      </section>
    </div>
  );
}

function MetaField({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-foreground">{value || "—"}</p>
    </div>
  );
}

function KpiCard({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <article className="rounded-xl border border-border bg-surface p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
        {label}
      </p>
      <p
        className={`mt-2 text-lg font-semibold tracking-tight ${valueClass ?? "text-foreground"}`}
      >
        {value}
      </p>
    </article>
  );
}

function FefoConversionPanel({ product }: { product: OwnerProductDetail }) {
  const { t } = useLocale();
  const fefo = product.fefo;
  const c = product.conversion;
  const parts: string[] = [];
  if (c.boxFactor && c.boxes > 0) {
    parts.push(`${formatCount(c.boxes)} ${t("inventory.detail.boxes")}`);
  }
  if (c.stripFactor && c.strips > 0) {
    parts.push(`${formatCount(c.strips)} ${t("inventory.detail.strips")}`);
  }
  if (c.remainderPcs > 0 || parts.length === 0) {
    parts.push(`${formatCount(c.remainderPcs)} ${t("inventory.pcs")}`);
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center gap-2">
        <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CircleCheck className="size-4" strokeWidth={2} />
        </span>
        <h2 className="text-sm font-semibold text-primary">
          {t("inventory.detail.fefoTitle")}
        </h2>
      </div>
      <p className="mt-1 text-xs text-muted">{t("inventory.detail.fefoHint")}</p>

      {fefo ? (
        <div className="mt-3 rounded-lg border border-primary/40 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-lg font-semibold tracking-tight text-primary">
                {fefo.batchNumber}
              </p>
              <p className="mt-0.5 text-sm text-foreground">
                {formatCount(fefo.quantityOnHand)}{" "}
                {t("inventory.detail.pcsAvailable")}
              </p>
            </div>
            <span className="shrink-0 rounded bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground">
              {t("inventory.detail.expires")} {formatExpiryShort(fefo.expiryDate)}
            </span>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">{t("inventory.detail.fefoEmpty")}</p>
      )}

      <div className="mt-4 rounded-lg border border-border bg-canvas p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
          {t("inventory.detail.conversionDisplay")}
        </p>
        <p className="mt-2 text-sm font-semibold text-foreground">
          {t("inventory.detail.totalStock")} {formatCount(c.totalBase)}{" "}
          {t("inventory.detail.unitPieces")}
        </p>
        <p className="mt-1 text-sm font-medium text-primary">
          {t("inventory.detail.equivalent")} {parts.join(" + ")}
        </p>
        {c.stripFactor || c.boxFactor ? (
          <p className="mt-2 text-[11px] italic text-muted">
            {c.stripFactor
              ? `${t("inventory.detail.stripEq")} ${formatCount(c.stripFactor)} ${t("inventory.detail.unitPieces")}`
              : null}
            {c.stripFactor && c.boxFactor ? " / " : null}
            {c.boxFactor
              ? `${t("inventory.detail.boxEq")} ${c.stripsPerBox != null
                ? `${formatCount(c.stripsPerBox)} ${t("inventory.detail.strips")} = `
                : ""
              }${formatCount(c.boxFactor)} ${t("inventory.detail.unitPieces")}`
              : null}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function BatchRow({ lot }: { lot: OwnerProductBatch }) {
  const { t } = useLocale();
  const muted = lot.status === "expired" || lot.status === "empty";
  return (
    <tr
      className={`border-b border-border last:border-b-0 ${muted ? "text-muted" : "text-foreground"}`}
    >
      <td className="px-4 py-3 font-medium">{lot.batchNumber}</td>
      <td className="px-3 py-3">{formatExpiryShort(lot.expiryDate)}</td>
      <td className="px-3 py-3">
        {formatCount(lot.quantityOnHand)} {t("inventory.pcs")}
      </td>
      <td className="px-3 py-3">{formatTaka(lot.costPerBase)}</td>
      <td className="px-3 py-3">{formatTaka(lot.sellPerBase)}</td>
      <td className="px-3 py-3">{formatTaka(lot.stockValue)}</td>
      <td className="px-3 py-3">
        {lot.fefoRank != null ? formatCount(lot.fefoRank) : "—"}
      </td>
      <td className="px-3 py-3 pr-4">
        <LotStatusBadge status={lot.status} />
      </td>
    </tr>
  );
}

function LotStatusBadge({ status }: { status: ProductLotStatus }) {
  const { t } = useLocale();
  const cls =
    status === "fefo"
      ? "bg-red-50 text-red-700"
      : status === "active"
        ? "bg-emerald-50 text-emerald-800"
        : "bg-slate-100 text-slate-600";
  return (
    <span
      className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {t(LOT_STATUS_KEYS[status])}
    </span>
  );
}

const UNIT_ICONS: Record<ProductUnitType, LucideIcon> = {
  PIECE: BriefcaseMedical,
  STRIP: GripVertical,
  BOX: ClipboardCheck,
};

function UnitHierarchyCard({ units }: { units: OwnerProductUnit[] }) {
  const { t } = useLocale();
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="text-base font-semibold text-foreground">
        {t("inventory.detail.units")}
      </h2>
      <p className="mt-0.5 text-xs text-muted">{t("inventory.detail.unitsHint")}</p>
      <div className="mt-3 border-t border-border pt-4">
        {units.length === 0 ? (
          <p className="text-sm text-muted">{t("inventory.detail.unitsEmpty")}</p>
        ) : (
          <ul className="flex flex-col">
            {units.map((unit, i) => (
              <UnitRow
                key={unit.unitType}
                unit={unit}
                last={i === units.length - 1}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function UnitRow({
  unit,
  last,
}: {
  unit: OwnerProductUnit;
  last: boolean;
}) {
  const { t } = useLocale();
  const Icon = UNIT_ICONS[unit.unitType];
  const badge = unit.isPrimary
    ? t("inventory.detail.unit.primary")
    : [
      `${formatCount(unit.factorToBase)} ${t("inventory.detail.pcsCap")}`,
      unit.stripsEquivalent != null
        ? `${formatCount(unit.stripsEquivalent)} ${t("inventory.detail.stripsCap")}`
        : null,
    ]
      .filter(Boolean)
      .join(" / ");
  const qtyLabel = unit.isPrimary
    ? `${formatCount(unit.factorToBase)} ${unit.factorToBase === 1
      ? t("inventory.detail.pieceOne")
      : t("inventory.detail.unitPieces")
    }`
    : null;

  return (
    <li className={`flex gap-3 ${last ? "" : "pb-3"}`}>
      <div className="flex flex-col items-center">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-primary">
          <Icon className="size-4" strokeWidth={1.75} />
        </span>
        {last ? null : <span className="mt-1 w-px flex-1 bg-border" />}
      </div>
      <div className="min-w-0 flex-1 rounded-lg bg-canvas px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-foreground">
            {t(UNIT_KEYS[unit.unitType])}
          </p>
          <span
            className={
              unit.isPrimary
                ? "shrink-0 rounded bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground"
                : "shrink-0 rounded border border-border bg-surface px-2 py-0.5 text-[10px] font-medium text-muted"
            }
          >
            {badge}
          </span>
        </div>
        <div className="mt-1.5 flex items-baseline justify-between gap-2 text-xs text-muted">
          <span>
            {qtyLabel ? (
              qtyLabel
            ) : (
              <>
                {t("inventory.detail.unit.cost")} {formatTaka(unit.cost)}
              </>
            )}
          </span>
          <span>
            {t("inventory.detail.unit.sell")} {formatTaka(unit.sell)}
          </span>
        </div>
      </div>
    </li>
  );
}

function ActivityRow({ event }: { event: OwnerProductEvent }) {
  const { t } = useLocale();
  const abs = Math.abs(event.quantityBaseChange);
  const signed =
    event.quantityBaseChange > 0
      ? `+${formatCount(abs)}`
      : event.quantityBaseChange < 0
        ? `−${formatCount(abs)}`
        : formatCount(0);
  const verb =
    event.type === "RECEIVE"
      ? t("inventory.detail.activity.added")
      : event.type === "SALE"
        ? t("inventory.detail.activity.removed")
        : t("inventory.detail.activity.adjusted");

  return (
    <li className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">
          {t(EVENT_TITLE[event.type])}
        </p>
        <p className="mt-0.5 text-sm text-muted">
          {signed} {t("inventory.pcs")} {verb}
          {event.batchNumber ? (
            <>
              {" "}
              {t("inventory.detail.activity.batch")} {event.batchNumber}
            </>
          ) : null}
          {event.note ? (
            <>
              {" "}
              {t("inventory.detail.activity.reason")} {event.note}
            </>
          ) : null}
        </p>
      </div>
      <p className="shrink-0 text-xs text-muted">
        {formatDetailDate(event.createdAt)} {t("sales.detail.at")}{" "}
        {formatTime(event.createdAt)}
      </p>
    </li>
  );
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const e = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const t = utcTodayStart().getTime();
  return Math.round((e - t) / 86_400_000);
}
