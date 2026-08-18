import {
  AlertTriangle,
  CalendarClock,
  Clock,
  Columns3,
  Filter,
  Package,
  PackagePlus,
  PackageX,
  Plus,
  Search,
  SlidersHorizontal,
  Wallet,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useLocale, type MessageKey } from "@/i18n";
import { ApiError } from "@/lib/api";
import {
  formatCount,
  formatExpiryShort,
  formatPct,
  formatTaka,
} from "@/lib/format";
import {
  fetchOwnerInventory,
  type InventoryRowStatus,
  type InventoryTab,
  type OwnerInventoryPayload,
  type OwnerInventoryRow,
} from "@/lib/ownerInventory";
import { useOwnerPath } from "@/lib/OwnerPathProvider";
import { ReceiveProductPicker } from "./ReceiveProductPicker";

const PAGE_SIZE = 25;

const TABS: Array<{
  id: InventoryTab;
  label: MessageKey;
  countKey: keyof OwnerInventoryPayload["tabs"];
}> = [
  { id: "all", label: "inventory.tab.all", countKey: "all" },
  { id: "low", label: "inventory.tab.low", countKey: "low" },
  { id: "out", label: "inventory.tab.out", countKey: "out" },
  { id: "expiring30", label: "inventory.tab.expiring30", countKey: "expiring30" },
  { id: "expiring90", label: "inventory.tab.expiring90", countKey: "expiring90" },
  { id: "expired", label: "inventory.tab.expired", countKey: "expired" },
];

const STATUS_LABEL: Record<InventoryRowStatus, MessageKey> = {
  healthy: "inventory.status.healthy",
  low: "inventory.status.low",
  out: "inventory.status.out",
  expiring: "inventory.status.expiring",
  expired: "inventory.status.expired",
};

/**
 * Inventory list (Batch J). Content region only — chrome is Batch B.
 * Live GET /owner/inventory. Product Details is Batch K; Add / Receive / Expiry later.
 */
