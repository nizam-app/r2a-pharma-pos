import {
  PackageCheck,
  Plus,
  ShoppingCart,
  Truck,
  Wallet,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useLocale } from "@/i18n";
import { ApiError } from "@/lib/api";
import {
  formatCount,
  formatPct,
  formatSalesDateTime,
  formatTaka,
  formatUtcDate,
} from "@/lib/format";
import { useOwnerPath } from "@/lib/OwnerPathProvider";
import {
  fetchSupplierDetail,
  type SupplierFull,
  type SupplierProductStatus,
  type SupplierStatus,
} from "@/lib/suppliers";

/**
 * Supplier Details (Batch Z). Content region only — chrome is Batch B.
 * Live GET /owner/suppliers/:supplierId (OWNER only). KPIs, performance, the
 * purchase-order table and the products-supplied table are honest values
 * computed from what exists — zeros / em dashes when there is no data, never
 * invented numbers. View All POs / View All Products stay disabled because the
 * Purchasing list and Inventory search cannot yet filter by supplier.
 */
export function SupplierDetailsPage({ supplierId }: { supplierId: string }) {
  const { t } = useLocale();
  const { navigate } = useOwnerPath();

  const [supplier, setSupplier] = useState<SupplierFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetchSupplierDetail(supplierId)
      .then((payload) => {
        if (cancelled) return;
        setSupplier(payload);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setSupplier(null);
        setLoading(false);
        if (err instanceof ApiError && err.statusCode === 404) {
          setError(t("suppliers.detail.notFound"));
        } else if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError(t("suppliers.detail.error"));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [supplierId, reload, t]);

  return (
    <div className="w-full px-5 py-4">
      <nav
        aria-label={t("header.breadcrumb")}
        className="mb-3 text-sm text-muted"
      >
        <button
          type="button"
          className="hover:text-foreground hover:underline"
          onClick={() => navigate("/suppliers")}
        >
          {t("nav.suppliers")}
        </button>
        <span className="px-1.5">›</span>
        <span className="text-foreground">
          {supplier?.name ?? t("suppliers.detail.crumb")}
        </span>
      </nav>

      {loading && !supplier ? (
        <p className="text-sm text-muted">{t("suppliers.loading")}</p>
      ) : null}

      {error && !supplier ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
          <p className="text-destructive">{error}</p>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1 text-foreground hover:bg-canvas"
            onClick={() => setReload((n) => n + 1)}
          >
            {t("suppliers.retry")}
          </button>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1 text-foreground hover:bg-canvas"
            onClick={() => navigate("/suppliers")}
          >
            {t("suppliers.detail.back")}
          </button>
        </div>
      ) : null}

      {supplier ? (
        <SupplierDetailBody supplier={supplier} onNavigate={navigate} />
      ) : null}
    </div>
  );
}

