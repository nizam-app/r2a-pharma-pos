import {
  ClipboardList,
  PackageX,
  Search,
  ShieldCheck,
  ShoppingCart,
  Truck,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocale } from "@/i18n";
import { ApiError } from "@/lib/api";
import {
  formatCount,
  formatPct,
  formatSalesDateTime,
  formatTaka,
} from "@/lib/format";
import { useOwnerPath } from "@/lib/OwnerPathProvider";
import {
  fetchSuppliers,
  type SupplierAttention,
  type SupplierKpis,
  type SupplierListRow,
  type SupplierStatus,
} from "@/lib/suppliers";
import { FilterDropdown } from "@/features/sales/FilterDropdown";

const PAGE_SIZE = 25;

type StatusFilter = "ALL" | SupplierStatus;

/**
 * Suppliers directory (Batch X). Content region only — chrome is Batch B.
 * Live GET /owner/suppliers. Expiry Returns + Add Supplier navigate to
 * registered subpaths; Review All Issues stays disabled (Batch AA).
 */
export function SuppliersPage() {
  const { t } = useLocale();
  const { navigate } = useOwnerPath();

  const [searchInput, setSearchInput] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [page, setPage] = useState(0);

  const [rows, setRows] = useState<SupplierListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [kpis, setKpis] = useState<SupplierKpis>({
    activeSuppliers: 0,
    onHoldSuppliers: 0,
    openOrders: 0,
    purchasesMtd: 0,
    purchasesPrevMtd: 0,
    avgDeliveryDays: null,
  });
  const [attention, setAttention] = useState<SupplierAttention>({
    overdueOrders: [],
    openOrders: 0,
    returnQueue: 0,
    onHoldSuppliers: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearchQ(searchInput.trim());
      setPage(0);
    }, 350);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    setPage(0);
  }, [status]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetchSuppliers({
      q: searchQ || undefined,
      status: status === "ALL" ? undefined : status,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    })
      .then((result) => {
        if (cancelled) return;
        setRows(result.items);
        setTotal(result.total);
        setKpis(result.kpis);
        setAttention(result.attention);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setRows([]);
        setTotal(0);
        setLoading(false);
        if (err instanceof ApiError) setError(err.message);
        else setError(t("suppliers.error"));
      });

    return () => {
      cancelled = true;
    };
  }, [searchQ, status, page, reload, t]);

  const statusOptions = useMemo(
    () =>
      [
        { value: "ALL" as const, label: t("suppliers.filter.all") },
        { value: "ACTIVE" as const, label: t("suppliers.status.active") },
        { value: "HOLD" as const, label: t("suppliers.status.hold") },
        { value: "DRAFT" as const, label: t("suppliers.status.draft") },
      ] satisfies Array<{ value: StatusFilter; label: string }>,
    [t],
  );

  const fromIdx = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const toIdx = Math.min(total, (page + 1) * PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="w-full px-5 py-4">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t("page.suppliersTitle")}
          </h1>
          <p className="mt-1 text-sm text-muted">{t("suppliers.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground hover:bg-canvas"
            onClick={() => navigate("/suppliers/returns")}
          >
            <PackageX className="size-3.5" strokeWidth={1.75} />
            {t("suppliers.expiryReturns")}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            onClick={() => navigate("/suppliers/new")}
          >
            <UserPlus className="size-3.5" strokeWidth={1.75} />
            {t("suppliers.addSupplier")}
          </button>
        </div>
      </div>

      {loading && rows.length === 0 && !error ? (
        <p className="text-sm text-muted">{t("suppliers.loading")}</p>
      ) : null}

      {error ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
          <p className="text-destructive">{error}</p>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1 text-foreground hover:bg-canvas"
            onClick={() => setReload((n) => n + 1)}
          >
            {t("suppliers.retry")}
          </button>
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label={t("suppliers.kpi.active")}
            value={formatCount(kpis.activeSuppliers)}
            hint={t("suppliers.kpi.activeHint")}
            icon={<Users className="size-4" strokeWidth={1.75} />}
          />
          <KpiCard
            label={t("suppliers.kpi.openOrders")}
            value={formatCount(kpis.openOrders)}
            hint={t("suppliers.kpi.openOrdersHint")}
            valueClass="text-primary"
            icon={<ClipboardList className="size-4 text-primary" strokeWidth={1.75} />}
          />
          <KpiCard
            label={t("suppliers.kpi.purchasesMtd")}
            value={formatTaka(kpis.purchasesMtd)}
            hint={
              kpis.purchasesPrevMtd > 0
                ? `${kpis.purchasesMtd >= kpis.purchasesPrevMtd ? "+" : "-"}${formatPct(
                    Math.round(
                      ((kpis.purchasesMtd - kpis.purchasesPrevMtd) /
                        kpis.purchasesPrevMtd) *
                        100,
                    ),
                  )}% ${t("suppliers.kpi.vsLastMonth")}`
                : t("suppliers.kpi.purchasesMtdHint")
            }
            valueClass="text-emerald-600"
            icon={<Wallet className="size-4 text-emerald-600" strokeWidth={1.75} />}
          />
          <KpiCard
            label={t("suppliers.kpi.avgDelivery")}
            value={
              kpis.avgDeliveryDays == null
                ? "—"
                : `${formatPct(kpis.avgDeliveryDays)} ${t("suppliers.kpi.days")}`
            }
            hint={
              kpis.avgDeliveryDays == null
                ? t("suppliers.kpi.avgDeliveryNone")
                : t("suppliers.kpi.avgDeliveryHint")
            }
            icon={<Truck className="size-4" strokeWidth={1.75} />}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_194px]">
          <section className="rounded-xl border border-border bg-surface">
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
              <label className="relative min-w-[14rem] flex-1">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted"
                  strokeWidth={1.75}
                />
                <span className="sr-only">{t("suppliers.search")}</span>
                <input
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={t("suppliers.searchPlaceholder")}
                  className="w-full rounded-md border border-border bg-surface py-1.5 pl-8 pr-3 text-sm text-foreground placeholder:text-muted"
                />
              </label>
              <FilterDropdown
                fieldLabel={t("suppliers.filter.status")}
                value={status}
                options={statusOptions}
                onChange={setStatus}
                ariaLabel={t("suppliers.filter.status")}
              />
            </div>

            {loading ? (
              <p className="px-4 py-6 text-sm text-muted">{t("suppliers.loading")}</p>
            ) : rows.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted">{t("suppliers.empty")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[44rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-slate-50 text-xs font-medium uppercase tracking-wide text-muted">
                      <th className="px-4 py-2 font-medium">
                        {t("suppliers.col.supplier")}
                      </th>
                      <th className="px-4 py-2 font-medium">
                        {t("suppliers.col.contact")}
                      </th>
                      <th className="px-4 py-2 font-medium">
                        {t("suppliers.col.activeProducts")}
                      </th>
                      <th className="px-4 py-2 font-medium">
                        {t("suppliers.col.lastPurchase")}
                      </th>
                      <th className="px-4 py-2 font-medium">
                        {t("suppliers.col.openOrders")}
                      </th>
                      <th className="px-4 py-2 font-medium">
                        {t("suppliers.col.purchasesMtd")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <SupplierRow
                        key={row.id}
                        row={row}
                        onOpen={() => navigate(`/suppliers/${encodeURIComponent(row.id)}`)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-sm text-muted">
              <p>
                {t("suppliers.showing")} {formatCount(fromIdx)}–
                {formatCount(toIdx)} {t("suppliers.of")} {formatCount(total)}{" "}
                {t("suppliers.suppliers")}
              </p>
              <Pagination page={page} pageCount={pageCount} onPage={setPage} />
            </div>
          </section>

          <SupplierAttentionPanel attention={attention} onNavigate={navigate} />
        </div>
      </div>
    </div>
  );
}

function SupplierRow({
  row,
  onOpen,
}: {
  row: SupplierListRow;
  onOpen: () => void;
}) {
  return (
    <tr
      className="cursor-pointer border-b border-border last:border-b-0 hover:bg-canvas"
      onClick={onOpen}
    >
      <td className="px-4 py-3">
        <button
          type="button"
          className="font-semibold text-primary hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
        >
          {row.name}
        </button>
        {row.email ? <p className="text-xs text-muted">{row.email}</p> : null}
      </td>
      <td className="px-4 py-3">
        <p className="font-medium text-foreground">
          {row.contactPerson ?? "—"}
        </p>
        {row.phone ? <p className="text-xs text-muted">{row.phone}</p> : null}
      </td>
      <td className="px-4 py-3 text-foreground">
        {formatCount(row.stats.activeProducts)}
      </td>
      <td className="px-4 py-3 text-foreground">
        {row.stats.lastPurchaseAt ? formatSalesDateTime(row.stats.lastPurchaseAt) : "—"}
      </td>
      <td className="px-4 py-3 text-foreground">
        {formatCount(row.stats.openOrders)}
      </td>
      <td className="px-4 py-3 font-medium text-foreground">
        {formatTaka(row.stats.purchasesMtd)}
      </td>
    </tr>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon,
  valueClass,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: ReactNode;
  valueClass?: string;
}) {
  return (
    <article className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          {label}
        </p>
        <span className="text-muted">{icon}</span>
      </div>
      <p
        className={`mt-2 text-2xl font-semibold tracking-tight ${valueClass ?? "text-foreground"}`}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </article>
  );
}

function SupplierAttentionPanel({
  attention,
  onNavigate,
}: {
  attention: SupplierAttention;
  onNavigate: (to: string) => void;
}) {
  const { t } = useLocale();
  const overdueNames = attention.overdueOrders
    .map((order) => order.supplierName)
    .filter(Boolean)
    .slice(0, 2)
    .join(", ");

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="mb-3 text-sm font-semibold text-foreground">
        {t("suppliers.attention.title")}
      </h2>
      <ul className="flex flex-col gap-2">
        <AttentionRow
          tone="red"
          icon={<Truck className="size-3.5 text-red-600" strokeWidth={1.75} />}
          title={`${formatCount(attention.overdueOrders.length)} ${t("suppliers.attention.overdue")}`}
          subtitle={overdueNames || t("suppliers.attention.overdueHint")}
          reviewLabel={t("suppliers.attention.review")}
          onReview={() => onNavigate("/purchasing")}
        />
        <AttentionRow
          tone="teal"
          icon={<ShoppingCart className="size-3.5 text-primary" strokeWidth={1.75} />}
          title={`${formatCount(attention.openOrders)} ${t("suppliers.attention.openOrders")}`}
          subtitle={t("suppliers.attention.openOrdersHint")}
          reviewLabel={t("suppliers.attention.review")}
          onReview={() => onNavigate("/purchasing")}
        />
        <AttentionRow
          tone="orange"
          icon={<PackageX className="size-3.5 text-orange-600" strokeWidth={1.75} />}
          title={`${formatCount(attention.returnQueue)} ${t("suppliers.attention.expiryReturns")}`}
          subtitle={t("suppliers.attention.expiryReturnsHint")}
          reviewLabel={t("suppliers.attention.review")}
          onReview={() => onNavigate("/suppliers/returns")}
        />
        <AttentionRow
          tone="slate"
          icon={<ShieldCheck className="size-3.5 text-slate-600" strokeWidth={1.75} />}
          title={`${formatCount(attention.onHoldSuppliers.length)} ${t("suppliers.attention.onHold")}`}
          subtitle={
            attention.onHoldSuppliers.length > 0
              ? attention.onHoldSuppliers.map((s) => s.name).slice(0, 2).join(", ")
              : t("suppliers.attention.onHoldHint")
          }
          reviewLabel={t("suppliers.attention.review")}
          onReview={() => onNavigate("/suppliers")}
        />
      </ul>
      <button
        type="button"
        disabled
        aria-disabled="true"
        title={t("suppliers.attention.reviewAllSoon")}
        className="mt-3 flex w-full cursor-not-allowed items-center justify-center rounded-lg border border-border bg-canvas px-3 py-2 text-sm font-medium text-muted"
      >
        {t("suppliers.attention.reviewAll")}
      </button>
    </section>
  );
}

function AttentionRow({
  tone,
  icon,
  title,
  subtitle,
  reviewLabel,
  onReview,
}: {
  tone: "red" | "teal" | "orange" | "slate";
  icon: ReactNode;
  title: string;
  subtitle: string;
  reviewLabel: string;
  onReview: () => void;
}) {
  const border =
    tone === "red"
      ? "border-l-red-600"
      : tone === "teal"
        ? "border-l-primary"
        : tone === "orange"
          ? "border-l-orange-600"
          : "border-l-slate-400";

  return (
    <li className={`flex items-start gap-2 border-l-2 pl-2 py-1.5 ${border}`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="truncate text-xs text-muted">{subtitle}</p>
        <button
          type="button"
          className="mt-0.5 text-xs font-medium text-primary hover:underline"
          onClick={onReview}
        >
          {reviewLabel} →
        </button>
      </div>
    </li>
  );
}

function Pagination({
  page,
  pageCount,
  onPage,
}: {
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
}) {
  const { t } = useLocale();
  const pages = visiblePages(page, pageCount);

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={page <= 0}
        className="rounded-md border border-border px-2.5 py-1 text-foreground disabled:cursor-not-allowed disabled:text-muted"
        onClick={() => onPage(page - 1)}
      >
        {t("sales.prev")}
      </button>
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`e${i}`} className="px-1">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            className={
              p === page
                ? "rounded-md bg-primary px-2.5 py-1 font-medium text-primary-foreground"
                : "rounded-md border border-border px-2.5 py-1 text-foreground hover:bg-canvas"
            }
            onClick={() => onPage(p)}
          >
            {p + 1}
          </button>
        ),
      )}
      <button
        type="button"
        disabled={page >= pageCount - 1}
        className="rounded-md border border-border px-2.5 py-1 text-foreground disabled:cursor-not-allowed disabled:text-muted"
        onClick={() => onPage(page + 1)}
      >
        {t("sales.next")}
      </button>
    </div>
  );
}

function visiblePages(
  page: number,
  pageCount: number,
): Array<number | "…"> {
  if (pageCount <= 5) {
    return Array.from({ length: pageCount }, (_, i) => i);
  }
  const out: Array<number | "…"> = [0];
  const start = Math.max(1, page - 1);
  const end = Math.min(pageCount - 2, page + 1);
  if (start > 1) out.push("…");
  for (let i = start; i <= end; i += 1) out.push(i);
  if (end < pageCount - 2) out.push("…");
  out.push(pageCount - 1);
  return out;
}