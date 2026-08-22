import { Download, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocale, type MessageKey } from "@/i18n";
import { ApiError } from "@/lib/api";
import { rangeForSalesPreset, type SalesDatePreset } from "@/lib/dateRange";
import {
  formatCount,
  formatPct,
  formatSalesDateTime,
  formatTaka,
} from "@/lib/format";
import { mfsProviderLabel, parseMfsProvider } from "@/lib/mfsProvider";
import {
  fetchOwnerDashboardRange,
  type DashboardKpiDelta,
  type OwnerDashboardPayload,
} from "@/lib/ownerDashboard";
import { useOwnerPath } from "@/lib/OwnerPathProvider";
import { fetchSales, type SaleListRow } from "@/lib/salesList";
import { isLoyaltyOnlyTender } from "@/lib/loyaltyTender";
import { FilterDropdown } from "./FilterDropdown";

const PAGE_SIZE = 25;

type PaymentFilter = "ALL" | "CASH" | "CARD" | "MFS";

/**
 * Sales Overview & Transactions (Batch H). Content region only — chrome is Batch B.
 * Live GET /sales + GET /owner/dashboard. No invented rows.
 */
export function SalesPage() {
  const { t } = useLocale();
  const { navigate } = useOwnerPath();
  const initialParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const initialFrom = initialParams.get("from") ?? "";
  const initialTo = initialParams.get("to") ?? "";

  const [datePreset, setDatePreset] = useState<SalesDatePreset>(initialFrom || initialTo ? "custom" : "last7");
  const [customFrom, setCustomFrom] = useState(initialFrom);
  const [customTo, setCustomTo] = useState(initialTo);
  const [searchInput, setSearchInput] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [payment, setPayment] = useState<PaymentFilter>("ALL");
  const [cashierId, setCashierId] = useState(initialParams.get("userId") ?? "ALL");
  const [page, setPage] = useState(0);

  const [dash, setDash] = useState<OwnerDashboardPayload | null>(null);
  const [rows, setRows] = useState<SaleListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  const range = useMemo(
    () => rangeForSalesPreset(datePreset, customFrom, customTo),
    [datePreset, customFrom, customTo],
  );

  function onDatePreset(next: SalesDatePreset) {
    if (next === "custom" && !customFrom && !customTo) {
      setCustomFrom(range.from);
      setCustomTo(range.to);
    }
    setDatePreset(next);
  }

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearchQ(searchInput.trim());
      setPage(0);
    }, 350);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    setPage(0);
  }, [datePreset, customFrom, customTo, payment, cashierId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const paymentMethod = payment === "ALL" ? undefined : payment;
    const userId = cashierId === "ALL" ? undefined : cashierId;

    void Promise.all([
      fetchOwnerDashboardRange(range.from, range.to),
      fetchSales({
        from: range.from,
        to: range.to,
        q: searchQ || undefined,
        paymentMethod,
        userId,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      }),
    ])
      .then(([dashboard, list]) => {
        if (cancelled) return;
        setDash(dashboard);
        setRows(list.items);
        setTotal(list.total);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setDash(null);
        setRows([]);
        setTotal(0);
        setLoading(false);
        if (err instanceof ApiError) setError(err.message);
        else setError(t("sales.error"));
      });

    return () => {
      cancelled = true;
    };
  }, [range.from, range.to, searchQ, payment, cashierId, page, reload, t]);

  const dateOptions = useMemo(
    () =>
      [
        { value: "today" as const, label: t("sales.date.today") },
        { value: "yesterday" as const, label: t("sales.date.yesterday") },
        { value: "last7" as const, label: t("sales.date.last7") },
        { value: "thisMonth" as const, label: t("sales.date.thisMonth") },
        { value: "custom" as const, label: t("sales.date.custom") },
      ] satisfies Array<{ value: SalesDatePreset; label: string }>,
    [t],
  );

  const paymentOptions = useMemo(
    () =>
      [
        { value: "ALL" as const, label: t("sales.filter.all") },
        { value: "CASH" as const, label: t("dashboard.payment.cash") },
        { value: "CARD" as const, label: t("dashboard.payment.card") },
        { value: "MFS" as const, label: t("dashboard.payment.mfs") },
      ] satisfies Array<{ value: PaymentFilter; label: string }>,
    [t],
  );

  const cashierOptions = useMemo(() => {
    const staff = dash?.cashiers ?? [];
    return [
      { value: "ALL", label: t("sales.filter.all") },
      ...staff.map((c) => ({ value: c.id, label: c.name })),
    ];
  }, [dash?.cashiers, t]);

  const kpis = dash?.salesKpis;
  const mix = dash?.paymentMix ?? { CASH: 0, CARD: 0, MFS: 0 };
  const mixTotal = mix.CASH + mix.CARD + mix.MFS;
  const vs = kpis?.vsPrev;
  const vsLabel =
    datePreset === "last7" ? t("sales.kpi.vsPrev7") : t("sales.kpi.vsPrevPeriod");

  const fromIdx = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const toIdx = Math.min(total, (page + 1) * PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="w-full px-5 py-4">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t("page.salesTitle")}
          </h1>
          <p className="mt-1 text-sm text-muted">{t("sales.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown
            fieldLabel={t("sales.filter.date")}
            value={datePreset}
            options={dateOptions}
            onChange={onDatePreset}
            ariaLabel={t("sales.filter.date")}
          />
          <button
            type="button"
            title={t("sales.exportSoon")}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground hover:bg-canvas"
            onClick={(e) => e.preventDefault()}
          >
            <Download className="size-3.5" strokeWidth={1.75} />
            {t("sales.export")}
          </button>
        </div>
      </div>

      {loading && !dash ? (
        <p className="text-sm text-muted">{t("sales.loading")}</p>
      ) : null}

      {error && !dash ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
          <p className="text-destructive">{error}</p>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1 text-foreground hover:bg-canvas"
            onClick={() => setReload((n) => n + 1)}
          >
            {t("sales.retry")}
          </button>
        </div>
      ) : null}

      {dash ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label={t("sales.kpi.gross")}
              value={formatTaka(kpis?.grossSales ?? 0)}
              hint={vsHint(vs, vsLabel)}
              hintClass={trendClass(vs?.trend)}
            />
            <KpiCard
              label={t("sales.kpi.net")}
              value={formatTaka(kpis?.netSales ?? 0)}
              hint={t("sales.kpi.afterDiscounts")}
            />
            <KpiCard
              label={t("sales.kpi.transactions")}
              value={formatCount(kpis?.txnCount ?? 0)}
              hint={t("sales.kpi.successfulOrders")}
            />
            <KpiCard
              label={t("sales.kpi.avg")}
              value={formatTaka(kpis?.avgSale ?? 0)}
              hint={t("sales.kpi.perTransaction")}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <section className="rounded-xl border border-border bg-surface p-5 lg:col-span-2">
              <h2 className="mb-4 text-sm font-semibold text-foreground">
                {t("sales.paymentBreakdown")}
              </h2>
              <PaymentBreakdown mix={mix} total={mixTotal} />
            </section>
            <section className="rounded-xl border border-border bg-surface p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                {t("sales.topCashier")}
              </p>
              {dash.topCashier ? (
                <>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    {dash.topCashier.name}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {t("sales.topCashierSales")} {formatTaka(dash.topCashier.sales)}
                  </p>
                  <p className="text-sm text-muted">
                    {formatCount(dash.topCashier.txnCount)} {t("sales.topCashierTxns")}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-muted">{t("sales.empty")}</p>
              )}
            </section>
          </div>

          <section className="rounded-xl border border-border bg-surface">
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
              <label className="relative min-w-[14rem] flex-1">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted"
                  strokeWidth={1.75}
                />
                <span className="sr-only">{t("sales.search")}</span>
                <input
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={t("sales.searchPlaceholder")}
                  className="w-full rounded-md border border-border bg-surface py-1.5 pl-8 pr-3 text-sm text-foreground placeholder:text-muted"
                />
              </label>
              <FilterDropdown
                fieldLabel={t("sales.filter.date")}
                value={datePreset}
                options={dateOptions}
                onChange={onDatePreset}
                ariaLabel={t("sales.filter.date")}
              />
              <FilterDropdown
                fieldLabel={t("sales.filter.payment")}
                value={payment}
                options={paymentOptions}
                onChange={setPayment}
                ariaLabel={t("sales.filter.payment")}
              />
              <FilterDropdown
                fieldLabel={t("sales.filter.cashier")}
                value={cashierId}
                options={cashierOptions}
                onChange={setCashierId}
                ariaLabel={t("sales.filter.cashier")}
              />
            </div>

            {datePreset === "custom" ? (
              <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
                <label className="flex items-center gap-2 text-sm text-muted">
                  <span>{t("sales.date.from")}</span>
                  <input
                    type="date"
                    value={customFrom || range.from}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-foreground"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-muted">
                  <span>{t("sales.date.to")}</span>
                  <input
                    type="date"
                    value={customTo || range.to}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-foreground"
                  />
                </label>
              </div>
            ) : null}

            {loading ? (
              <p className="px-4 py-6 text-sm text-muted">{t("sales.loading")}</p>
            ) : rows.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted">{t("sales.empty")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-slate-50 text-xs font-medium uppercase tracking-wide text-muted">
                      <th className="px-4 py-2 font-medium">
                        {t("sales.col.txn")}
                      </th>
                      <th className="px-4 py-2 font-medium">
                        {t("sales.col.datetime")}
                      </th>
                      <th className="px-4 py-2 font-medium">
                        {t("sales.col.customer")}
                      </th>
                      <th className="px-4 py-2 font-medium">
                        {t("sales.col.items")}
                      </th>
                      <th className="px-4 py-2 font-medium">
                        {t("sales.col.payment")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.id}
                        className="cursor-pointer border-b border-border last:border-0 hover:bg-canvas"
                        onClick={() => navigate(`/sales/${row.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") navigate(`/sales/${row.id}`);
                        }}
                        tabIndex={0}
                      >
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            className="font-semibold text-primary hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/sales/${row.id}`);
                            }}
                          >
                            {row.receiptNo || "—"}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-foreground">
                          {formatSalesDateTime(row.soldAt)}
                        </td>
                        <td className="px-4 py-3 text-foreground">
                          {row.customer?.name?.trim() || t("sales.walkIn")}
                        </td>
                        <td className="px-4 py-3 text-foreground">
                          {formatCount(row.items.length)} {t("sales.items")}
                        </td>
                        <td className="px-4 py-3">
                          <SalePaymentPills row={row} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm text-muted">
              <p>
                {t("sales.showing")} {formatCount(fromIdx)}–{formatCount(toIdx)}{" "}
                {t("sales.of")} {formatCount(total)} {t("sales.transactions")}
              </p>
              <Pagination
                page={page}
                pageCount={pageCount}
                onPage={setPage}
              />
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function vsHint(vs: DashboardKpiDelta | undefined, vsLabel: string): string {
  if (!vs) return "—";
  if (vs.trend === "steady" || vs.deltaPct == null) {
    return `— ${vsLabel}`;
  }
  const sign = vs.trend === "up" ? "+" : "−";
  const arrow = vs.trend === "up" ? "↑" : "↓";
  return `${arrow} ${sign}${formatPct(vs.deltaPct)}% ${vsLabel}`;
}

function trendClass(trend: string | undefined): string {
  if (trend === "up") return "text-emerald-600";
  if (trend === "down") return "text-destructive";
  return "text-muted";
}

function KpiCard({
  label,
  value,
  hint,
  hintClass,
}: {
  label: string;
  value: string;
  hint: string;
  hintClass?: string;
}) {
  return (
    <article className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
      <p className={`mt-1 text-xs ${hintClass ?? "text-muted"}`}>{hint}</p>
    </article>
  );
}

function PaymentBreakdown({
  mix,
  total,
}: {
  mix: { CASH: number; CARD: number; MFS: number };
  total: number;
}) {
  const { t } = useLocale();
  const rows: Array<{
    key: MessageKey;
    amount: number;
    bar: string;
    track: string;
  }> = [
    {
      key: "dashboard.payment.cash",
      amount: mix.CASH,
      bar: "bg-emerald-500",
      track: "bg-emerald-50",
    },
    {
      key: "dashboard.payment.card",
      amount: mix.CARD,
      bar: "bg-sky-500",
      track: "bg-sky-50",
    },
    {
      key: "dashboard.payment.mfs",
      amount: mix.MFS,
      bar: "bg-rose-500",
      track: "bg-rose-50",
    },
  ];

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => {
        const pct = total > 0 ? (row.amount / total) * 100 : 0;
        return (
          <li key={row.key}>
            <div className="mb-1 flex items-center justify-between gap-2 text-sm">
              <span className="text-foreground">
                {t(row.key)} ({formatPct(pct)}%)
              </span>
              <span className="font-semibold text-foreground">
                {formatTaka(row.amount)}
              </span>
            </div>
            <div className={`h-2 overflow-hidden rounded-full ${row.track}`}>
              <div
                className={`h-full rounded-full ${row.bar}`}
                style={{ width: `${row.amount > 0 ? Math.max(pct, 4) : 0}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function SalePaymentPills({ row }: { row: SaleListRow }) {
  const { t } = useLocale();
  if (
    isLoyaltyOnlyTender({
      loyaltyUsed: row.loyaltyUsed ?? 0,
      payments: row.payments,
    })
  ) {
    return (
      <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-800">
        {t("dashboard.payment.loyalty")}
      </span>
    );
  }
  const methods = [...new Set(row.payments.map((p) => p.method))];
  if (methods.length === 0) return <span className="text-muted">—</span>;
  const mfs = parseMfsProvider(row.notes);

  return (
    <span className="flex flex-wrap gap-1">
      {methods.map((method) => {
        if (method === "MFS") {
          const brand = mfsProviderLabel(mfs);
          const cls =
            mfs === "BKASH"
              ? "rounded-full bg-[#E2136E]/10 px-2.5 py-0.5 text-xs font-medium text-[#E2136E]"
              : mfs === "NAGAD"
                ? "rounded-full bg-[#F7941D]/15 px-2.5 py-0.5 text-xs font-medium text-[#ED1C24]"
                : mfs === "ROCKET"
                  ? "rounded-full bg-[#8C3494]/10 px-2.5 py-0.5 text-xs font-medium text-[#8C3494]"
                  : "rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700";
          return (
            <span key={method} className={cls}>
              {brand
                ? `${t("dashboard.payment.mfs")}:${brand}`
                : t("dashboard.payment.mfs")}
            </span>
          );
        }
        const key =
          method === "CASH"
            ? "dashboard.payment.cash"
            : "dashboard.payment.card";
        return (
          <span
            key={method}
            className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700"
          >
            {t(key)}
          </span>
        );
      })}
    </span>
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
