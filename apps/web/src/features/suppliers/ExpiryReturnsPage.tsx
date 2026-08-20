import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Download,
  FilePlus2,
  Info,
  Printer,
  Search,
  Wallet,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FilterDropdown } from "@/features/sales/FilterDropdown";
import { useLocale, type MessageKey } from "@/i18n";
import { ApiError } from "@/lib/api";
import { formatCount, formatTaka, formatUtcDate } from "@/lib/format";
import { daysUntilExpiry } from "@/lib/ownerExpiry";
import { useOwnerPath } from "@/lib/OwnerPathProvider";
import {
  fetchReturnQueue,
  writeReturnManifestDraft,
  type ReturnQueueKpis,
  type ReturnQueueRow,
  type ReturnStatus,
} from "@/lib/returnQueue";

const PAGE_SIZE = 25;
const EMPTY_KPIS: ReturnQueueKpis = {
  eligibleBatches: 0,
  eligibleCostValue: 0,
  manifestsPrepared: 0,
  needsReview: 0,
};

type StatusFilter = "ALL" | ReturnStatus;

const STATUS_KEYS: Record<ReturnStatus, MessageKey> = {
  ELIGIBLE: "suppliers.returns.status.eligible",
  MANIFEST_PREPARED: "suppliers.returns.status.prepared",
  NOT_ELIGIBLE: "suppliers.returns.status.notEligible",
};

function isSelectable(row: ReturnQueueRow): boolean {
  return row.returnStatus === "ELIGIBLE" && Boolean(row.supplierId);
}

/**
 * Expiry Returns queue (Batch AA). Content region only — chrome is Batch B.
 * Live GET /owner/returns/queue. Create Manifest navigates to
 * `/suppliers/returns/new` (layout is Batch AB). Mixed-supplier selection
 * cannot proceed. Export / Print stay disabled.
 */