function SupplierDetailBody({
  supplier,
  onNavigate,
}: {
  supplier: SupplierFull;
  onNavigate: (to: string) => void;
}) {
  const { t } = useLocale();
  const { kpis, performance, purchaseOrders, products } = supplier.detail;

  const contactLine = [supplier.contactPerson, supplier.phone]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {supplier.name}
            </h1>
            <SupplierStatusBadge status={supplier.status} />
          </div>
          {contactLine ? (
            <p className="mt-1 text-sm text-muted">{contactLine}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-canvas"
            onClick={() => onNavigate("/suppliers/returns")}
          >
            <PackageCheck className="size-4 text-primary" strokeWidth={1.75} />
            {t("suppliers.expiryReturns")}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            onClick={() => onNavigate("/purchasing/new")}
          >
            <Plus className="size-4" strokeWidth={2} />
            {t("suppliers.detail.createPo")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={t("suppliers.detail.kpi.purchases12m")}
          value={formatTaka(kpis.purchases12m)}
          hint={t("suppliers.detail.kpi.purchases12mHint")}
          icon={<Wallet className="size-4 text-primary" strokeWidth={1.75} />}
        />
        <KpiCard
          label={t("suppliers.kpi.avgDelivery")}
          value={
            kpis.avgDeliveryDays != null
              ? `${kpis.avgDeliveryDays} ${t("suppliers.kpi.days")}`
              : "—"
          }
          hint={t("suppliers.kpi.avgDeliveryHint")}
          icon={<Truck className="size-4 text-primary" strokeWidth={1.75} />}
        />
        <KpiCard
          label={t("suppliers.detail.kpi.expiryReturnRate")}
          value={
            kpis.expiryReturnRatePct != null
              ? `${formatPct(kpis.expiryReturnRatePct)}%`
              : "—"
          }
          hint={t("suppliers.detail.kpi.expiryReturnRateHint")}
          icon={<PackageCheck className="size-4 text-primary" strokeWidth={1.75} />}
        />
        <KpiCard
          label={t("suppliers.col.activeProducts")}
          value={formatCount(kpis.activeProducts)}
          hint={t("suppliers.detail.kpi.activeProductsHint")}
          icon={<ShoppingCart className="size-4 text-primary" strokeWidth={1.75} />}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(220px,0.85fr)]">
        <SupplierInformation supplier={supplier} />
        <PerformanceCard performance={performance} />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.5fr_1fr]">
        <PurchaseOrdersCard
          purchaseOrders={purchaseOrders}
          onNavigate={onNavigate}
        />
        <ProductsSuppliedCard products={products} />
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: ReactNode;
}) {
  return (
    <article className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          {label}
        </p>
        <span className="text-muted">{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </article>
  );
}

function SectionHeader({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-2 border-b border-border pb-3">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
      </div>
    </div>
  );
}

function SupplierInformation({ supplier }: { supplier: SupplierFull }) {
  const { t } = useLocale();
  const { kpis } = supplier.detail;

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <SectionHeader title={t("suppliers.detail.info.title")} />
      <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
        <InfoRow
          label={t("suppliers.detail.info.supplier")}
          value={supplier.name}
          strong
        />
        <InfoRow
          label={t("suppliers.detail.info.contact")}
          value={supplier.contactPerson ?? "—"}
        />
        <InfoRow
          label={t("suppliers.detail.info.phone")}
          value={supplier.phone}
          href={supplier.phone ? `tel:${supplier.phone}` : null}
        />
        <InfoRow
          label={t("suppliers.detail.info.email")}
          value={supplier.email ?? "—"}
          href={supplier.email ? `mailto:${supplier.email}` : null}
        />
        <InfoRow
          label={t("suppliers.detail.info.lastPurchase")}
          value={
            kpis.lastPurchaseAt
              ? formatSalesDateTime(kpis.lastPurchaseAt)
              : "—"
          }
        />
        <InfoRow
          label={t("suppliers.detail.info.openOrders")}
          value={formatCount(kpis.openOrders)}
        />
        <InfoRow
          label={t("suppliers.detail.info.paymentTerms")}
          value={supplier.paymentTerms ?? "—"}
        />
        <InfoRow
          label={t("suppliers.detail.info.status")}
          value={<SupplierStatusBadge status={supplier.status} />}
        />
      </dl>
    </section>
  );
}

function InfoRow({
  label,
  value,
  href,
  strong,
}: {
  label: string;
  value: ReactNode;
  href?: string | null;
  strong?: boolean;
}) {
  const content = href ? (
    <a
      href={href}
      className="text-primary hover:text-primary hover:underline"
    >
      {value}
    </a>
  ) : (
    <span className={strong ? "font-medium text-foreground" : "text-foreground"}>
      {value}
    </span>
  );
  return (
    <div>
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="mt-1 text-sm">{content}</dd>
    </div>
  );
}

