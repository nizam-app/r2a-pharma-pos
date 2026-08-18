import {
  AlertCircle,
  AlertTriangle,
  Archive,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Download,
  Filter,
  RotateCcw,
  Search,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocale, type MessageKey } from "@/i18n";
import { ApiError } from "@/lib/api";
import { formatCount, formatTaka } from "@/lib/format";
import {
  daysUntilExpiry,
  expiryBucketForDate,
  fetchOwnerExpiry,
  type ExpiryBucket,
  type OwnerExpiryPayload,
  type OwnerExpiryRow,
} from "@/lib/ownerExpiry";
import { useOwnerPath } from "@/lib/OwnerPathProvider";

const PAGE_SIZE = 25;

const BUCKETS: Array<{
  id: ExpiryBucket;
  label: MessageKey;
  heading: MessageKey;
  icon: ReactNode;
  accent: string;
}> = [
  {
    id: "0_30",
    label: "inventory.expiry.bucket.0_30",
    heading: "inventory.expiry.heading.0_30",
    icon: <AlertTriangle className="size-4" strokeWidth={1.75} />,
    accent: "border-t-orange-500 text-orange-600",
  },
  {
    id: "31_60",
    label: "inventory.expiry.bucket.31_60",
    heading: "inventory.expiry.heading.31_60",
    icon: <Clock3 className="size-4" strokeWidth={1.75} />,
    accent: "border-t-amber-400 text-amber-700",
  },
  {
    id: "61_90",
    label: "inventory.expiry.bucket.61_90",
    heading: "inventory.expiry.heading.61_90",
    icon: <RotateCcw className="size-4" strokeWidth={1.75} />,
    accent: "border-t-slate-400 text-slate-600",
  },
  {
    id: "expired",
    label: "inventory.expiry.bucket.expired",
    heading: "inventory.expiry.heading.expired",
    icon: <AlertCircle className="size-4" strokeWidth={1.75} />,
    accent: "border-t-red-600 text-red-700",
  },
];

type FefoFilter = "all" | "first" | "later";
type ReturnFilter = "all" | OwnerExpiryRow["returnStatus"];

const RETURN_STATUS_KEYS: Record<OwnerExpiryRow["returnStatus"], MessageKey> = {
  ELIGIBLE: "inventory.expiry.return.eligible",
  NOT_ELIGIBLE: "inventory.expiry.return.notEligible",
  MANIFEST_PREPARED: "inventory.expiry.return.manifestPrepared",
};

