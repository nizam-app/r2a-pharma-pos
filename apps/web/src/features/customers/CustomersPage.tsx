import { UserPlus, Users } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { FilterDropdown } from "@/features/sales/FilterDropdown";
import { useLocale } from "@/i18n";
import { ApiError } from "@/lib/api";
import {
  fetchCustomers,
  type CustomerListRow,
  type CustomerSource,
  type CustomerStatus,
  type CustomersResult,
} from "@/lib/customers";
import { formatCount, formatSalesDateTime } from "@/lib/format";
import { useOwnerPath } from "@/lib/OwnerPathProvider";

const PAGE_SIZE = 25;

type StatusFilter = "ALL" | CustomerStatus;
type SourceFilter = "ALL" | CustomerSource;
type SortFilter = "name" | "createdAt" | "loyaltyPoints";

const EMPTY_RESULT: CustomersResult = {
  items: [],
  total: 0,
  limit: PAGE_SIZE,
  offset: 0,
  kpis: { registered: 0, pending: 0, active90d: 0, loyaltyPointsIssued: 0 },
};

/**
 * Customers directory (Batch AH). Content region only — chrome is Batch B.
 * Live GET /owner/customers. Add Customer → /customers/new; Pending rows →
 * /customers/:id/review; Active/Inactive rows → /customers/:id.
 */
