import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Banknote,
  CalendarDays,
  CreditCard,
  Download,
  MoreVertical,
  PackageCheck,
  ReceiptText,
  Smartphone,
  Trophy,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocale } from "@/i18n";
import { ApiError } from "@/lib/api";
import {
  formatCount,
  formatPct,
  formatSalesDateTime,
  formatTaka,
  formatUtcDate,
  initialsFromName,
} from "@/lib/format";
import { useOwnerPath } from "@/lib/OwnerPathProvider";
import {
  fetchSalesReport,
  rangeForSalesReportPreset,
  type SalesReportPayload,
  type SalesReportRangePreset,
} from "@/lib/ownerReports";
import { useTenantChrome } from "@/lib/TenantContextProvider";

const RANGE_OPTIONS: SalesReportRangePreset[] = ["last30", "last7"];
const MEDICINES_PAGE_SIZE = 8;
const TRANSACTIONS_PAGE_SIZE = 12;

export function SalesReportPage() {
  const { t } = useLocale();
  const { storeId, storeName } = useTenantChrome();
  const [preset, setPreset] = useState<SalesReportRangePreset>("last30");
  const [data, setData] = useState<SalesReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const range = rangeForSalesReportPreset(preset);
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchSalesReport({ ...range, storeId: storeId ?? undefined })
      .then((payload) => {
        if (cancelled) return;
        setData(payload);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setData(null);
        setLoading(false);
        setError(err instanceof ApiError ? err.message : t("reports.salesReport.error"));
      });
    return () => {
      cancelled = true;
    };
  }, [preset, reload, storeId, t]);

  return (
    <div className="w-full px-5 py-4">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted">
            {t("reports.salesReport.breadcrumb")}
          </p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-foreground">
            {t("reports.salesReport.title")}
          </h1>
          <p className="mt-1 text-sm text-muted">{t("reports.salesReport.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground"
            title={t("reports.salesReport.branchLocked")}
          >
            <ReceiptText className="size-4 text-muted" strokeWidth={1.75} />
            {storeName || t("reports.salesReport.currentStore")}
          </button>
          <label className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground">
            <CalendarDays className="size-4 text-muted" strokeWidth={1.75} />
            <select
              className="bg-transparent text-sm font-medium outline-none"
              value={preset}
              onChange={(event) => setPreset(event.target.value as SalesReportRangePreset)}
            >
              {RANGE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {t(option === "last30" ? "reports.salesReport.range.last30" : "reports.salesReport.range.last7")}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled
            aria-disabled="true"
            title={t("reports.salesReport.exportHint")}
            className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg bg-slate-200 px-3 py-2 text-sm font-semibold text-muted"
          >
            <Download className="size-4" strokeWidth={1.75} />
            {t("reports.salesReport.export")}
          </button>
        </div>
      </div>

      {loading && !data ? (
        <p className="text-sm text-muted">{t("reports.salesReport.loading")}</p>
      ) : null}

      {error && !data ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
          <p className="text-destructive">{error}</p>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1 text-foreground hover:bg-canvas"
            onClick={() => setReload((n) => n + 1)}
          >
            {t("reports.retry")}
          </button>
        </div>
      ) : null}

      {data ? <SalesReportBody data={data} /> : null}
    </div>
  );
}

function SalesReportBody({ data }: { data: SalesReportPayload }) {
  const { t } = useLocale();
  const { navigate } = useOwnerPath();
  const [medicinePage, setMedicinePage] = useState(0);
  const [transactionPage, setTransactionPage] = useState(0);
  const maxPayment = Math.max(1, data.paymentSummary.CASH, data.paymentSummary.CARD, data.paymentSummary.MFS);
  const paymentRows = [
    [t("reports.salesReport.payment.cash"), data.paymentSummary.CASH, "bg-primary", <Banknote className="size-4" strokeWidth={1.75} />],
    [t("reports.salesReport.payment.card"), data.paymentSummary.CARD, "bg-blue-500", <CreditCard className="size-4" strokeWidth={1.75} />],
    [t("reports.salesReport.payment.mfs"), data.paymentSummary.MFS, "bg-amber-500", <Smartphone className="size-4" strokeWidth={1.75} />],
  ] as const;
  const topCategoryShare = data.bestSellingCategory && data.kpis.itemsSold.value > 0
    ? Math.round((data.bestSellingCategory.unitsSold / data.kpis.itemsSold.value) * 100)
    : null;
  const topMedicineMax = Math.max(
    1,
    ...data.topSellingMedicines.map((medicine) => medicine.unitsSold),
  );
  const medicinePageCount = Math.max(
    1,
    Math.ceil(data.topSellingMedicines.length / MEDICINES_PAGE_SIZE),
  );
  const transactionPageCount = Math.max(
    1,
    Math.ceil(data.recentTransactions.length / TRANSACTIONS_PAGE_SIZE),
  );
  const safeMedicinePage = Math.min(medicinePage, medicinePageCount - 1);
  const safeTransactionPage = Math.min(transactionPage, transactionPageCount - 1);
  const visibleMedicines = data.topSellingMedicines.slice(
    safeMedicinePage * MEDICINES_PAGE_SIZE,
    safeMedicinePage * MEDICINES_PAGE_SIZE + MEDICINES_PAGE_SIZE,
  );
  const visibleTransactions = data.recentTransactions.slice(
    safeTransactionPage * TRANSACTIONS_PAGE_SIZE,
    safeTransactionPage * TRANSACTIONS_PAGE_SIZE + TRANSACTIONS_PAGE_SIZE,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={t("reports.salesReport.kpi.totalSales")}
          value={formatTaka(data.kpis.totalSales.value)}
          hint={trendText(data.kpis.totalSales.deltaPct, t("reports.salesReport.previousPeriod"))}
          icon={<Banknote className="size-4 text-primary" strokeWidth={1.75} />}
          trend={data.kpis.totalSales.trend}
        />
        <KpiCard
          label={t("reports.salesReport.kpi.transactions")}
          value={formatCount(data.kpis.txnCount.value)}
          hint={trendText(data.kpis.txnCount.deltaPct, t("reports.salesReport.previousPeriod"))}
          icon={<ReceiptText className="size-4 text-blue-600" strokeWidth={1.75} />}
          trend={data.kpis.txnCount.trend}
        />
        <KpiCard
          label={t("reports.salesReport.kpi.avgOrder")}
          value={formatTaka(data.kpis.avgOrder.value)}
          hint={trendText(data.kpis.avgOrder.deltaPct, t("reports.salesReport.previousPeriod"))}
          icon={<Trophy className="size-4 text-indigo-600" strokeWidth={1.75} />}
          trend={data.kpis.avgOrder.trend}
        />
        <KpiCard
          label={t("reports.salesReport.kpi.itemsSold")}
          value={`${formatCount(data.kpis.itemsSold.value)} ${t("reports.salesReport.pcs")}`}
          hint={trendText(data.kpis.itemsSold.deltaPct, t("reports.salesReport.previousPeriod"))}
          icon={<PackageCheck className="size-4 text-amber-600" strokeWidth={1.75} />}
          trend={data.kpis.itemsSold.trend}
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_250px]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
            <section className="rounded-xl border border-border bg-surface p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    {t("reports.salesReport.overview.title")}
                  </h2>
                  <p className="mt-0.5 text-xs text-muted">
                    {t("reports.salesReport.overview.subtitle")}
                  </p>
                </div>
                <MoreVertical className="size-4 text-muted" strokeWidth={1.75} />
              </div>
              <SalesOverviewChart bars={data.dailyBars} />
            </section>

            <section className="rounded-xl border border-border bg-surface p-5">
              <h2 className="text-base font-semibold text-foreground">
                {t("reports.salesReport.payment.title")}
              </h2>
              <div className="mt-4 grid place-items-center">
                <div className="relative size-28 overflow-hidden rounded-2xl bg-primary">
                  <div className="absolute -left-5 top-1/2 size-24 -translate-y-1/2 rounded-full bg-blue-500" />
                  <div className="absolute -top-6 left-2 size-20 rounded-full bg-amber-500" />
                  <div className="absolute inset-7 grid place-items-center rounded-xl bg-surface text-primary shadow-sm">
                    <Banknote className="size-7" strokeWidth={1.75} />
                  </div>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {paymentRows.map(([label, amount, color, icon]) => (
                  <div key={label}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                      <span className="inline-flex items-center gap-2 text-muted">
                        <span className={`grid size-6 place-items-center rounded ${color} text-white`}>
                          {icon}
                        </span>
                        {label}
                      </span>
                      <span className="font-semibold text-foreground">{formatTaka(amount)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${color}`}
                        style={{ width: `${Math.max(4, (amount / maxPayment) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="rounded-xl border border-border bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
              <h2 className="text-base font-semibold text-foreground">
                {t("reports.salesReport.topMedicines")}
              </h2>
              <PaginationControls
                page={safeMedicinePage}
                pageCount={medicinePageCount}
                total={data.topSellingMedicines.length}
                pageSize={MEDICINES_PAGE_SIZE}
                onPageChange={setMedicinePage}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border text-left text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-5 py-3 font-semibold">{t("reports.salesReport.table.medicine")}</th>
                    <th className="px-5 py-3 font-semibold">{t("reports.salesReport.table.category")}</th>
                    <th className="px-5 py-3 font-semibold">{t("reports.salesReport.table.unitsSold")}</th>
                    <th className="px-5 py-3 font-semibold">{t("reports.salesReport.table.revenue")}</th>
                    <th className="px-5 py-3 font-semibold">{t("reports.salesReport.table.trend")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visibleMedicines.length ? (
                    visibleMedicines.map((medicine) => (
                      <tr key={medicine.productId} className="hover:bg-slate-50/70">
                        <td className="px-5 py-3 font-medium text-foreground">{medicine.name}</td>
                        <td className="px-5 py-3 text-muted">{medicine.genericName || medicine.sku || "—"}</td>
                        <td className="px-5 py-3 text-foreground">{formatCount(medicine.unitsSold)} {t("reports.salesReport.pcs")}</td>
                        <td className="px-5 py-3 font-semibold text-foreground">{formatTaka(medicine.totalSales)}</td>
                        <td className="px-5 py-3">
                          <span className="inline-flex items-center gap-2 text-primary">
                            <ArrowUp className="size-4" strokeWidth={1.75} />
                            <span className="sr-only">{Math.round((medicine.unitsSold / topMedicineMax) * 100)}%</span>
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-5 py-6 text-center text-muted" colSpan={5}>
                        {t("reports.salesReport.noMedicines")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  {t("reports.salesReport.recentTransactions")}
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  {t("reports.salesReport.recentHint")}
                </p>
              </div>
              <PaginationControls
                page={safeTransactionPage}
                pageCount={transactionPageCount}
                total={data.recentTransactions.length}
                pageSize={TRANSACTIONS_PAGE_SIZE}
                onPageChange={setTransactionPage}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border text-left text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-5 py-3 font-semibold">{t("reports.salesReport.table.invoice")}</th>
                    <th className="px-5 py-3 font-semibold">{t("reports.salesReport.table.date")}</th>
                    <th className="px-5 py-3 font-semibold">{t("reports.salesReport.table.customer")}</th>
                    <th className="px-5 py-3 font-semibold">{t("reports.salesReport.table.items")}</th>
                    <th className="px-5 py-3 font-semibold">{t("reports.salesReport.table.payment")}</th>
                    <th className="px-5 py-3 font-semibold">{t("reports.salesReport.table.total")}</th>
                    <th className="px-5 py-3 font-semibold">{t("reports.salesReport.table.cashier")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visibleTransactions.length ? (
                    visibleTransactions.map((sale) => (
                      <tr key={sale.saleId} className="hover:bg-slate-50/70">
                        <td className="px-5 py-3">
                          <button
                            type="button"
                            className="font-semibold text-primary hover:underline"
                            onClick={() => navigate(`/sales/${sale.saleId}`)}
                          >
                            {sale.invoiceNo ?? sale.saleId}
                          </button>
                        </td>
                        <td className="px-5 py-3 text-muted">{formatSalesDateTime(sale.date)}</td>
                        <td className="px-5 py-3 text-foreground">{sale.customerName ?? t("reports.salesReport.walkIn")}</td>
                        <td className="px-5 py-3 text-foreground">{formatCount(sale.itemCount)}</td>
                        <td className="px-5 py-3 text-foreground">{formatPaymentMethods(sale.paymentMethods, t)}</td>
                        <td className="px-5 py-3 font-semibold text-foreground">{formatTaka(sale.total)}</td>
                        <td className="px-5 py-3 text-foreground">{sale.cashierName}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-5 py-6 text-center text-muted" colSpan={7}>
                        {t("reports.salesReport.noTransactions")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <SideCard title={t("reports.salesReport.bestCategory")}> 
            {data.bestSellingCategory ? (
              <>
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Trophy className="size-5" strokeWidth={1.75} />
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">{data.bestSellingCategory.category}</p>
                    <p className="text-xs text-muted">
                      {topCategoryShare ?? 0}% {t("reports.salesReport.categoryShare")}
                    </p>
                  </div>
                </div>
                <div className="mt-5">
                  <div className="mb-1 flex justify-between text-xs text-muted">
                    <span>{t("reports.salesReport.revenueTarget")}</span>
                    <span>{formatTaka(data.bestSellingCategory.totalSales)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full w-4/5 rounded-full bg-primary" />
                  </div>
                </div>
              </>
            ) : (
              <EmptyText>{t("reports.salesReport.noCategory")}</EmptyText>
            )}
          </SideCard>

          <SideCard title={t("reports.salesReport.highestDay")}> 
            {data.highestSalesDay ? (
              <>
                <p className="text-2xl font-semibold text-foreground">
                  {formatUtcDate(data.highestSalesDay.date)}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {formatCount(data.highestSalesDay.txnCount)} {t("reports.salesReport.transactionsProcessed")}
                </p>
                <p className="mt-3 text-sm font-semibold text-primary">
                  {formatTaka(data.highestSalesDay.totalSales)} {t("reports.salesReport.totalRevenue")}
                </p>
              </>
            ) : (
              <EmptyText>{t("reports.salesReport.noSalesDay")}</EmptyText>
            )}
          </SideCard>

          <SideCard title={t("reports.salesReport.topCashiers")}> 
            {data.topCashiers.length ? (
              <div className="space-y-3">
                {data.topCashiers.slice(0, 3).map((cashier, index) => (
                  <div key={cashier.userId} className="flex items-center gap-3">
                    <span className="grid size-8 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-muted">
                      {initialsFromName(cashier.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{cashier.name}</p>
                      <p className="text-xs text-muted">{formatTaka(cashier.totalSales)}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-muted">
                      #{index + 1}
                    </span>
                  </div>
                ))}
                <button
                  type="button"
                  className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-canvas"
                  onClick={() => navigate("/staff/shifts")}
                >
                  {t("reports.salesReport.viewStaffPerformance")}
                  <ArrowRight className="size-4" strokeWidth={1.75} />
                </button>
              </div>
            ) : (
              <EmptyText>{t("reports.salesReport.noCashiers")}</EmptyText>
            )}
          </SideCard>
        </aside>
      </div>
    </div>
  );
}

function PaginationControls({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const { t } = useLocale();
  const start = total === 0 ? 0 : page * pageSize + 1;
  const end = Math.min(total, (page + 1) * pageSize);
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
      <span>
        {start}-{end} {t("reports.salesReport.pagination.of")} {formatCount(total)}
      </span>
      <div className="inline-flex overflow-hidden rounded-lg border border-border bg-surface">
        <button
          type="button"
          disabled={page <= 0}
          className="px-2.5 py-1.5 font-medium text-foreground hover:bg-canvas disabled:cursor-not-allowed disabled:text-muted"
          onClick={() => onPageChange(Math.max(0, page - 1))}
        >
          {t("reports.salesReport.pagination.prev")}
        </button>
        <span className="border-x border-border px-2.5 py-1.5 font-medium text-foreground">
          {page + 1}/{pageCount}
        </span>
        <button
          type="button"
          disabled={page >= pageCount - 1}
          className="px-2.5 py-1.5 font-medium text-foreground hover:bg-canvas disabled:cursor-not-allowed disabled:text-muted"
          onClick={() => onPageChange(Math.min(pageCount - 1, page + 1))}
        >
          {t("reports.salesReport.pagination.next")}
        </button>
      </div>
    </div>
  );
}

function KpiCard({ label, value, hint, icon, trend }: { label: string; value: string; hint: string; icon: ReactNode; trend: "up" | "down" | "steady" }) {
  return (
    <article className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted">{label}</p>
        <span className="grid size-8 place-items-center rounded-lg bg-slate-50">{icon}</span>
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className={`mt-2 inline-flex items-center gap-1 text-xs ${trend === "down" ? "text-red-600" : trend === "up" ? "text-primary" : "text-muted"}`}>
        {trend === "down" ? <ArrowDown className="size-3" strokeWidth={1.75} /> : trend === "up" ? <ArrowUp className="size-3" strokeWidth={1.75} /> : null}
        {hint}
      </p>
    </article>
  );
}

function SalesOverviewChart({ bars }: { bars: SalesReportPayload["dailyBars"] }) {
  const { t } = useLocale();
  const max = Math.max(1, ...bars.map((bar) => bar.totalSales));
  const highlighted = useMemo(
    () =>
      bars.reduce<SalesReportPayload["dailyBars"][number] | null>(
        (best, bar) => (!best || bar.totalSales > best.totalSales ? bar : best),
        null,
      ),
    [bars],
  );
  return (
    <div className="flex h-56 items-end gap-2 border-t border-border pt-4">
      {bars.map((bar, index) => {
        const height = bar.totalSales > 0 ? Math.max(10, (bar.totalSales / max) * 190) : 4;
        const active = highlighted?.date === bar.date && bar.totalSales > 0;
        const showLabel = index === 0 || index === Math.floor(bars.length / 2) || index === bars.length - 1;
        return (
          <div key={bar.date} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div
              className={`w-full rounded-t-sm ${active ? "bg-primary" : "bg-primary/20"}`}
              style={{ height }}
              title={`${bar.date}: ${formatTaka(bar.totalSales)}`}
            />
            <span className="h-3 w-full truncate text-center text-[10px] font-medium text-muted">
              {showLabel ? formatChartDate(bar.date, t("reports.salesReport.aug")) : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SideCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-wide text-muted">
        {title}
      </h2>
      {children}
    </section>
  );
}

function EmptyText({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}

function trendText(deltaPct: number | null, suffix: string): string {
  if (deltaPct === null) return suffix;
  const sign = deltaPct > 0 ? "+" : deltaPct < 0 ? "-" : "";
  return `${sign}${formatPct(deltaPct)}% ${suffix}`;
}

function formatChartDate(date: string, augLabel: string): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  const day = String(d.getUTCDate());
  const month = d.getUTCMonth() === 7 ? augLabel : new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(d).toUpperCase();
  return `${day} ${month}`;
}

function formatPaymentMethods(
  methods: SalesReportPayload["recentTransactions"][number]["paymentMethods"],
  t: ReturnType<typeof useLocale>["t"],
): string {
  return methods
    .map((method) => {
      if (method === "CASH") return t("reports.salesReport.payment.cash");
      if (method === "CARD") return t("reports.salesReport.payment.card");
      return t("reports.salesReport.payment.mfs");
    })
    .join(" + ");
}