export function ExpiryReturnsPage() {
  const { t } = useLocale();
  const { navigate } = useOwnerPath();

  const [searchInput, setSearchInput] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [supplierId, setSupplierId] = useState("ALL");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [page, setPage] = useState(0);

  const [rows, setRows] = useState<ReturnQueueRow[]>([]);
  const [total, setTotal] = useState(0);
  const [kpis, setKpis] = useState<ReturnQueueKpis>(EMPTY_KPIS);
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>(
    [],
  );
  const [selected, setSelected] = useState<Map<string, ReturnQueueRow>>(
    () => new Map(),
  );
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
    setSelected(new Map());
  }, [searchQ, supplierId, status]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetchReturnQueue({
      q: searchQ || undefined,
      supplierId: supplierId === "ALL" ? undefined : supplierId,
      returnStatus: status === "ALL" ? undefined : status,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    })
      .then((result) => {
        if (cancelled) return;
        setRows(result.items);
        setTotal(result.total);
        setKpis(result.kpis);
        setSuppliers(result.suppliers);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setRows([]);
        setTotal(0);
        setLoading(false);
        if (err instanceof ApiError) setError(err.message);
        else setError(t("suppliers.returns.error"));
      });

    return () => {
      cancelled = true;
    };
  }, [searchQ, supplierId, status, page, reload, t]);

  const selectedRows = useMemo(() => [...selected.values()], [selected]);
  const selectedSupplierIds = useMemo(() => {
    const ids = new Set<string>();
    for (const row of selectedRows) {
      if (row.supplierId) ids.add(row.supplierId);
    }
    return ids;
  }, [selectedRows]);
  const mixedSupplier = selectedSupplierIds.size > 1;
  const canCreate =
    selectedRows.length > 0 &&
    !mixedSupplier &&
    selectedRows.every(isSelectable);
  const selectedSupplier = canCreate ? selectedRows[0] : undefined;
  const selectedQty = selectedRows.reduce(
    (sum, row) => sum + row.quantityOnHand,
    0,
  );
  const selectedCost = selectedRows.reduce((sum, row) => sum + row.costValue, 0);

  const selectableOnPage = rows.filter(isSelectable);
  const selectedOnPage = selectableOnPage.filter((row) => selected.has(row.id));
  const allOnPageSelected =
    selectableOnPage.length > 0 &&
    selectedOnPage.length === selectableOnPage.length;
  const someOnPageSelected =
    selectedOnPage.length > 0 && !allOnPageSelected;

  const hasFilters =
    searchQ.length > 0 || supplierId !== "ALL" || status !== "ALL";
  const fromIdx = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const toIdx = Math.min(total, (page + 1) * PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const supplierOptions = useMemo(
    () => [
      { value: "ALL" as const, label: t("suppliers.returns.filter.supplierAll") },
      ...suppliers.map((item) => ({ value: item.id, label: item.name })),
    ],
    [suppliers, t],
  );

  const statusOptions = useMemo(
    () =>
      [
        { value: "ALL" as const, label: t("suppliers.returns.filter.statusAll") },
        { value: "ELIGIBLE" as const, label: t("suppliers.returns.status.eligible") },
        {
          value: "MANIFEST_PREPARED" as const,
          label: t("suppliers.returns.status.prepared"),
        },
        {
          value: "NOT_ELIGIBLE" as const,
          label: t("suppliers.returns.status.notEligible"),
        },
      ] satisfies Array<{ value: StatusFilter; label: string }>,
    [t],
  );

  function toggleRow(row: ReturnQueueRow) {
    if (!isSelectable(row)) return;
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(row.id)) next.delete(row.id);
      else next.set(row.id, row);
      return next;
    });
  }

  function toggleCurrentPage() {
    setSelected((current) => {
      const next = new Map(current);
      if (allOnPageSelected) {
        for (const row of selectableOnPage) next.delete(row.id);
      } else {
        for (const row of selectableOnPage) next.set(row.id, row);
      }
      return next;
    });
  }

  function openCreateManifest() {
    if (!canCreate || !selectedSupplier?.supplierId) return;
    writeReturnManifestDraft({
      supplierId: selectedSupplier.supplierId,
      supplierName:
        selectedSupplier.supplier?.name ??
        selectedSupplier.supplierName ??
        "",
      batchIds: selectedRows.map((row) => row.id),
    });
    navigate("/suppliers/returns/new");
  }

  const createDisabledTitle = mixedSupplier
    ? t("suppliers.returns.mixedSupplier")
    : t("suppliers.returns.createDisabled");

  return (
    <div className="w-full px-5 py-4">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-1.5 text-xs text-muted">
            <button
              type="button"
              className="hover:text-primary"
              onClick={() => navigate("/suppliers")}
            >
              {t("page.suppliersTitle")}
            </button>
            <span aria-hidden="true">›</span>
            <span>{t("suppliers.returns.title")}</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t("suppliers.returns.title")}
          </h1>
          <p className="mt-1 text-sm text-muted">{t("suppliers.returns.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled
            aria-disabled="true"
            title={t("suppliers.returns.exportSoon")}
            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-border bg-slate-100 px-3 py-1.5 text-sm font-medium text-muted"
          >
            <Download className="size-3.5" strokeWidth={1.75} />
            {t("suppliers.returns.export")}
          </button>
          <button
            type="button"
            disabled
            aria-disabled="true"
            title={t("suppliers.returns.printSoon")}
            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-border bg-slate-100 px-3 py-1.5 text-sm font-medium text-muted"
          >
            <Printer className="size-3.5" strokeWidth={1.75} />
            {t("suppliers.returns.print")}
          </button>
          <CreateManifestButton
            enabled={canCreate}
            disabledTitle={createDisabledTitle}
            onClick={openCreateManifest}
          />
        </div>
      </div>

      {loading && rows.length === 0 && !error ? (
        <p className="text-sm text-muted">{t("suppliers.returns.loading")}</p>
      ) : null}

      {error ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
          <p className="text-destructive">{error}</p>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1 text-foreground hover:bg-canvas"
            onClick={() => setReload((n) => n + 1)}
          >
            {t("suppliers.returns.retry")}
          </button>
        </div>
      ) : null}

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label={t("suppliers.returns.kpi.eligible")}
            value={formatCount(kpis.eligibleBatches)}
            hint={t("suppliers.returns.kpi.eligibleHint")}
            icon={<ClipboardList className="size-4 text-primary" strokeWidth={1.75} />}
            valueClass="text-primary"
          />
          <KpiCard
            label={t("suppliers.returns.kpi.eligibleValue")}
            value={formatTaka(kpis.eligibleCostValue)}
            hint={t("suppliers.returns.kpi.eligibleValueHint")}
            icon={<Wallet className="size-4 text-primary" strokeWidth={1.75} />}
            valueClass="text-primary"
          />
          <KpiCard
            label={t("suppliers.returns.kpi.prepared")}
            value={formatCount(kpis.manifestsPrepared)}
            hint={t("suppliers.returns.kpi.preparedHint")}
            icon={
              <ClipboardCheck className="size-4 text-indigo-600" strokeWidth={1.75} />
            }
          />
          <KpiCard
            label={t("suppliers.returns.kpi.review")}
            value={formatCount(kpis.needsReview)}
            hint={t("suppliers.returns.kpi.reviewHint")}
            icon={<AlertCircle className="size-4 text-red-600" strokeWidth={1.75} />}
            valueClass="text-red-600"
          />
        </div>

        <section className="overflow-hidden rounded-xl border border-border bg-surface">
          {selectedRows.length > 0 ? (
            <div className="flex flex-col gap-3 bg-primary px-4 py-3 text-primary-foreground md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <CheckCircle2 className="size-4 shrink-0" strokeWidth={1.75} />
                <span className="font-medium">
                  {formatCount(selectedRows.length)} {t("suppliers.returns.selected")}
                </span>
                {mixedSupplier ? (
                  <>
                    <span aria-hidden="true" className="hidden text-white/50 md:inline">
                      |
                    </span>
                    <span>{t("suppliers.returns.mixedSupplier")}</span>
                  </>
                ) : (
                  <>
                    <span aria-hidden="true" className="hidden text-white/50 md:inline">
                      |
                    </span>
                    <span>
                      {selectedSupplier?.supplier?.name ??
                        selectedSupplier?.supplierName ??
                        "—"}
                    </span>
                    <span aria-hidden="true" className="hidden text-white/50 md:inline">
                      |
                    </span>
                    <span>
                      {formatCount(selectedQty)} {t("suppliers.returns.pcs")}
                    </span>
                    <span aria-hidden="true" className="hidden text-white/50 md:inline">
                      |
                    </span>
                    <span>
                      {formatTaka(selectedCost)} {t("suppliers.returns.costValue")}
                    </span>
                  </>
                )}
              </div>
              <button
                type="button"
                disabled={!canCreate}
                title={canCreate ? undefined : createDisabledTitle}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-white px-3 text-sm font-medium text-primary disabled:cursor-not-allowed disabled:opacity-50"
                onClick={openCreateManifest}
              >
                <FilePlus2 className="size-3.5" strokeWidth={1.75} />
                {t("suppliers.returns.createManifest")}
              </button>
            </div>
          ) : null}

          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {t("suppliers.returns.queueTitle")}
              </h2>
              <p className="mt-0.5 text-xs text-muted">
                {t("suppliers.returns.queueHint")}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="relative min-w-0 flex-1 sm:max-w-sm">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted"
                strokeWidth={1.75}
              />
              <span className="sr-only">{t("suppliers.returns.search")}</span>
              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={t("suppliers.returns.searchPlaceholder")}
                className="h-8 w-full rounded-md border border-border bg-surface py-1.5 pl-8 pr-3 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <FilterDropdown
                fieldLabel={t("suppliers.returns.filter.supplier")}
                value={supplierId}
                options={supplierOptions}
                ariaLabel={t("suppliers.returns.filter.supplier")}
                onChange={setSupplierId}
              />
              <FilterDropdown
                fieldLabel={t("suppliers.returns.filter.status")}
                value={status}
                options={statusOptions}
                ariaLabel={t("suppliers.returns.filter.status")}
                onChange={setStatus}
              />
            </div>
          </div>

          {rows.length === 0 && !loading ? (
            <div className="px-4 py-8 text-center text-sm text-muted">
              <p>
                {hasFilters
                  ? t("suppliers.returns.emptyFiltered")
                  : t("suppliers.returns.empty")}
              </p>
              {hasFilters ? (
                <button
                  type="button"
                  className="mt-2 text-sm font-medium text-primary hover:underline"
                  onClick={() => {
                    setSearchInput("");
                    setSearchQ("");
                    setSupplierId("ALL");
                    setStatus("ALL");
                  }}
                >
                  {t("suppliers.returns.clearFilters")}
                </button>
              ) : null}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[56rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-muted">
                    <th className="w-10 px-3 py-3 font-semibold">
                      <SelectAllCheckbox
                        checked={allOnPageSelected}
                        indeterminate={someOnPageSelected}
                        label={t("suppliers.returns.col.selectAll")}
                        disabled={selectableOnPage.length === 0}
                        onChange={toggleCurrentPage}
                      />
                    </th>
                    <th className="px-3 py-3 font-semibold">
                      {t("suppliers.returns.col.medicine")}
                    </th>
                    <th className="px-3 py-3 font-semibold">
                      {t("suppliers.returns.col.batch")}
                    </th>
                    <th className="px-3 py-3 font-semibold">
                      {t("suppliers.returns.col.expiry")}
                    </th>
                    <th className="px-3 py-3 font-semibold">
                      {t("suppliers.returns.col.quantity")}
                    </th>
                    <th className="px-3 py-3 font-semibold">
                      {t("suppliers.returns.col.costValue")}
                    </th>
                    <th className="px-3 py-3 font-semibold">
                      {t("suppliers.returns.col.supplier")}
                    </th>
                    <th className="px-3 py-3 pr-4 font-semibold">
                      {t("suppliers.returns.col.status")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <QueueRow
                      key={row.id}
                      row={row}
                      selected={selected.has(row.id)}
                      onSelect={() => toggleRow(row)}
                      onOpenProduct={() =>
                        navigate(`/inventory/${encodeURIComponent(row.product.id)}`)
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted">
              {t("suppliers.returns.showing")} {formatCount(fromIdx)}–
              {formatCount(toIdx)} {t("suppliers.returns.of")} {formatCount(total)}{" "}
              {t("suppliers.returns.batches")}
            </p>
            {pageCount > 1 ? (
              <div className="flex items-center gap-2 text-sm">
                <button
                  type="button"
                  disabled={page === 0}
                  className="rounded-md border border-border px-3 py-1 text-foreground disabled:cursor-not-allowed disabled:text-muted"
                  onClick={() => setPage(page - 1)}
                >
                  {t("sales.prev")}
                </button>
                <span className="text-muted">
                  {page + 1} / {pageCount}
                </span>
                <button
                  type="button"
                  disabled={page >= pageCount - 1}
                  className="rounded-md border border-border px-3 py-1 text-foreground disabled:cursor-not-allowed disabled:text-muted"
                  onClick={() => setPage(page + 1)}
                >
                  {t("sales.next")}
                </button>
              </div>
            ) : null}
          </div>

          <p className="flex items-start justify-center gap-1.5 px-4 pb-4 text-center text-[10px] text-muted">
            <Info className="mt-0.5 size-3 shrink-0" strokeWidth={1.75} />
            {t("suppliers.returns.footer")}
          </p>
        </section>
      </div>
    </div>
  );
}

function CreateManifestButton({
  enabled,
  disabledTitle,
  onClick,
}: {
  enabled: boolean;
  disabledTitle: string;
  onClick: () => void;
}) {
  const { t } = useLocale();
  return (
    <button
      type="button"
      disabled={!enabled}
      title={enabled ? undefined : disabledTitle}
      className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      onClick={onClick}
    >
      <FilePlus2 className="size-3.5" strokeWidth={1.75} />
      {t("suppliers.returns.createManifest")}
    </button>
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
  hint: string;
  icon: ReactNode;
  valueClass?: string;
}) {
  return (
    <article className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
          {label}
        </p>
        {icon}
      </div>
      <p className={`mt-3 text-xl font-semibold text-foreground ${valueClass ?? ""}`}>
        {value}
      </p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </article>
  );
}

function QueueRow({
  row,
  selected,
  onSelect,
  onOpenProduct,
}: {
  row: ReturnQueueRow;
  selected: boolean;
  onSelect: () => void;
  onOpenProduct: () => void;
}) {
  const { t } = useLocale();
  const selectable = isSelectable(row);
  const days = daysUntilExpiry(row.expiryDate);
  const expired = days != null && days < 0;
  const disabledReason =
    row.returnStatus === "MANIFEST_PREPARED"
      ? t("suppliers.returns.rowDisabledPrepared")
      : row.returnStatus === "NOT_ELIGIBLE"
        ? t("suppliers.returns.rowDisabledNotEligible")
        : undefined;
  const rowClass = selectable
    ? selected
      ? "bg-teal-50/40"
      : "hover:bg-slate-50"
    : "bg-slate-50 text-slate-500";

  return (
    <tr className={`border-b border-border last:border-b-0 ${rowClass}`}>
      <td className="px-3 py-3">
        <input
          type="checkbox"
          checked={selected}
          disabled={!selectable}
          title={disabledReason}
          aria-label={`${t("suppliers.returns.col.selectRow")} ${row.batchNumber}`}
          className="size-4 rounded border-border accent-primary disabled:cursor-not-allowed"
          onChange={onSelect}
        />
      </td>
      <td className="px-3 py-3">
        <button
          type="button"
          className="text-left font-medium text-primary hover:underline"
          onClick={onOpenProduct}
        >
          {row.product.name}
        </button>
        <p className="text-xs text-muted">{row.product.genericName || "—"}</p>
      </td>
      <td className="px-3 py-3 font-medium text-foreground">{row.batchNumber}</td>
      <td className="px-3 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-foreground">{formatUtcDate(row.expiryDate)}</span>
          {expired ? (
            <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-500">
              {t("suppliers.returns.status.expired")}
            </span>
          ) : null}
        </div>
      </td>
      <td className="px-3 py-3 text-foreground">
        {formatCount(row.quantityOnHand)} {t("suppliers.returns.pcs")}
      </td>
      <td className="px-3 py-3 text-foreground">{formatTaka(row.costValue)}</td>
      <td className="px-3 py-3 text-foreground">
        {row.supplier?.name ?? row.supplierName ?? "—"}
      </td>
      <td className="px-3 py-3 pr-4">
        <ReturnStatusBadge status={row.returnStatus} />
      </td>
    </tr>
  );
}

function ReturnStatusBadge({ status }: { status: ReturnStatus }) {
  const { t } = useLocale();
  if (status === "ELIGIBLE") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-teal-100 px-2 py-1 text-xs font-medium text-teal-800">
        <CheckCircle2 className="size-3" strokeWidth={2} />
        {t(STATUS_KEYS[status])}
      </span>
    );
  }
  if (status === "MANIFEST_PREPARED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-400">
        <ClipboardCheck className="size-3" strokeWidth={2} />
        {t(STATUS_KEYS[status])}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-slate-200 px-2 py-1 text-xs font-medium text-slate-500">
      <XCircle className="size-3" strokeWidth={2} />
      {t(STATUS_KEYS[status])}
    </span>
  );
}

function SelectAllCheckbox({
  checked,
  indeterminate,
  label,
  disabled,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  label: string;
  disabled?: boolean;
  onChange: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      aria-label={label}
      className="size-4 rounded border-border accent-primary disabled:cursor-not-allowed"
      onChange={onChange}
    />
  );
}