export function InventoryPage() {
  const { t } = useLocale();
  const { navigate } = useOwnerPath();

  const [tab, setTab] = useState<InventoryTab>("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [page, setPage] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [payload, setPayload] = useState<OwnerInventoryPayload | null>(null);
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
  }, [tab]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchOwnerInventory({
      q: searchQ || undefined,
      tab,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    })
      .then((data) => {
        if (cancelled) return;
        setPayload(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setPayload(null);
        setLoading(false);
        if (err instanceof ApiError) setError(err.message);
        else setError(t("inventory.error"));
      });
    return () => {
      cancelled = true;
    };
  }, [searchQ, tab, page, reload, t]);

  const summary = payload?.summary;
  const tabs = payload?.tabs;
  const attention = payload?.attention;
  const rows = payload?.items ?? [];
  const total = payload?.total ?? 0;
  const fromIdx = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const toIdx = Math.min(total, (page + 1) * PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="w-full px-5 py-4">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t("page.inventoryTitle")}
          </h1>
          <p className="mt-1 text-sm text-muted">{t("inventory.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground hover:bg-canvas"
            onClick={() => navigate("/inventory/expiry")}
          >
            <CalendarClock className="size-3.5 text-amber-600" strokeWidth={1.75} />
            {t("inventory.expiryManagement")}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground hover:bg-canvas"
            onClick={() => navigate("/inventory/new")}
          >
            <Plus className="size-3.5" strokeWidth={1.75} />
            {t("inventory.addProduct")}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            onClick={() => setPickerOpen(true)}
          >
            <PackagePlus className="size-3.5" strokeWidth={1.75} />
            {t("inventory.receiveStock")}
          </button>
        </div>
      </div>

      {loading && !payload ? (
        <p className="text-sm text-muted">{t("inventory.loading")}</p>
      ) : null}

      {error && !payload ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
          <p className="text-destructive">{error}</p>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1 text-foreground hover:bg-canvas"
            onClick={() => setReload((n) => n + 1)}
          >
            {t("inventory.retry")}
          </button>
        </div>
      ) : null}

      {payload ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <KpiCard
              label={t("inventory.kpi.totalProducts")}
              value={formatCount(summary?.productCount ?? 0)}
              icon={<Package className="size-4" strokeWidth={1.75} />}
            />
            <KpiCard
              label={t("inventory.kpi.costValue")}
              value={formatTaka(summary?.costValue ?? 0)}
              icon={<Wallet className="size-4" strokeWidth={1.75} />}
            />
            <KpiCard
              label={t("inventory.kpi.lowStock")}
              value={formatCount(summary?.lowStockCount ?? 0)}
              valueClass="text-orange-600"
              icon={
                <AlertTriangle
                  className="size-4 text-orange-500"
                  strokeWidth={1.75}
                />
              }
            />
            <KpiCard
              label={t("inventory.kpi.outOfStock")}
              value={formatCount(summary?.outOfStockCount ?? 0)}
              valueClass="text-destructive"
              icon={
                <PackageX className="size-4 text-destructive" strokeWidth={1.75} />
              }
            />
            <KpiCard
              label={t("inventory.kpi.expiring90")}
              value={formatCount(summary?.expiring90dBatchCount ?? 0)}
              hint={t("inventory.kpi.batches")}
              valueClass="text-amber-700"
              icon={<Clock className="size-4 text-amber-600" strokeWidth={1.75} />}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {TABS.map((item) => {
              const active = tab === item.id;
              const count = tabs?.[item.countKey] ?? 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={
                    active
                      ? "rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                      : "rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-foreground hover:bg-canvas"
                  }
                  onClick={() => setTab(item.id)}
                >
                  {t(item.label)} ({formatCount(count)})
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
            <section className="rounded-xl border border-border bg-surface">
              <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
                <label className="relative min-w-[14rem] flex-1">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted"
                    strokeWidth={1.75}
                  />
                  <span className="sr-only">{t("inventory.search")}</span>
                  <input
                    type="search"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder={t("inventory.searchPlaceholder")}
                    className="w-full rounded-md border border-border bg-surface py-1.5 pl-8 pr-3 text-sm text-foreground placeholder:text-muted"
                  />
                </label>
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  title={t("inventory.filterSoon")}
                  className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-muted"
                >
                  <Filter className="size-3.5" strokeWidth={1.75} />
                  {t("inventory.filter")}
                </button>
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  title={t("inventory.columnsSoon")}
                  className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-muted"
                >
                  <Columns3 className="size-3.5" strokeWidth={1.75} />
                  {t("inventory.columns")}
                </button>
              </div>

              {loading ? (
                <p className="px-4 py-6 text-sm text-muted">
                  {t("inventory.loading")}
                </p>
              ) : rows.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted">{t("inventory.empty")}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[56rem] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border bg-slate-50 text-xs font-medium uppercase tracking-wide text-muted">
                        <th className="px-4 py-2.5 font-medium">
                          {t("inventory.col.medicine")}
                        </th>
                        <th className="px-3 py-2.5 font-medium">
                          {t("inventory.col.manufacturer")}
                        </th>
                        <th className="px-3 py-2.5 font-medium">
                          {t("inventory.col.stock")}
                        </th>
                        <th className="px-3 py-2.5 font-medium">
                          {t("inventory.col.nearestExpiry")}
                        </th>
                        <th className="px-3 py-2.5 font-medium">
                          {t("inventory.col.batches")}
                        </th>
                        <th className="px-3 py-2.5 font-medium">
                          {t("inventory.col.cost")}
                        </th>
                        <th className="px-3 py-2.5 font-medium">
                          {t("inventory.col.sell")}
                        </th>
                        <th className="px-3 py-2.5 font-medium">
                          {t("inventory.col.margin")}
                        </th>
                        <th className="px-3 py-2.5 pr-4 font-medium">
                          {t("inventory.col.status")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <InventoryRow
                          key={row.productId}
                          row={row}
                          onOpen={() => navigate(`/inventory/${row.productId}`)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-sm text-muted">
                <p>
                  {t("inventory.showing")} {formatCount(fromIdx)}–
                  {formatCount(toIdx)} {t("inventory.of")} {formatCount(total)}{" "}
                  {t("inventory.products")}
                </p>
                <Pagination
                  page={page}
                  pageCount={pageCount}
                  onPage={setPage}
                />
              </div>
            </section>

            <AttentionPanel
              attention={attention}
              onReview={() => navigate("/inventory/expiry")}
            />
          </div>
        </div>
      ) : null}

      <ReceiveProductPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(productId) => {
          setPickerOpen(false);
          navigate(`/inventory/${productId}/receive`);
        }}
      />
    </div>
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

function InventoryRow({
  row,
  onOpen,
}: {
  row: OwnerInventoryRow;
  onOpen: () => void;
}) {
  const { t } = useLocale();
  const stockClass =
    row.status === "out"
      ? "font-medium text-destructive"
      : row.status === "low"
        ? "font-medium text-orange-600"
        : "text-foreground";
  const expiryIso = row.nearestExpiry;
  const expiryClass =
    row.status === "expired"
      ? "text-destructive"
      : row.status === "expiring"
        ? "text-orange-600"
        : "text-foreground";

  return (
    <tr
      className="cursor-pointer border-b border-border last:border-b-0 hover:bg-canvas"
      onClick={onOpen}
    >
      <td className="px-4 py-3">
        <p className="font-medium text-foreground">{row.name}</p>
        <p className="text-xs text-muted">{row.genericName || "—"}</p>
        {row.coldChain ? (
          <span className="mt-1 inline-flex rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800">
            {t("inventory.coldChain")}
          </span>
        ) : null}
      </td>
      <td className="px-3 py-3 text-foreground">{row.manufacturer || "—"}</td>
      <td className={`px-3 py-3 ${stockClass}`}>
        {formatCount(row.quantityOnHand)} {t("inventory.pcs")}
      </td>
      <td className={`px-3 py-3 ${expiryClass}`}>
        {expiryIso ? formatExpiryShort(expiryIso) : "—"}
      </td>
      <td className="px-3 py-3 text-foreground">
        {formatCount(row.batchCount)}
      </td>
      <td className="px-3 py-3 text-foreground">
        {row.costPerBase == null ? "—" : formatTaka(row.costPerBase)}
      </td>
      <td className="px-3 py-3 text-foreground">
        {row.sellPerBase == null ? "—" : formatTaka(row.sellPerBase)}
      </td>
      <td className="px-3 py-3 text-primary">
        {row.marginPct == null ? "—" : `${formatPct(row.marginPct)}%`}
      </td>
      <td className="px-3 py-3 pr-4">
        <StatusBadge status={row.status} />
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: InventoryRowStatus }) {
  const { t } = useLocale();
  const cls =
    status === "healthy"
      ? "bg-emerald-50 text-emerald-800"
      : status === "low" || status === "expiring"
        ? "bg-orange-50 text-orange-800"
        : "bg-red-50 text-red-800";
  return (
    <span
      className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {t(STATUS_LABEL[status])}
    </span>
  );
}

function AttentionPanel({
  attention,
  onReview,
}: {
  attention: OwnerInventoryPayload["attention"] | undefined;
  onReview: () => void;
}) {
  const { t } = useLocale();
  const out = attention?.outOfStockCount ?? 0;
  const exp30 = attention?.expiring30dBatchCount ?? 0;
  const value = attention?.expiringStockValue90d ?? 0;
  const low = attention?.lowStockCount ?? 0;

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="mb-3 text-sm font-semibold text-foreground">
        {t("inventory.attention.title")}
      </h2>
      <ul className="flex flex-col">
        <AttentionRow
          icon={<PackageX className="size-4 text-red-600" strokeWidth={1.75} />}
          title={`${formatCount(out)} ${t("inventory.attention.outOfStock")}`}
          subtitle={t("inventory.attention.outOfStockHint")}
        />
        <AttentionRow
          icon={<Clock className="size-4 text-amber-600" strokeWidth={1.75} />}
          title={`${formatCount(exp30)} ${t("inventory.attention.expiring30")}`}
          subtitle={t("inventory.attention.expiring30Hint")}
        />
        <AttentionRow
          icon={
            <AlertTriangle className="size-4 text-red-600" strokeWidth={1.75} />
          }
          title={`${formatTaka(value)} ${t("inventory.attention.expiryValue")}`}
          subtitle={t("inventory.attention.expiryValueHint")}
        />
        <AttentionRow
          icon={
            <SlidersHorizontal
              className="size-4 text-orange-600"
              strokeWidth={1.75}
            />
          }
          title={`${formatCount(low)} ${t("inventory.attention.lowStock")}`}
          subtitle={t("inventory.attention.lowStockHint")}
        />
      </ul>
      <button
        type="button"
        className="mt-3 flex w-full items-center justify-center rounded-lg border border-border bg-canvas px-3 py-2 text-sm font-medium text-foreground hover:bg-surface"
        onClick={onReview}
      >
        {t("inventory.attention.review")}
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
