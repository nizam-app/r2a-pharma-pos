import {
  ClipboardList,
  FileText,
  PackageCheck,
  PackagePlus,
  ReceiptText,
  Search,
  ShoppingBag,
  Truck,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocale } from "@/i18n";
import { ApiError } from "@/lib/api";
import {
  formatCount,
  formatSalesDateTime,
  formatTaka,
  formatUtcDate,
} from "@/lib/format";
import { fetchInventorySummary } from "@/lib/ownerInventory";
import { useOwnerPath } from "@/lib/OwnerPathProvider";
import {
  fetchPurchaseOrders,
  type PurchaseOrderListRow,
  type PurchaseOrderStatus,
} from "@/lib/purchaseOrders";
import { FilterDropdown } from "@/features/sales/FilterDropdown";

const PAGE_SIZE = 25;

type StatusFilter = "ALL" | PurchaseOrderStatus;

/**
 * Purchasing list (Batch T). Content region only — chrome is Batch B.
 * Live GET /owner/purchase-orders + GET /owner/inventory-summary.
 * View All Receipts and Review Reorder Suggestions stay disabled.
 */
export function PurchasingPage() {
  const { t } = useLocale();
  const { navigate } = useOwnerPath();

  const [searchInput, setSearchInput] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [page, setPage] = useState(0);

  const [rows, setRows] = useState<PurchaseOrderListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [kpis, setKpis] = useState({
    total: 0,
    drafts: 0,
    open: 0,
    received: 0,
    openValue: 0,
  });
  const [attention, setAttention] = useState({
    outOfStock: 0,
    lowStock: 0,
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

    void Promise.all([
      fetchPurchaseOrders({
        q: searchQ || undefined,
        status: status === "ALL" ? undefined : status,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      }),
      fetchInventorySummary(),
    ])
      .then(([result, summary]) => {
        if (cancelled) return;
        const by = result.kpis.byStatus;
        setRows(result.items);
        setTotal(result.total);
        setKpis({
          total: result.kpis.total,
          drafts: by.DRAFT,
          open: by.SENT + by.PARTIALLY_RECEIVED,
          received: by.RECEIVED,
          openValue: result.kpis.openValue,
        });
        setAttention({
          outOfStock: summary.outOfStockCount,
          lowStock: summary.lowStockCount,
        });
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setRows([]);
        setTotal(0);
        setLoading(false);
        if (err instanceof ApiError) setError(err.message);
        else setError(t("purchasing.error"));
      });

    return () => {
      cancelled = true;
    };
  }, [searchQ, status, page, reload, t]);

  const statusOptions = useMemo(
    () =>
      [
        { value: "ALL" as const, label: t("purchasing.filter.all") },
        { value: "DRAFT" as const, label: t("purchasing.status.draft") },
        { value: "SENT" as const, label: t("purchasing.status.sent") },
        {
          value: "PARTIALLY_RECEIVED" as const,
          label: t("purchasing.status.partial"),
        },
        { value: "RECEIVED" as const, label: t("purchasing.status.received") },
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
            {t("page.purchasingTitle")}
          </h1>
          <p className="mt-1 text-sm text-muted">{t("purchasing.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled
            aria-disabled="true"
            title={t("purchasing.viewAllReceiptsSoon")}
            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-muted"
            onClick={(e) => e.preventDefault()}
          >
            <ReceiptText className="size-3.5" strokeWidth={1.75} />
            {t("purchasing.viewAllReceipts")}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            onClick={() => navigate("/purchasing/new")}
          >
            <PackagePlus className="size-3.5" strokeWidth={1.75} />
            {t("purchasing.createPo")}
          </button>
        </div>
      </div>

      {loading && rows.length === 0 && !error ? (
        <p className="text-sm text-muted">{t("purchasing.loading")}</p>
      ) : null}

      {error ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
          <p className="text-destructive">{error}</p>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1 text-foreground hover:bg-canvas"
            onClick={() => setReload((n) => n + 1)}
          >
            {t("purchasing.retry")}
          </button>
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard
            label={t("purchasing.kpi.total")}
            value={formatCount(kpis.total)}
            icon={<ShoppingBag className="size-4" strokeWidth={1.75} />}
          />
          <KpiCard
            label={t("purchasing.kpi.drafts")}
            value={formatCount(kpis.drafts)}
            icon={<FileText className="size-4" strokeWidth={1.75} />}
          />
          <KpiCard
            label={t("purchasing.kpi.open")}
            value={formatCount(kpis.open)}
            hint={t("purchasing.kpi.openHint")}
            valueClass="text-primary"
            icon={<ClipboardList className="size-4 text-primary" strokeWidth={1.75} />}
          />
          <KpiCard
            label={t("purchasing.kpi.received")}
            value={formatCount(kpis.received)}
            hint={t("purchasing.kpi.receivedHint")}
            valueClass="text-emerald-600"
            icon={<PackageCheck className="size-4 text-emerald-600" strokeWidth={1.75} />}
          />
          <KpiCard
            label={t("purchasing.kpi.openValue")}
            value={formatTaka(kpis.openValue)}
            hint={t("purchasing.kpi.openValueHint")}
            icon={<Wallet className="size-4" strokeWidth={1.75} />}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <section className="rounded-xl border border-border bg-surface lg:col-span-2">
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
              <label className="relative min-w-[14rem] flex-1">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted"
                  strokeWidth={1.75}
                />
                <span className="sr-only">{t("purchasing.search")}</span>
                <input
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={t("purchasing.searchPlaceholder")}
                  className="w-full rounded-md border border-border bg-surface py-1.5 pl-8 pr-3 text-sm text-foreground placeholder:text-muted"
                />
              </label>
              <FilterDropdown
                fieldLabel={t("purchasing.filter.status")}
                value={status}
                options={statusOptions}
                onChange={setStatus}
                ariaLabel={t("purchasing.filter.status")}
              />
            </div>

            {loading ? (
              <p className="px-4 py-6 text-sm text-muted">{t("purchasing.loading")}</p>
            ) : rows.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted">{t("purchasing.empty")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[52rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-slate-50 text-xs font-medium uppercase tracking-wide text-muted">
                      <th className="px-4 py-2 font-medium">
                        {t("purchasing.col.po")}
                      </th>
                      <th className="px-4 py-2 font-medium">
                        {t("purchasing.col.supplier")}
                      </th>
                      <th className="px-4 py-2 font-medium">
                        {t("purchasing.col.created")}
                      </th>
                      <th className="px-4 py-2 font-medium">
                        {t("purchasing.col.expected")}
                      </th>
                      <th className="px-4 py-2 font-medium">
                        {t("purchasing.col.lines")}
                      </th>
                      <th className="px-4 py-2 font-medium">
                        {t("purchasing.col.receipts")}
                      </th>
                      <th className="px-4 py-2 font-medium">
                        {t("purchasing.col.total")}
                      </th>
                      <th className="px-4 py-2 font-medium">
                        {t("purchasing.col.status")}
                      </th>
                      <th className="px-4 py-2 font-medium">
                        {t("purchasing.col.action")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <PurchaseOrderRow
                        key={row.id}
                        row={row}
                        onOpen={() => navigate(`/purchasing/${row.id}`)}
                        onReceive={() => navigate(`/purchasing/${row.id}/receive`)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-sm text-muted">
              <p>
                {t("purchasing.showing")} {formatCount(fromIdx)}–
                {formatCount(toIdx)} {t("purchasing.of")} {formatCount(total)}{" "}
                {t("purchasing.orders")}
              </p>
              <Pagination page={page} pageCount={pageCount} onPage={setPage} />
            </div>
          </section>

          <ReplenishmentAttention attention={attention} />
        </div>
      </div>
    </div>
  );
}

function PurchaseOrderRow({
  row,
  onOpen,
  onReceive,
}: {
  row: PurchaseOrderListRow;
  onOpen: () => void;
  onReceive: () => void;
}) {
  const { t } = useLocale();
  const canReceive =
    row.status === "SENT" || row.status === "PARTIALLY_RECEIVED";

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
          {row.poNumber}
        </button>
        {row.reference ? (
          <p className="text-xs text-muted">{row.reference}</p>
        ) : null}
      </td>
      <td className="px-4 py-3">
        <p className="font-medium text-foreground">
          {row.supplier?.name ?? "—"}
        </p>
        {row.supplier?.phone ? (
          <p className="text-xs text-muted">{row.supplier.phone}</p>
        ) : null}
      </td>
      <td className="px-4 py-3 text-foreground">
        {formatSalesDateTime(row.createdAt)}
      </td>
      <td className="px-4 py-3 text-foreground">
        {row.expectedDelivery ? formatUtcDate(row.expectedDelivery) : "—"}
      </td>
      <td className="px-4 py-3 text-foreground">
        {formatCount(row._count.lines)} {t("purchasing.items")}
      </td>
      <td className="px-4 py-3 text-foreground">
        {formatCount(row._count.goodsReceipts)}
      </td>
      <td className="px-4 py-3 font-medium text-foreground">
        {formatTaka(row.estimatedTotal)}
      </td>
      <td className="px-4 py-3 pr-4">
        <StatusBadge status={row.status} />
      </td>
      <td className="px-4 py-3 pr-4">
        {canReceive ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground hover:bg-canvas"
            onClick={(e) => {
              e.stopPropagation();
              onReceive();
            }}
          >
            <Truck className="size-3" strokeWidth={1.75} />
            {t("purchasing.receive")}
          </button>
        ) : (
          <button
            type="button"
            disabled
            aria-disabled="true"
            title={t("purchasing.receiveSoon")}
            className="inline-flex cursor-not-allowed items-center gap-1 rounded-md border border-border bg-canvas px-2.5 py-1 text-xs font-medium text-muted"
          >
            <Truck className="size-3" strokeWidth={1.75} />
            {t("purchasing.receive")}
          </button>
        )}
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: PurchaseOrderStatus }) {
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

function ReplenishmentAttention({
  attention,
}: {
  attention: { outOfStock: number; lowStock: number };
}) {
  const { t } = useLocale();

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="mb-3 text-sm font-semibold text-foreground">
        {t("purchasing.attention.title")}
      </h2>
      <ul className="flex flex-col">
        <AttentionRow
          icon={
            <PackageCheck className="size-4 text-red-600" strokeWidth={1.75} />
          }
          title={`${formatCount(attention.outOfStock)} ${t("purchasing.attention.outOfStock")}`}
          subtitle={t("purchasing.attention.outOfStockHint")}
        />
        <AttentionRow
          icon={
            <ClipboardList
              className="size-4 text-orange-600"
              strokeWidth={1.75}
            />
          }
          title={`${formatCount(attention.lowStock)} ${t("purchasing.attention.lowStock")}`}
          subtitle={t("purchasing.attention.lowStockHint")}
        />
      </ul>
      <button
        type="button"
        disabled
        aria-disabled="true"
        title={t("purchasing.attention.reorderSoon")}
        className="mt-3 flex w-full cursor-not-allowed items-center justify-center rounded-lg border border-border bg-canvas px-3 py-2 text-sm font-medium text-muted"
      >
        {t("purchasing.attention.reorderSuggestions")}
      </button>
    </section>
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