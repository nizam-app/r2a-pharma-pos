import { AlertTriangle, Banknote, Clock3, Search, UserRoundCheck } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { FilterDropdown } from "@/features/sales/FilterDropdown";
import { useLocale } from "@/i18n";
import { ApiError } from "@/lib/api";
import { formatCount, formatSalesDateTime, formatTaka } from "@/lib/format";
import { useOwnerPath } from "@/lib/OwnerPathProvider";
import { fetchStaff, type StaffListRow } from "@/lib/staff";
import {
  fetchShiftKpis,
  fetchShifts,
  moneyNumber,
  type ShiftKpis,
  type ShiftListResult,
  type ShiftListRow,
  type ShiftStatus,
} from "@/lib/shifts";
import { ReviewCashVarianceModal } from "./ReviewCashVarianceModal";

const PAGE_SIZE = 25;

type StatusFilter = "ALL" | ShiftStatus;

const EMPTY_RESULT: ShiftListResult = {
  items: [],
  total: 0,
  limit: PAGE_SIZE,
  offset: 0,
};

const EMPTY_KPIS: ShiftKpis = {
  all: 0,
  open: 0,
  closed: 0,
  flagged: 0,
};

export function ShiftManagementPage() {
  const { t } = useLocale();
  const { navigate } = useOwnerPath();

  const [searchInput, setSearchInput] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [cashierId, setCashierId] = useState("ALL");
  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);
  const [reviewShift, setReviewShift] = useState<ShiftListRow | null>(null);

  const [result, setResult] = useState<ShiftListResult>(EMPTY_RESULT);
  const [kpis, setKpis] = useState<ShiftKpis>(EMPTY_KPIS);
  const [staffRows, setStaffRows] = useState<StaffListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearchQ(searchInput.trim());
      setPage(0);
    }, 350);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    setPage(0);
  }, [status, cashierId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const userId = cashierId === "ALL" ? undefined : cashierId;
    const baseQuery = { q: searchQ || undefined, userId };

    void Promise.all([
      fetchShifts({
        ...baseQuery,
        status: status === "ALL" ? undefined : status,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      }),
      fetchShiftKpis(baseQuery),
      fetchStaff({ limit: 100, offset: 0, isActive: "true" }),
    ])
      .then(([shiftResult, shiftKpis, staffResult]) => {
        if (cancelled) return;
        setResult(shiftResult);
        setKpis(shiftKpis);
        setStaffRows(staffResult.items.filter((row) => row.role !== "OWNER"));
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setResult(EMPTY_RESULT);
        setKpis(EMPTY_KPIS);
        setLoading(false);
        if (err instanceof ApiError) setError(err.message);
        else setError(t("shifts.error"));
      });

    return () => {
      cancelled = true;
    };
  }, [searchQ, status, cashierId, page, reload, t]);

  const tabs = useMemo(
    () =>
      [
        { value: "ALL" as const, label: t("shifts.tab.all") },
        { value: "OPEN" as const, label: t("shifts.tab.open") },
        { value: "CLOSED" as const, label: t("shifts.tab.closed") },
        { value: "FLAGGED" as const, label: t("shifts.tab.flagged") },
      ] satisfies Array<{ value: StatusFilter; label: string }>,
    [t],
  );

  const cashierOptions = useMemo(
    () => [
      { value: "ALL", label: t("shifts.filter.cashierAll") },
      ...staffRows.map((row) => ({ value: row.id, label: row.name })),
    ],
    [staffRows, t],
  );

  const fromIdx = result.total === 0 ? 0 : page * PAGE_SIZE + 1;
  const toIdx = Math.min(result.total, (page + 1) * PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  return (
    <div className="w-full px-5 py-4">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted">
            {t("shifts.breadcrumb")}
          </p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-foreground">
            {t("shifts.title")}
          </h1>
          <p className="mt-1 text-sm text-muted">{t("shifts.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted disabled:cursor-not-allowed disabled:opacity-70"
            disabled
            title={t("shifts.disabled.requestCashCountHint")}
          >
            {t("shifts.requestCashCount")}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted disabled:cursor-not-allowed disabled:opacity-70"
            disabled
          >
            {t("shifts.export")}
          </button>
        </div>
      </div>

      {error ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
          <p className="text-destructive">{error}</p>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1 text-foreground hover:bg-canvas"
            onClick={() => setReload((n) => n + 1)}
          >
            {t("shifts.retry")}
          </button>
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label={t("shifts.kpi.all")} value={formatCount(kpis.all)} hint={t("shifts.kpi.allHint")} icon={<Clock3 className="size-4" strokeWidth={1.75} />} />
          <KpiCard label={t("shifts.kpi.open")} value={formatCount(kpis.open)} hint={t("shifts.kpi.openHint")} valueClass="text-primary" icon={<UserRoundCheck className="size-4 text-primary" strokeWidth={1.75} />} />
          <KpiCard label={t("shifts.kpi.closed")} value={formatCount(kpis.closed)} hint={t("shifts.kpi.closedHint")} valueClass="text-emerald-600" icon={<Banknote className="size-4 text-emerald-600" strokeWidth={1.75} />} />
          <KpiCard label={t("shifts.kpi.flagged")} value={formatCount(kpis.flagged)} hint={t("shifts.kpi.flaggedHint")} valueClass="text-amber-600" icon={<AlertTriangle className="size-4 text-amber-600" strokeWidth={1.75} />} />
        </div>

        <section className="rounded-xl border border-border bg-surface">
          <div className="flex flex-wrap items-end justify-between gap-3 px-4 pt-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">{t("shifts.directory")}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-5 border-b border-border">
                {tabs.map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    role="tab"
                    aria-selected={status === tab.value}
                    onClick={() => setStatus(tab.value)}
                    className={`-mb-px border-b-2 pb-2 text-sm ${
                      status === tab.value
                        ? "border-primary font-medium text-primary"
                        : "border-transparent text-muted hover:text-foreground"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 px-4 py-3">
            <label className="relative min-w-[14rem] flex-1">
              <span className="sr-only">{t("shifts.search")}</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted" strokeWidth={1.75} />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t("shifts.searchPlaceholder")}
                className="w-full rounded-md border border-border bg-surface py-1.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted"
              />
            </label>
            <FilterDropdown
              fieldLabel={t("shifts.filter.cashier")}
              value={cashierId}
              options={cashierOptions}
              onChange={setCashierId}
              ariaLabel={t("shifts.filter.cashier")}
            />
          </div>

          {loading ? (
            <p className="px-4 py-6 text-sm text-muted">{t("shifts.loading")}</p>
          ) : result.items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">{t("shifts.empty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[58rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-slate-50 text-xs font-medium uppercase tracking-wide text-muted">
                    <th className="px-4 py-2 font-medium">{t("shifts.col.shift")}</th>
                    <th className="px-4 py-2 font-medium">{t("shifts.col.cashier")}</th>
                    <th className="px-4 py-2 font-medium">{t("shifts.col.opened")}</th>
                    <th className="px-4 py-2 font-medium">{t("shifts.col.closed")}</th>
                    <th className="px-4 py-2 font-medium">{t("shifts.col.cashSales")}</th>
                    <th className="px-4 py-2 font-medium">{t("shifts.col.variance")}</th>
                    <th className="px-4 py-2 font-medium">{t("shifts.col.txns")}</th>
                    <th className="px-4 py-2 font-medium">{t("shifts.col.status")}</th>
                    <th className="px-4 py-2 font-medium">{t("shifts.col.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((row) => (
                    <ShiftRow
                      key={row.id}
                      row={row}
                      onOpen={() => navigate(`/staff/shifts/${encodeURIComponent(row.id)}`)}
                      onReview={() => setReviewShift(row)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-sm text-muted">
            <p>
              {t("shifts.showing")} {formatCount(fromIdx)}–{formatCount(toIdx)} {t("shifts.of")} {formatCount(result.total)} {t("shifts.shifts")}
            </p>
            <Pagination page={page} pageCount={pageCount} onPage={setPage} />
          </div>
        </section>
      </div>

      {reviewShift ? (
        <ReviewCashVarianceModal
          shift={reviewShift}
          onCancel={() => setReviewShift(null)}
          onResolved={() => {
            setReviewShift(null);
            setReload((n) => n + 1);
          }}
        />
      ) : null}
    </div>
  );
}

function ShiftRow({ row, onOpen, onReview }: { row: ShiftListRow; onOpen: () => void; onReview: () => void }) {
  const { t } = useLocale();
  const variance = moneyNumber(row.variance);
  return (
    <tr className="cursor-pointer border-b border-border last:border-b-0 hover:bg-canvas" onClick={onOpen}>
      <td className="px-4 py-3">
        <button
          type="button"
          className="font-semibold text-primary hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
        >
          {row.shiftNo}
        </button>
        <p className="text-xs text-muted">{t("shifts.openingFloat")}: {formatTaka(moneyNumber(row.openingFloat))}</p>
      </td>
      <td className="px-4 py-3 text-foreground">{row.user?.name ?? "—"}</td>
      <td className="px-4 py-3 text-foreground">{formatSalesDateTime(row.openedAt)}</td>
      <td className="px-4 py-3 text-foreground">{row.closedAt ? formatSalesDateTime(row.closedAt) : "—"}</td>
      <td className="px-4 py-3 text-foreground">{formatTaka(moneyNumber(row.cashSales))}</td>
      <td className={`px-4 py-3 font-medium ${variance === 0 ? "text-foreground" : "text-amber-700"}`}>{formatTaka(variance)}</td>
      <td className="px-4 py-3 text-foreground">{formatCount(row.txnCount)}</td>
      <td className="px-4 py-3"><ShiftStatusBadge status={row.status} /></td>
      <td className="px-4 py-3">
        {row.status === "FLAGGED" ? (
          <button
            type="button"
            className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100"
            onClick={(event) => {
              event.stopPropagation();
              onReview();
            }}
          >
            {t("shifts.action.review")}
          </button>
        ) : (
          <span className="text-xs font-medium text-primary">{t("shifts.action.view")}</span>
        )}
      </td>
    </tr>
  );
}

function ShiftStatusBadge({ status }: { status: ShiftStatus }) {
  const { t } = useLocale();
  const tone =
    status === "OPEN"
      ? "bg-teal-200/70 text-teal-800"
      : status === "FLAGGED"
      ? "bg-amber-100 text-amber-700"
      : "bg-slate-200 text-slate-600";
  return <span className={`rounded-sm px-2 py-1 text-[10px] font-medium ${tone}`}>{t(`shifts.status.${status}`)}</span>;
}

function KpiCard({ label, value, hint, icon, valueClass }: { label: string; value: string; hint: string; icon: ReactNode; valueClass?: string }) {
  return (
    <article className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
        <span className="text-muted">{icon}</span>
      </div>
      <p className={`mt-2 text-2xl font-semibold tracking-tight ${valueClass ?? "text-foreground"}`}>{value}</p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </article>
  );
}

function Pagination({ page, pageCount, onPage }: { page: number; pageCount: number; onPage: (page: number) => void }) {
  const { t } = useLocale();
  return (
    <div className="flex items-center gap-1">
      <button type="button" disabled={page <= 0} className="rounded-md border border-border px-2.5 py-1 text-foreground disabled:cursor-not-allowed disabled:text-muted" onClick={() => onPage(page - 1)}>{t("sales.prev")}</button>
      <span className="px-2 text-muted">{formatCount(page + 1)} / {formatCount(pageCount)}</span>
      <button type="button" disabled={page >= pageCount - 1} className="rounded-md border border-border px-2.5 py-1 text-foreground disabled:cursor-not-allowed disabled:text-muted" onClick={() => onPage(page + 1)}>{t("sales.next")}</button>
    </div>
  );
}