export function ExpiryManagementPage() {
  const { t } = useLocale();
  const { navigate } = useOwnerPath();
  const [payload, setPayload] = useState<OwnerExpiryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [bucket, setBucket] = useState<ExpiryBucket>("0_30");
  const [search, setSearch] = useState("");
  const [medicine, setMedicine] = useState("all");
  const [fefo, setFefo] = useState<FefoFilter>("all");
  const [supplier, setSupplier] = useState("all");
  const [returnStatus, setReturnStatus] = useState<ReturnFilter>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [selectedBatchIds, setSelectedBatchIds] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchOwnerExpiry()
      .then((data) => {
        if (cancelled) return;
        setPayload(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setPayload(null);
        setLoading(false);
        setError(err instanceof ApiError ? err.message : t("inventory.expiry.error"));
      });
    return () => {
      cancelled = true;
    };
  }, [reload, t]);

  useEffect(() => {
    setPage(0);
    setSelectedBatchIds(new Set());
  }, [bucket, search, medicine, fefo, supplier, returnStatus]);

  const products = useMemo(() => {
    const names = new Map<string, string>();
    for (const row of payload?.rows ?? []) names.set(row.productId, row.productName);
    return [...names.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [payload]);

  const suppliers = useMemo(() => {
    const names = new Set<string>();
    for (const row of payload?.rows ?? []) {
      if (row.supplierName?.trim()) names.add(row.supplierName.trim());
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [payload]);

  const bucketRows = useMemo(
    () => (payload?.rows ?? []).filter((row) => expiryBucketForDate(row.expiryDate) === bucket),
    [bucket, payload],
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    return bucketRows.filter((row) => {
      if (medicine !== "all" && row.productId !== medicine) return false;
      if (fefo === "first" && row.fefoRank !== 1) return false;
      if (fefo === "later" && row.fefoRank <= 1) return false;
      if (supplier !== "all" && row.supplierName !== supplier) return false;
      if (returnStatus !== "all" && row.returnStatus !== returnStatus) return false;
      if (!q) return true;
      return (
        row.productName.toLocaleLowerCase().includes(q) ||
        (row.genericName?.toLocaleLowerCase().includes(q) ?? false) ||
        row.batchNumber.toLocaleLowerCase().includes(q) ||
        (row.supplierName?.toLocaleLowerCase().includes(q) ?? false)
      );
    });
  }, [bucketRows, fefo, medicine, returnStatus, search, supplier]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const rows = filteredRows.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const filteredValue = filteredRows.reduce((sum, row) => sum + row.costValue, 0);
  const activeBucket = BUCKETS.find((item) => item.id === bucket) ?? BUCKETS[0]!;
  const hasFilters =
    medicine !== "all" ||
    fefo !== "all" ||
    supplier !== "all" ||
    returnStatus !== "all";
  const pageBatchIds = rows.map((row) => row.batchId);
  const selectedOnPage = pageBatchIds.filter((id) => selectedBatchIds.has(id)).length;
  const allOnPageSelected = rows.length > 0 && selectedOnPage === rows.length;
  const someOnPageSelected = selectedOnPage > 0 && !allOnPageSelected;

  function resetFilters() {
    setMedicine("all");
    setFefo("all");
    setSupplier("all");
    setReturnStatus("all");
  }

  function toggleBatch(batchId: string) {
    setSelectedBatchIds((current) => {
      const next = new Set(current);
      if (next.has(batchId)) next.delete(batchId);
      else next.add(batchId);
      return next;
    });
  }

  function toggleCurrentPage() {
    setSelectedBatchIds((current) => {
      const next = new Set(current);
      if (allOnPageSelected) pageBatchIds.forEach((id) => next.delete(id));
      else pageBatchIds.forEach((id) => next.add(id));
      return next;
    });
  }

  function exportRows() {
    const selectedRows = filteredRows.filter((row) => selectedBatchIds.has(row.batchId));
    const exportable = selectedRows.length > 0 ? selectedRows : filteredRows;
    if (exportable.length === 0) return;
    const headers = [
      t("inventory.expiry.col.medicine"),
      t("inventory.detail.generic"),
      t("inventory.expiry.col.batch"),
      t("inventory.expiry.filterSupplier"),
      t("inventory.expiry.col.expiry"),
      t("inventory.expiry.col.stock"),
      t("inventory.expiry.col.costValue"),
      t("inventory.expiry.col.fefo"),
      t("inventory.expiry.col.returnEligibility"),
      t("inventory.expiry.col.status"),
    ];
    const statusLabel = t(
      bucket === "expired"
        ? "inventory.expiry.status.expired"
        : "inventory.expiry.status.nearing",
    );
    const lines = [
      headers,
      ...exportable.map((row) => [
        row.productName,
        row.genericName ?? "",
        row.batchNumber,
        row.supplierName ?? "",
        formatFullDate(row.expiryDate),
        String(row.quantityOnHand),
        String(row.costValue),
        `#${row.fefoRank}`,
        t(RETURN_STATUS_KEYS[row.returnStatus]),
        statusLabel,
      ]),
    ].map((line) => line.map(csvCell).join(","));
    const blob = new Blob([`\uFEFF${lines.join("\r\n")}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `expiry-management-${bucket}.csv`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <div className="w-full px-5 py-4">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-xs text-muted">
            <button type="button" className="hover:text-primary" onClick={() => navigate("/inventory")}> 
              {t("page.inventoryTitle")}
            </button>
            <span aria-hidden="true">›</span>
            <span>{t("inventory.expiry.title")}</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t("inventory.expiry.title")}
          </h1>
          <p className="mt-1 text-sm text-muted">{t("inventory.expiry.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={filteredRows.length === 0}
            title={filteredRows.length === 0 ? t("inventory.expiry.exportEmpty") : undefined}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground hover:bg-canvas disabled:cursor-not-allowed disabled:text-muted"
            onClick={exportRows}
          >
            <Download className="size-3.5" strokeWidth={1.75} />
            {t("inventory.expiry.export")}
          </button>
          <button
            type="button"
            disabled
            aria-disabled="true"
            title={t("inventory.expiry.returnUnavailable")}
            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-border bg-slate-100 px-3 py-1.5 text-sm font-medium text-muted"
          >
            <Archive className="size-3.5" strokeWidth={1.75} />
            {t("inventory.expiry.prepareReturn")}
          </button>
        </div>
      </div>

      {loading && !payload ? (
        <p className="text-sm text-muted">{t("inventory.expiry.loading")}</p>
      ) : null}

      {error && !payload ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
          <p className="text-destructive">{error}</p>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1 text-foreground hover:bg-canvas"
            onClick={() => setReload((value) => value + 1)}
          >
            {t("inventory.retry")}
          </button>
        </div>
      ) : null}

      {payload ? (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {BUCKETS.map((item) => {
              const itemRows = payload.rows.filter(
                (row) => expiryBucketForDate(row.expiryDate) === item.id,
              );
              const value = itemRows.reduce((sum, row) => sum + row.costValue, 0);
              const active = item.id === bucket;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`rounded-xl border-x border-b border-x-border border-b-border border-t-4 bg-surface p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${item.accent} ${active ? "ring-2 ring-primary/20" : ""}`}
                  onClick={() => setBucket(item.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-foreground">
                      {t(item.label)}
                    </p>
                    {item.icon}
                  </div>
                  <p className="mt-4 text-2xl font-semibold text-foreground">
                    {formatCount(payload.counts[item.id])}{" "}
                    <span className="text-xs font-normal text-muted">
                      {t("inventory.expiry.batches")}
                    </span>
                  </p>
                  <p className="mt-3 border-t border-border pt-2 text-xs text-muted">
                    <span className="font-medium text-foreground">{formatTaka(value)}</span>{" "}
                    {t("inventory.expiry.atCostValue")}
                  </p>
                </button>
              );
            })}
          </div>

          <section className="overflow-hidden rounded-xl border border-border bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div className="flex flex-wrap gap-2">
                {BUCKETS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={
                      item.id === bucket
                        ? "rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary"
                        : "rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-foreground hover:bg-canvas"
                    }
                    onClick={() => setBucket(item.id)}
                  >
                    {t(item.label)} {formatCount(payload.counts[item.id])}
                  </button>
                ))}
              </div>
              <div className="flex min-w-0 flex-1 justify-end gap-2 sm:flex-none">
                <label className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" strokeWidth={1.75} />
                  <span className="sr-only">{t("inventory.expiry.search")}</span>
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t("inventory.expiry.searchPlaceholder")}
                    className="w-full rounded-md border border-border bg-surface py-1.5 pl-8 pr-3 text-sm text-foreground placeholder:text-muted"
                  />
                </label>
                <button
                  type="button"
                  aria-expanded={filtersOpen}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium ${filtersOpen || hasFilters ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground hover:bg-canvas"}`}
                  onClick={() => setFiltersOpen((open) => !open)}
                >
                  <Filter className="size-3.5" strokeWidth={1.75} />
                  {t("inventory.expiry.filters")}
                  {hasFilters ? <span className="size-1.5 rounded-full bg-primary" /> : null}
                </button>
              </div>
            </div>

            {filtersOpen ? (
              <div className="flex flex-wrap items-end gap-3 border-b border-border bg-slate-50 px-4 py-3">
                <FilterSelect
                  label={t("inventory.expiry.filterMedicine")}
                  value={medicine}
                  onChange={setMedicine}
                  options={[
                    { value: "all", label: t("inventory.expiry.filterMedicineAll") },
                    ...products.map(([value, label]) => ({ value, label })),
                  ]}
                />
                <FilterSelect
                  label={t("inventory.expiry.filterFefo")}
                  value={fefo}
                  onChange={(value) => setFefo(value as FefoFilter)}
                  options={[
                    { value: "all", label: t("inventory.expiry.filterFefoAll") },
                    { value: "first", label: t("inventory.expiry.filterFefoFirst") },
                    { value: "later", label: t("inventory.expiry.filterFefoLater") },
                  ]}
                />
                <FilterSelect
                  label={t("inventory.expiry.filterSupplier")}
                  value={supplier}
                  onChange={setSupplier}
                  options={[
                    { value: "all", label: t("inventory.expiry.filterSupplierAll") },
                    ...suppliers.map((value) => ({ value, label: value })),
                  ]}
                />
                <FilterSelect
                  label={t("inventory.expiry.filterReturn")}
                  value={returnStatus}
                  onChange={(value) => setReturnStatus(value as ReturnFilter)}
                  options={[
                    { value: "all", label: t("inventory.expiry.filterReturnAll") },
                    { value: "ELIGIBLE", label: t("inventory.expiry.return.eligible") },
                    { value: "NOT_ELIGIBLE", label: t("inventory.expiry.return.notEligible") },
                    {
                      value: "MANIFEST_PREPARED",
                      label: t("inventory.expiry.return.manifestPrepared"),
                    },
                  ]}
                />
                <button
                  type="button"
                  disabled={!hasFilters}
                  className="rounded-md px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:text-muted"
                  onClick={resetFilters}
                >
                  {t("inventory.expiry.clearFilters")}
                </button>
              </div>
            ) : null}

            <div className="border-b border-border px-4 py-3">
              <h2 className="text-base font-semibold text-foreground">{t(activeBucket.heading)}</h2>
              <p className="mt-0.5 text-xs text-muted">
                {formatCount(filteredRows.length)} {t("inventory.expiry.batches")} · {formatTaka(filteredValue)} {t("inventory.expiry.atRisk")}
              </p>
            </div>

            {rows.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">
                {t("inventory.expiry.empty")}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[64rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-slate-100 text-xs font-medium uppercase tracking-wide text-muted">
                      <th className="w-10 px-3 py-2.5 font-medium">
                        <SelectAllCheckbox
                          checked={allOnPageSelected}
                          indeterminate={someOnPageSelected}
                          label={t("inventory.expiry.col.selectAll")}
                          onChange={toggleCurrentPage}
                        />
                      </th>
                      <th className="px-3 py-2.5 font-medium">{t("inventory.expiry.col.medicine")}</th>
                      <th className="px-3 py-2.5 font-medium">{t("inventory.expiry.col.batch")}</th>
                      <th className="px-3 py-2.5 font-medium">{t("inventory.expiry.col.expiry")}</th>
                      <th className="px-3 py-2.5 font-medium">{t("inventory.expiry.col.stock")}</th>
                      <th className="px-3 py-2.5 font-medium">{t("inventory.expiry.col.costValue")}</th>
                      <th className="px-3 py-2.5 font-medium">{t("inventory.expiry.col.fefo")}</th>
                      <th className="px-3 py-2.5 font-medium">{t("inventory.expiry.col.returnEligibility")}</th>
                      <th className="px-3 py-2.5 pr-4 font-medium">{t("inventory.expiry.col.status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <ExpiryRow
                        key={row.batchId}
                        row={row}
                        bucket={bucket}
                        selected={selectedBatchIds.has(row.batchId)}
                        onSelect={() => toggleBatch(row.batchId)}
                        onOpen={() => navigate(`/inventory/${row.productId}`)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {pageCount > 1 ? (
              <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3 text-sm">
                <button
                  type="button"
                  disabled={safePage === 0}
                  className="rounded-md border border-border px-3 py-1 text-foreground disabled:cursor-not-allowed disabled:text-muted"
                  onClick={() => setPage(safePage - 1)}
                >
                  {t("sales.prev")}
                </button>
                <span className="text-muted">{safePage + 1} / {pageCount}</span>
                <button
                  type="button"
                  disabled={safePage >= pageCount - 1}
                  className="rounded-md border border-border px-3 py-1 text-foreground disabled:cursor-not-allowed disabled:text-muted"
                  onClick={() => setPage(safePage + 1)}
                >
                  {t("sales.next")}
                </button>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex min-w-[13rem] flex-col gap-1 text-xs font-medium text-muted">
      {label}
      <select
        value={value}
        className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-normal text-foreground"
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function ExpiryRow({
  row,
  bucket,
  selected,
  onSelect,
  onOpen,
}: {
  row: OwnerExpiryRow;
  bucket: ExpiryBucket;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
}) {
  const { t } = useLocale();
  const days = daysUntilExpiry(row.expiryDate);
  const date = formatFullDate(row.expiryDate);
  const statusKey: MessageKey =
    bucket === "expired" ? "inventory.expiry.status.expired" : "inventory.expiry.status.nearing";
  const statusClass =
    bucket === "expired"
      ? "bg-red-50 text-red-700"
      : bucket === "0_30"
        ? "bg-orange-50 text-orange-700"
        : "bg-amber-50 text-amber-800";

  return (
    <tr className="cursor-pointer border-b border-border last:border-b-0 hover:bg-canvas" onClick={onOpen}>
      <td className="px-3 py-3">
        <input
          type="checkbox"
          checked={selected}
          aria-label={`${t("inventory.expiry.col.selectRow")} ${row.batchNumber}`}
          className="size-4 rounded border-border accent-primary"
          onClick={(event) => event.stopPropagation()}
          onChange={onSelect}
        />
      </td>
      <td className="px-3 py-3">
        <p className="font-medium text-foreground">{row.productName}</p>
        <p className="text-xs text-muted">{row.genericName || "—"}</p>
      </td>
      <td className="px-3 py-3">
        <p className="font-medium text-foreground"># {row.batchNumber}</p>
        <p className="text-xs text-muted">{row.supplierName || "—"}</p>
      </td>
      <td className="px-3 py-3">
        <p className="font-medium text-foreground">{date}</p>
        <p className={bucket === "expired" ? "text-xs text-red-600" : "text-xs text-orange-600"}>
          {days == null
            ? "—"
            : bucket === "expired"
              ? `${formatCount(Math.abs(days))} ${t("inventory.expiry.daysExpired")}`
              : `${formatCount(days)} ${t("inventory.expiry.daysLeft")}`}
        </p>
      </td>
      <td className="px-3 py-3 text-foreground">{formatCount(row.quantityOnHand)} {t("inventory.pcs")}</td>
      <td className="px-3 py-3 text-foreground">{formatTaka(row.costValue)}</td>
      <td className="px-3 py-3">
        <span className="rounded border border-border bg-slate-50 px-2 py-0.5 text-xs font-medium text-foreground">#{formatCount(row.fefoRank)}</span>
      </td>
      <td className="px-3 py-3">
        <ReturnStatusBadge status={row.returnStatus} />
      </td>
      <td className="px-3 py-3 pr-4">
        <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${statusClass}`}>
          {t(statusKey)}
        </span>
      </td>
    </tr>
  );
}

function SelectAllCheckbox({
  checked,
  indeterminate,
  label,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  label: string;
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
      aria-label={label}
      className="size-4 rounded border-border accent-primary"
      onChange={onChange}
    />
  );
}

function ReturnStatusBadge({ status }: { status: OwnerExpiryRow["returnStatus"] }) {
  const { t } = useLocale();
  if (status === "ELIGIBLE") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
        <CheckCircle2 className="size-3" strokeWidth={2} />
        {t(RETURN_STATUS_KEYS[status])}
      </span>
    );
  }
  if (status === "MANIFEST_PREPARED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200">
        <ClipboardCheck className="size-3" strokeWidth={2} />
        {t(RETURN_STATUS_KEYS[status])}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
      <XCircle className="size-3" strokeWidth={2} />
      {t(RETURN_STATUS_KEYS[status])}
    </span>
  );
}

function csvCell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

function formatFullDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
