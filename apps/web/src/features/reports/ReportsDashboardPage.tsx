import {
  Activity,
  ArrowRight,
  Banknote,
  BarChart3,
  Package,
  ReceiptText,
  ShoppingCart,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocale, type MessageKey } from "@/i18n";
import { ApiError } from "@/lib/api";
import { formatCount, formatSalesDateTime, formatTaka } from "@/lib/format";
import {
  fetchOwnerDashboard,
  type OwnerDashboardPayload,
} from "@/lib/ownerDashboard";
import { fetchInventorySummary, type OwnerInventorySummary } from "@/lib/ownerInventory";
import { fetchPurchaseOrders, type PurchaseOrdersResult } from "@/lib/purchaseOrders";
import { useOwnerPath } from "@/lib/OwnerPathProvider";
import { fetchShiftKpis, type ShiftKpis } from "@/lib/shifts";

type ReportsData = {
  dashboard: OwnerDashboardPayload;
  inventory: OwnerInventorySummary;
  purchasing: PurchaseOrdersResult;
  shifts: ShiftKpis;
};

export function ReportsDashboardPage() {
  const { t } = useLocale();
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void Promise.all([
      fetchOwnerDashboard("last7"),
      fetchInventorySummary(),
      fetchPurchaseOrders({ limit: 1, offset: 0 }),
      fetchShiftKpis(),
    ])
      .then(([dashboard, inventory, purchasing, shifts]) => {
        if (cancelled) return;
        setData({ dashboard, inventory, purchasing, shifts });
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setData(null);
        setLoading(false);
        setError(err instanceof ApiError ? err.message : t("reports.error"));
      });
    return () => {
      cancelled = true;
    };
  }, [reload, t]);

  return (
    <div className="w-full px-5 py-4">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted">
            {t("reports.breadcrumb")}
          </p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-foreground">
            {t("reports.title")}
          </h1>
          <p className="mt-1 text-sm text-muted">{t("reports.subtitle")}</p>
        </div>
        <span className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground">
          {t("reports.range.last7")}
        </span>
      </div>

      {loading && !data ? (
        <p className="text-sm text-muted">{t("reports.loading")}</p>
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

      {data ? <ReportsBody data={data} /> : null}
    </div>
  );
}

function ReportsBody({ data }: { data: ReportsData }) {
  const { t } = useLocale();
  const { navigate } = useOwnerPath();
  const { dashboard, inventory, purchasing, shifts } = data;
  const totalPurchaseValue = purchasing.items.reduce(
    (sum, row) => sum + Number(row.estimatedTotal || 0),
    0,
  );
  const purchaseValue = Math.max(totalPurchaseValue, purchasing.kpis.openValue);
  const staffActivity = [
    {
      label: t("reports.staff.active"),
      value: dashboard.staff?.activeCashiers ?? 0,
      tone: "bg-slate-50 text-slate-900",
    },
    {
      label: t("reports.staff.open"),
      value: dashboard.staff?.openShifts ?? shifts.open,
      tone: "bg-teal-50 text-teal-800",
    },
    {
      label: t("reports.staff.closed"),
      value: shifts.closed,
      tone: "bg-blue-50 text-blue-800",
    },
    {
      label: t("reports.staff.flagged"),
      value: shifts.flagged,
      tone: "bg-amber-50 text-amber-800",
    },
  ];
  const recentActivity = useMemo(
    () => buildRecentActivity(data, t),
    [data, t],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={t("reports.kpi.totalSales")}
          value={formatTaka(dashboard.kpis.period.sales)}
          hint={t("reports.kpi.totalSalesHint")}
          icon={<Banknote className="size-4 text-primary" strokeWidth={1.75} />}
        />
        <KpiCard
          label={t("reports.kpi.purchaseValue")}
          value={formatTaka(purchaseValue)}
          hint={t("reports.kpi.purchaseValueHint")}
          icon={<ShoppingCart className="size-4 text-blue-600" strokeWidth={1.75} />}
        />
        <KpiCard
          label={t("reports.kpi.inventoryValue")}
          value={formatTaka(inventory.totals.costValue)}
          hint={t("reports.kpi.inventoryValueHint")}
          icon={<Package className="size-4 text-indigo-600" strokeWidth={1.75} />}
        />
        <KpiCard
          label={t("reports.kpi.activeStaff")}
          value={formatCount(dashboard.staff?.activeCashiers ?? 0)}
          hint={t("reports.kpi.activeStaffHint")}
          icon={<UsersRound className="size-4 text-amber-600" strokeWidth={1.75} />}
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <section className="rounded-xl border border-border bg-surface p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  {t("reports.sales.title")}
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  {t("reports.sales.subtitle")}
                </p>
              </div>
              <button
                type="button"
                className="text-sm font-medium text-primary hover:underline"
                onClick={() => navigate("/sales")}
              >
                {t("reports.sales.topItems")}
              </button>
            </div>
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <MetricTile
                label={t("reports.sales.transactions")}
                value={formatCount(dashboard.salesKpis?.txnCount ?? dashboard.kpis.period.txnCount)}
              />
              <MetricTile
                label={t("reports.sales.avgOrder")}
                value={formatTaka(dashboard.salesKpis?.avgSale ?? dashboard.kpis.period.avgSale)}
              />
            </div>
            <SalesBarChart bars={dashboard.dailyBars} />
          </section>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <ReportCard
              icon={<ReceiptText className="size-4 text-primary" strokeWidth={1.75} />}
              title={t("reports.cards.sales.title")}
              body={t("reports.cards.sales.body")}
              disabledLabel={t("reports.viewReport")}
            />
            <ReportCard
              icon={<Package className="size-4 text-indigo-600" strokeWidth={1.75} />}
              title={t("reports.cards.inventory.title")}
              body={t("reports.cards.inventory.body")}
              disabledLabel={t("reports.viewReport")}
            />
            <ReportCard
              icon={<ShoppingCart className="size-4 text-blue-600" strokeWidth={1.75} />}
              title={t("reports.cards.purchase.title")}
              body={t("reports.cards.purchase.body")}
              disabledLabel={t("reports.viewReport")}
            />
          </section>

          <section className="rounded-xl border border-border bg-surface p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-foreground">
                {t("reports.staff.title")}
              </h2>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                onClick={() => navigate("/staff/shifts")}
              >
                {t("reports.staff.viewShiftReports")}
                <ArrowRight className="size-3.5" strokeWidth={1.75} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {staffActivity.map((item) => (
                <div key={item.label} className={`rounded-lg px-4 py-3 ${item.tone}`}>
                  <p className="text-2xl font-semibold">{formatCount(item.value)}</p>
                  <p className="mt-1 text-[11px] font-medium uppercase tracking-wide">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-4">
          <SummaryCard
            title={t("reports.inventory.title")}
            rows={[
              [t("reports.inventory.totalStock"), formatCount(inventory.totals.onHandPieces)],
              [t("reports.inventory.lowStock"), formatCount(inventory.lowStockCount)],
              [t("reports.inventory.expiring"), formatCount(inventory.expiring30dCount)],
              [t("reports.inventory.outOfStock"), formatCount(inventory.outOfStockCount)],
            ]}
            cta={t("reports.inventory.view")}
            disabled
          />
          <SummaryCard
            title={t("reports.purchasing.title")}
            rows={[
              [t("reports.purchasing.totalPos"), formatCount(purchasing.kpis.total)],
              [t("reports.purchasing.totalValue"), formatTaka(purchaseValue)],
              [t("reports.purchasing.received"), formatCount(purchasing.kpis.byStatus.RECEIVED)],
              [t("reports.purchasing.pending"), formatCount(purchasing.kpis.byStatus.SENT + purchasing.kpis.byStatus.PARTIALLY_RECEIVED)],
            ]}
            cta={t("reports.purchasing.view")}
            disabled
          />
          <SummaryCard
            title={t("reports.shift.title")}
            rows={[
              [t("reports.shift.open"), formatCount(shifts.open)],
              [t("reports.shift.closed"), formatCount(shifts.closed)],
              [t("reports.shift.flagged"), formatCount(shifts.flagged)],
              [t("reports.shift.varianceToday"), formatTaka(dashboard.staff?.cashVarianceToday ?? 0)],
            ]}
            cta={t("reports.shift.view")}
            onClick={() => navigate("/staff/shifts")}
          />
          <section className="rounded-xl border border-border bg-surface p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-foreground">
                {t("reports.recent.title")}
              </h2>
              <Activity className="size-4 text-muted" strokeWidth={1.75} />
            </div>
            <ul className="space-y-3">
              {recentActivity.map((item) => (
                <li key={item.id} className="flex gap-3">
                  <span className="mt-0.5 size-2.5 rounded-full bg-primary/20 ring-4 ring-primary/10" />
                  <span className="min-w-0">
                    <span className="block text-xs text-muted">{item.time}</span>
                    <span className="block text-sm font-medium text-foreground">
                      {item.title}
                    </span>
                    <span className="block text-xs text-muted">{item.subtitle}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function buildRecentActivity(
  data: ReportsData,
  t: (key: MessageKey) => string,
): Array<{ id: string; time: string; title: string; subtitle: string }> {
  const sales = data.dashboard.recentSales.slice(0, 3).map((sale) => ({
    id: `sale-${sale.id}`,
    time: formatSalesDateTime(sale.soldAt),
    title: t("reports.recent.sale"),
    subtitle: `${sale.receiptNo ?? sale.id} · ${formatTaka(sale.total)}`,
  }));
  const system = [
    {
      id: "inventory-alerts",
      time: t("reports.recent.now"),
      title: t("reports.recent.inventory"),
      subtitle: `${formatCount(data.inventory.lowStockCount)} ${t("reports.inventory.lowStock")}`,
    },
    {
      id: "shift-review",
      time: t("reports.recent.now"),
      title: t("reports.recent.shift"),
      subtitle: `${formatCount(data.shifts.flagged)} ${t("reports.shift.flagged")}`,
    },
  ];
  return [...sales, ...system].slice(0, 5);
}

function KpiCard({ label, value, hint, icon }: { label: string; value: string; hint: string; icon: ReactNode }) {
  return (
    <article className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
        <span>{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </article>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-4 py-3">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function SalesBarChart({ bars }: { bars: OwnerDashboardPayload["dailyBars"] }) {
  const max = Math.max(1, ...bars.map((bar) => bar.sales));
  return (
    <div className="flex h-44 items-end gap-2 rounded-xl bg-slate-50 px-4 py-3">
      {bars.map((bar) => {
        const height = bar.sales > 0 ? Math.max(12, (bar.sales / max) * 150) : 4;
        return (
          <div key={bar.date} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div
              className="w-full rounded-t-md bg-primary/65"
              style={{ height }}
              title={`${bar.date}: ${formatTaka(bar.sales)}`}
            />
            <span className="w-full truncate text-center text-[10px] text-muted">
              {bar.date.slice(5)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ReportCard({ icon, title, body, disabledLabel }: { icon: ReactNode; title: string; body: string; disabledLabel: string }) {
  const { t } = useLocale();
  const { navigate } = useOwnerPath();
  const isSalesReport = title === t("reports.cards.sales.title");
  return (
    <article className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-slate-50">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-2 min-h-[2.5rem] text-xs leading-relaxed text-muted">{body}</p>
      <button
        type="button"
        disabled={!isSalesReport}
        aria-disabled={!isSalesReport ? "true" : undefined}
        title={!isSalesReport ? t("reports.disabledHint") : undefined}
        className={`mt-3 inline-flex items-center gap-1 text-xs font-medium ${
          isSalesReport
            ? "text-primary hover:underline"
            : "cursor-not-allowed text-muted"
        }`}
        onClick={isSalesReport ? () => navigate("/reports/sales") : undefined}
      >
        {disabledLabel}
        <ArrowRight className="size-3.5" strokeWidth={1.75} />
      </button>
    </article>
  );
}

function SummaryCard({
  title,
  rows,
  cta,
  disabled,
  onClick,
}: {
  title: string;
  rows: Array<[string, string]>;
  cta: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const { t } = useLocale();
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <BarChart3 className="size-4 text-muted" strokeWidth={1.75} />
      </div>
      <dl className="space-y-2.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 text-sm">
            <dt className="text-muted">{label}</dt>
            <dd className="font-semibold text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
      <button
        type="button"
        disabled={disabled}
        aria-disabled={disabled ? "true" : undefined}
        title={disabled ? t("reports.disabledHint") : undefined}
        className={`mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${
          disabled
            ? "cursor-not-allowed bg-slate-100 text-muted"
            : "bg-primary text-white hover:bg-primary/90"
        }`}
        onClick={onClick}
      >
        {cta}
        <ArrowRight className="size-4" strokeWidth={1.75} />
      </button>
    </section>
  );
}