export function CustomersPage() {
  const { t } = useLocale();
  const { navigate } = useOwnerPath();

  const [searchInput, setSearchInput] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [source, setSource] = useState<SourceFilter>("ALL");
  const [sort, setSort] = useState<SortFilter>("name");
  const [page, setPage] = useState(0);

  const [result, setResult] = useState<CustomersResult>(EMPTY_RESULT);
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
  }, [status, source, sort]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetchCustomers({
      q: searchQ || undefined,
      status: status === "ALL" ? undefined : status,
      source: source === "ALL" ? undefined : source,
      sort,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    })
      .then((res) => {
        if (cancelled) return;
        setResult(res);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setResult(EMPTY_RESULT);
        setLoading(false);
        if (err instanceof ApiError) setError(err.message);
        else setError(t("customers.error"));
      });

    return () => {
      cancelled = true;
    };
  }, [searchQ, status, source, sort, page, reload, t]);

  const sourceOptions = useMemo(
    () =>
      [
        { value: "ALL" as const, label: t("customers.filter.sourceAll") },
        { value: "OWNER_CREATED" as const, label: t("customers.source.ownerCreated") },
        { value: "POS_REGISTRATION" as const, label: t("customers.source.posRegistration") },
      ] satisfies Array<{ value: SourceFilter; label: string }>,
    [t],
  );

  const sortOptions = useMemo(
    () =>
      [
        { value: "name" as const, label: t("customers.sort.name") },
        { value: "createdAt" as const, label: t("customers.sort.createdAt") },
        { value: "loyaltyPoints" as const, label: t("customers.sort.loyaltyPoints") },
      ] satisfies Array<{ value: SortFilter; label: string }>,
    [t],
  );

  const tabs = useMemo(
    () =>
      [
        { value: "ALL" as const, label: t("customers.tab.all") },
        { value: "PENDING_APPROVAL" as const, label: t("customers.tab.pending") },
        { value: "ACTIVE" as const, label: t("customers.tab.active") },
        { value: "INACTIVE" as const, label: t("customers.tab.inactive") },
      ] satisfies Array<{ value: StatusFilter; label: string }>,
    [t],
  );

  const fromIdx = result.total === 0 ? 0 : page * PAGE_SIZE + 1;
  const toIdx = Math.min(result.total, (page + 1) * PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  return (
    <div className="w-full px-5 py-4">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted">
            {t("page.customersTitle")}
          </p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-foreground">
            {t("page.customersTitle")}
          </h1>
          <p className="mt-1 text-sm text-muted">{t("customers.subtitle")}</p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          onClick={() => navigate("/customers/new")}
        >
          <UserPlus className="size-3.5" strokeWidth={1.75} />
          {t("customers.addCustomer")}
        </button>
      </div>

      {loading && result.items.length === 0 && !error ? (
        <p className="mb-4 text-sm text-muted">{t("customers.loading")}</p>
      ) : null}

      {error ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
          <p className="text-destructive">{error}</p>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1 text-foreground hover:bg-canvas"
            onClick={() => setReload((n) => n + 1)}
          >
            {t("customers.retry")}
          </button>
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label={t("customers.kpi.registered")}
            value={formatCount(result.kpis.registered)}
            hint={t("customers.kpi.registeredHint")}
            icon={<Users className="size-4" strokeWidth={1.75} />}
          />
          <KpiCard
            label={t("customers.kpi.pending")}
            value={formatCount(result.kpis.pending)}
            hint={t("customers.kpi.pendingHint")}
            valueClass="text-amber-600"
            icon={<Users className="size-4 text-amber-600" strokeWidth={1.75} />}
          />
          <KpiCard
            label={t("customers.kpi.active90")}
            value={formatCount(result.kpis.active90d)}
            hint={t("customers.kpi.active90Hint")}
            valueClass="text-primary"
            icon={<Users className="size-4 text-primary" strokeWidth={1.75} />}
          />
          <KpiCard
            label={t("customers.kpi.loyalty")}
            value={formatCount(result.kpis.loyaltyPointsIssued)}
            hint={t("customers.kpi.loyaltyHint")}
            icon={<Users className="size-4" strokeWidth={1.75} />}
          />
        </div>

        <section className="rounded-xl border border-border bg-surface">
          <div className="flex flex-wrap items-end justify-between gap-3 px-4 pt-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {t("customers.directory")}
              </h2>
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
              <span className="sr-only">{t("customers.search")}</span>
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t("customers.searchPlaceholder")}
                className="w-full rounded-md border border-border bg-surface py-1.5 pl-3 pr-3 text-sm text-foreground placeholder:text-muted"
              />
            </label>
            <FilterDropdown
              fieldLabel={t("customers.filter.status")}
              value={status}
              options={tabs}
              onChange={setStatus}
              ariaLabel={t("customers.filter.status")}
            />
            <FilterDropdown
              fieldLabel={t("customers.filter.source")}
              value={source}
              options={sourceOptions}
              onChange={setSource}
              ariaLabel={t("customers.filter.source")}
            />
            <FilterDropdown
              fieldLabel={t("customers.filter.sort")}
              value={sort}
              options={sortOptions}
              onChange={setSort}
              ariaLabel={t("customers.filter.sort")}
            />
          </div>

          {loading ? (
            <p className="px-4 py-6 text-sm text-muted">{t("customers.loading")}</p>
          ) : result.items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">{t("customers.empty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-slate-50 text-xs font-medium uppercase tracking-wide text-muted">
                    <th className="px-4 py-2 font-medium">
                      {t("customers.col.customer")}
                    </th>
                    <th className="px-4 py-2 font-medium">
                      {t("customers.col.phone")}
                    </th>
                    <th className="px-4 py-2 font-medium">
                      {t("customers.col.source")}
                    </th>
                    <th className="px-4 py-2 font-medium">
                      {t("customers.col.loyaltyPoints")}
                    </th>
                    <th className="px-4 py-2 font-medium">
                      {t("customers.col.registered")}
                    </th>
                    <th className="px-4 py-2 font-medium">
                      {t("customers.col.status")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((row) => (
                    <CustomerRow
                      key={row.id}
                      row={row}
                      onOpen={() => navigate(customerDetailPath(row))}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-sm text-muted">
            <p>
              {t("customers.showing")} {formatCount(fromIdx)}–
              {formatCount(toIdx)} {t("customers.of")} {formatCount(result.total)}{" "}
              {t("customers.customers")}
            </p>
            <Pagination page={page} pageCount={pageCount} onPage={setPage} />
          </div>
        </section>
      </div>
    </div>
  );
}

function customerDetailPath(row: CustomerListRow): string {
  if (row.status === "PENDING_APPROVAL") {
    return `/customers/${encodeURIComponent(row.id)}/review`;
  }
  return `/customers/${encodeURIComponent(row.id)}`;
}

function CustomerRow({
  row,
  onOpen,
}: {
  row: CustomerListRow;
  onOpen: () => void;
}) {
  const { t } = useLocale();
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
      <td className="px-4 py-3 text-foreground">{row.phone}</td>
      <td className="px-4 py-3 text-foreground">
        {t(
          row.source === "OWNER_CREATED"
            ? "customers.source.ownerCreated"
            : "customers.source.posRegistration",
        )}
      </td>
      <td className="px-4 py-3 font-medium text-foreground">
        {formatCount(row.loyaltyPoints)}
      </td>
      <td className="px-4 py-3 text-foreground">
        {formatSalesDateTime(row.createdAt)}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={row.status} />
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: CustomerStatus }) {
  const { t } = useLocale();
  const label = t(
    status === "ACTIVE"
      ? "customers.status.active"
      : status === "PENDING_APPROVAL"
        ? "customers.status.pending"
        : "customers.status.inactive",
  );
  const tone =
    status === "ACTIVE"
      ? "bg-teal-200/70 text-teal-800"
      : status === "PENDING_APPROVAL"
        ? "bg-amber-100 text-amber-700"
        : "bg-slate-200 text-slate-500";
  return (
    <span className={`rounded-sm px-2 py-1 text-[10px] font-medium ${tone}`}>
      {label}
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