function PerformanceCard({
  performance,
}: {
  performance: SupplierFull["detail"]["performance"];
}) {
  const { t } = useLocale();

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <SectionHeader title={t("suppliers.detail.performance.title")} />
      <div className="flex flex-col gap-3">
        <PerformanceRow
          label={t("suppliers.detail.performance.onTime")}
          pct={performance.onTimeDeliveryPct}
          fillClass="bg-primary"
        />
        <PerformanceRow
          label={t("suppliers.detail.performance.shortSupply")}
          pct={performance.shortSupplyPct}
          fillClass="bg-accent"
        />
        <PerformanceRow
          label={t("suppliers.detail.performance.expiryAccepted")}
          pct={performance.expiryReturnsAcceptedPct}
          fillClass="bg-primary"
        />
        <div className="border-t border-border pt-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted">
              {t("suppliers.detail.performance.avgCreditNote")}
            </p>
            <p className="text-sm font-semibold text-foreground">
              {performance.avgCreditNoteDays != null
                ? `${performance.avgCreditNoteDays} ${t("suppliers.kpi.days")}`
                : "—"}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function PerformanceRow({
  label,
  pct,
  fillClass,
}: {
  label: string;
  pct: number | null;
  fillClass: string;
}) {
  const { t } = useLocale();
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-foreground">{label}</p>
        <p className="text-sm font-semibold text-foreground">
          {pct != null ? `${formatPct(pct)}%` : t("suppliers.detail.performance.noData")}
        </p>
      </div>
      <div className="mt-1.5 h-1 rounded-full bg-slate-200">
        <div
          className={`h-1 rounded-full ${fillClass}`}
          style={{ width: `${pct ?? 0}%` }}
        />
      </div>
    </div>
  );
}

