import { Clock3, Shield, ShieldCheck, UserPlus, Users } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { FilterDropdown } from "@/features/sales/FilterDropdown";
import { useLocale } from "@/i18n";
import { ApiError } from "@/lib/api";
import {
  fetchStaff,
  type StaffListRow,
  type StaffResult,
  type UserRole,
} from "@/lib/staff";
import { formatCount, formatSalesDateTime } from "@/lib/format";
import { useOwnerPath } from "@/lib/OwnerPathProvider";

const PAGE_SIZE = 25;

type RoleFilter = "ALL" | UserRole;
type StatusFilter = "ALL" | "true" | "false";

const EMPTY_RESULT: StaffResult = {
  items: [],
  total: 0,
  limit: PAGE_SIZE,
  offset: 0,
  kpis: { total: 0, active: 0, inactive: 0, cashiers: 0 },
};

/**
 * Staff directory (Batch AQ). Content region only — chrome is Batch B.
 * Live GET /owner/users. Add Staff → /staff/new, View → /staff/:id.
 * Derived username column; Last Active from lastLoginAt or em dash.
 */
export function StaffPage() {
  const { t } = useLocale();
  const { navigate } = useOwnerPath();

  const [searchInput, setSearchInput] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [role, setRole] = useState<RoleFilter>("ALL");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [page, setPage] = useState(0);

  const [result, setResult] = useState<StaffResult>(EMPTY_RESULT);
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
  }, [role, status]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetchStaff({
      q: searchQ || undefined,
      role: role === "ALL" ? undefined : role,
      isActive: status === "ALL" ? undefined : (status as "true" | "false"),
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
        else setError(t("staff.error"));
      });

    return () => {
      cancelled = true;
    };
  }, [searchQ, role, status, page, reload, t]);

  const roleOptions = useMemo(
    () =>
      [
        { value: "ALL" as const, label: t("staff.filter.roleAll") },
        { value: "OWNER" as const, label: t("staff.role.owner") },
        { value: "MANAGER" as const, label: t("staff.role.manager") },
        { value: "CASHIER" as const, label: t("staff.role.cashier") },
      ] satisfies Array<{ value: RoleFilter; label: string }>,
    [t],
  );

  const tabs = useMemo(
    () =>
      [
        { value: "ALL" as const, label: t("staff.tab.all") },
        { value: "true" as const, label: t("staff.tab.active") },
        { value: "false" as const, label: t("staff.tab.inactive") },
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
            {t("page.staffTitle")}
          </p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-foreground">
            {t("page.staffTitle")}
          </h1>
          <p className="mt-1 text-sm text-muted">{t("staff.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground hover:bg-canvas"
            onClick={() => navigate("/staff/shifts")}
          >
            <Clock3 className="size-3.5" strokeWidth={1.75} />
            {t("staff.shiftManagement")}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            onClick={() => navigate("/staff/new")}
          >
            <UserPlus className="size-3.5" strokeWidth={1.75} />
            {t("staff.addStaff")}
          </button>
        </div>
      </div>

      {loading && result.items.length === 0 && !error ? (
        <p className="mb-4 text-sm text-muted">{t("staff.loading")}</p>
      ) : null}

      {error ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
          <p className="text-destructive">{error}</p>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1 text-foreground hover:bg-canvas"
            onClick={() => setReload((n) => n + 1)}
          >
            {t("staff.retry")}
          </button>
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label={t("staff.kpi.total")}
            value={formatCount(result.kpis.total)}
            hint={t("staff.kpi.totalHint")}
            icon={<Users className="size-4" strokeWidth={1.75} />}
          />
          <KpiCard
            label={t("staff.kpi.active")}
            value={formatCount(result.kpis.active)}
            hint={t("staff.kpi.activeHint")}
            valueClass="text-emerald-600"
            icon={<ShieldCheck className="size-4 text-emerald-600" strokeWidth={1.75} />}
          />
          <KpiCard
            label={t("staff.kpi.inactive")}
            value={formatCount(result.kpis.inactive)}
            hint={t("staff.kpi.inactiveHint")}
            valueClass="text-amber-600"
            icon={<Shield className="size-4 text-amber-600" strokeWidth={1.75} />}
          />
          <KpiCard
            label={t("staff.kpi.cashiers")}
            value={formatCount(result.kpis.cashiers)}
            hint={t("staff.kpi.cashiersHint")}
            valueClass="text-primary"
            icon={<Users className="size-4 text-primary" strokeWidth={1.75} />}
          />
        </div>

        <section className="rounded-xl border border-border bg-surface">
          <div className="flex flex-wrap items-end justify-between gap-3 px-4 pt-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {t("staff.directory")}
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
              <span className="sr-only">{t("staff.directory")}</span>
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t("staff.directory")}
                className="w-full rounded-md border border-border bg-surface py-1.5 pl-3 pr-3 text-sm text-foreground placeholder:text-muted"
              />
            </label>
            <FilterDropdown
              fieldLabel={t("staff.filter.role")}
              value={role}
              options={roleOptions}
              onChange={setRole}
              ariaLabel={t("staff.filter.role")}
            />
          </div>

          {loading ? (
            <p className="px-4 py-6 text-sm text-muted">{t("staff.loading")}</p>
          ) : result.items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">{t("staff.empty")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-slate-50 text-xs font-medium uppercase tracking-wide text-muted">
                    <th className="px-4 py-2 font-medium">
                      {t("staff.col.name")}
                    </th>
                    <th className="px-4 py-2 font-medium">
                      {t("staff.col.username")}
                    </th>
                    <th className="px-4 py-2 font-medium">
                      {t("staff.col.role")}
                    </th>
                    <th className="px-4 py-2 font-medium">
                      {t("staff.col.phone")}
                    </th>
                    <th className="px-4 py-2 font-medium">
                      {t("staff.col.store")}
                    </th>
                    <th className="px-4 py-2 font-medium">
                      {t("staff.col.lastActive")}
                    </th>
                    <th className="px-4 py-2 font-medium">
                      {t("staff.col.status")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((row) => (
                    <StaffRow
                      key={row.id}
                      row={row}
                      onOpen={() => navigate(`/staff/${encodeURIComponent(row.id)}`)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-sm text-muted">
            <p>
              {t("staff.showing")} {formatCount(fromIdx)}–
              {formatCount(toIdx)} {t("staff.of")} {formatCount(result.total)}{" "}
              {t("staff.staff")}
            </p>
            <Pagination page={page} pageCount={pageCount} onPage={setPage} />
          </div>
        </section>
      </div>
    </div>
  );
}

function StaffRow({
  row,
  onOpen,
}: {
  row: StaffListRow;
  onOpen: () => void;
}) {
  const { t } = useLocale();

  const roleLabel = useMemo(() => {
    if (row.role === "OWNER") return t("staff.role.owner");
    if (row.role === "MANAGER") return t("staff.role.manager");
    return t("staff.role.cashier");
  }, [row.role, t]);

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
        <p className="text-xs text-muted">{row.email}</p>
      </td>
      <td className="px-4 py-3 text-foreground font-mono text-xs">{row.username}</td>
      <td className="px-4 py-3 text-foreground">{roleLabel}</td>
      <td className="px-4 py-3 text-foreground">{row.phone || "—"}</td>
      <td className="px-4 py-3 text-foreground">{row.storeName || "—"}</td>
      <td className="px-4 py-3 text-foreground">
        {row.lastLoginAt ? formatSalesDateTime(row.lastLoginAt) : "—"}
      </td>
      <td className="px-4 py-3">
        <StatusBadge isActive={row.isActive} />
      </td>
    </tr>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  const { t } = useLocale();
  const label = t(isActive ? "staff.status.active" : "staff.status.inactive");
  const tone = isActive ? "bg-teal-200/70 text-teal-800" : "bg-slate-200 text-slate-500";
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