function PurchaseOrdersCard({
  purchaseOrders,
  onNavigate,
}: {
  purchaseOrders: SupplierFull["detail"]["purchaseOrders"];
  onNavigate: (to: string) => void;
}) {
  const { t } = useLocale();

  return (
    <section className="rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
        <h2 className="text-sm font-semibold text-foreground">
          {t("suppliers.detail.po.title")}
        </h2>
        <button
          type="button"
          disabled
          aria-disabled="true"
          title={t("suppliers.detail.po.viewAllSoon")}
          className="inline-flex cursor-not-allowed items-center gap-1 rounded-md border border-border bg-canvas px-2.5 py-1 text-xs font-medium text-muted"
        >
          {t("suppliers.detail.po.viewAll")}
        </button>
      </div>
      {purchaseOrders.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-muted">{t("suppliers.detail.po.empty")}</p>
          <button
            type="button"
            className="mt-3 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            onClick={() => onNavigate("/purchasing/new")}
          >
            <Plus className="size-4" strokeWidth={2} />
            {t("suppliers.detail.createPo")}
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-canvas text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-2.5 font-medium">
                  {t("suppliers.detail.po.col.number")}
                </th>
                <th className="px-4 py-2.5 font-medium">
                  {t("suppliers.detail.po.col.created")}
                </th>
                <th className="px-4 py-2.5 font-medium">
                  {t("suppliers.detail.po.col.expected")}
                </th>
                <th className="px-4 py-2.5 font-medium">
                  {t("suppliers.detail.po.col.total")}
                </th>
                <th className="px-4 py-2.5 font-medium">
                  {t("suppliers.detail.po.col.status")}
                </th>
              </tr>
            </thead>
            <tbody>
              {purchaseOrders.map((po) => (
                <tr
                  key={po.id}
                  className="border-b border-border last:border-b-0 hover:bg-canvas"
                >
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      className="font-semibold text-primary hover:underline"
                      onClick={() =>
                        onNavigate(
                          `/purchasing/${encodeURIComponent(po.id)}`,
                        )
                      }
                    >
                      {po.poNumber}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {formatSalesDateTime(po.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {po.expectedDelivery
                      ? formatUtcDate(po.expectedDelivery)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {formatTaka(po.estimatedTotal)}
                  </td>
                  <td className="px-4 py-3">
                    <PoStatusBadge status={po.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ProductsSuppliedCard({
  products,
}: {
  products: SupplierFull["detail"]["products"];
}) {
  const { t } = useLocale();

  return (
    <section className="rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
        <h2 className="text-sm font-semibold text-foreground">
          {t("suppliers.detail.products.title")}
        </h2>
        <button
          type="button"
          disabled
          aria-disabled="true"
          title={t("suppliers.detail.products.viewAllSoon")}
          className="inline-flex cursor-not-allowed items-center gap-1 rounded-md border border-border bg-canvas px-2.5 py-1 text-xs font-medium text-muted"
        >
          {t("suppliers.detail.products.viewAll")}
        </button>
      </div>
      {products.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted">
          {t("suppliers.detail.products.empty")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-canvas text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-2.5 font-medium">
                  {t("suppliers.detail.products.col.medicine")}
                </th>
                <th className="px-4 py-2.5 font-medium">
                  {t("suppliers.detail.products.col.stock")}
                </th>
                <th className="px-4 py-2.5 font-medium">
                  {t("suppliers.detail.products.col.cost")}
                </th>
                <th className="px-4 py-2.5 font-medium">
                  {t("suppliers.detail.products.col.status")}
                </th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr
                  key={product.productId}
                  className="border-b border-border last:border-b-0 hover:bg-canvas"
                >
                  <td className="px-5 py-3">
                    <p className="font-medium text-foreground">
                      {product.name}
                    </p>
                    {product.manufacturer ? (
                      <p className="text-xs text-muted">
                        {product.manufacturer}
                      </p>
                    ) : null}
                  </td>
                  <td
                    className={`px-4 py-3 ${
                      product.status === "OUT_OF_STOCK"
                        ? "font-semibold text-red-600"
                        : product.status === "LOW_STOCK"
                          ? "font-semibold text-blue-600"
                          : "text-foreground"
                    }`}
                  >
                    {formatCount(product.quantityOnHand)}
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {formatTaka(product.costPerBase)}
                  </td>
                  <td className="px-4 py-3">
                    <ProductStatusBadge status={product.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SupplierStatusBadge({ status }: { status: SupplierStatus }) {
  const { t } = useLocale();
  const cls =
    status === "ACTIVE"
      ? "bg-emerald-100 text-emerald-800"
      : status === "HOLD"
        ? "bg-amber-100 text-amber-800"
        : "bg-slate-100 text-slate-700";
  const label =
    status === "ACTIVE"
      ? "suppliers.status.active"
      : status === "HOLD"
        ? "suppliers.status.hold"
        : "suppliers.status.draft";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {t(label)}
    </span>
  );
}

function PoStatusBadge({
  status,
}: {
  status: SupplierFull["detail"]["purchaseOrders"][number]["status"];
}) {
  const { t } = useLocale();
  const cls =
    status === "DRAFT"
      ? "bg-slate-100 text-slate-700"
      : status === "SENT"
        ? "bg-sky-100 text-sky-800"
        : status === "PARTIALLY_RECEIVED"
          ? "bg-amber-100 text-amber-800"
          : "bg-emerald-100 text-emerald-800";
  const label =
    status === "DRAFT"
      ? "purchasing.status.draft"
      : status === "SENT"
        ? "purchasing.status.sent"
        : status === "PARTIALLY_RECEIVED"
          ? "purchasing.status.partial"
          : "purchasing.status.received";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {t(label)}
    </span>
  );
}

function ProductStatusBadge({ status }: { status: SupplierProductStatus }) {
  const { t } = useLocale();
  const cls =
    status === "IN_STOCK"
      ? "bg-emerald-100 text-emerald-800"
      : status === "LOW_STOCK"
        ? "bg-blue-100 text-blue-700"
        : "bg-red-100 text-red-700";
  const label =
    status === "IN_STOCK"
      ? "suppliers.detail.products.status.inStock"
      : status === "LOW_STOCK"
        ? "suppliers.detail.products.status.lowStock"
        : "suppliers.detail.products.status.outOfStock";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {t(label)}
    </span>
  );
}