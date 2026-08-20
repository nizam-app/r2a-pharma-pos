import {
  AlertCircle,
  Check,
  CheckCircle2,
  ClipboardList,
  FileText,
  Info,
  Loader2,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { displayNameFromUser, useAuth } from "@/features/auth";
import { useLocale } from "@/i18n";
import { ApiError } from "@/lib/api";
import { formatCount, formatTaka, formatUtcDate } from "@/lib/format";
import { daysUntilExpiry } from "@/lib/ownerExpiry";
import { useOwnerPath } from "@/lib/OwnerPathProvider";
import {
  clearReturnManifestDraft,
  createReturnManifest,
  fetchReturnLotsByIds,
  readReturnManifestDraft,
  type ReturnManifestDraft,
  type ReturnQueueRow,
} from "@/lib/returnQueue";
import { fetchSupplierDetail, type SupplierFull } from "@/lib/suppliers";
import { useTenantChrome } from "@/lib/TenantContextProvider";

const INPUT_CLASS =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-teal-600 focus:ring-1 focus:ring-teal-600 disabled:cursor-not-allowed disabled:bg-canvas disabled:text-muted";

type LineDraft = {
  row: ReturnQueueRow;
  returnQty: string;
};

function localYmd(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseReturnQty(value: string): number | null {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
}

function lineCost(line: LineDraft): number {
  const qty = parseReturnQty(line.returnQty);
  if (qty == null) return 0;
  return qty * line.row.costPerBase;
}

function lineIsValid(line: LineDraft): boolean {
  const qty = parseReturnQty(line.returnQty);
  return qty != null && qty <= line.row.quantityOnHand;
}

/**
 * Create Return Manifest (Batch AB). Content region only — chrome is Batch B.
 * Reviews the Batch AA session draft, posts POST /owner/return-manifests, and
 * navigates to Manifest Details (Batch AC). Save as Draft is disabled (no DRAFT
 * status). Dispatch / decision / complete stay Batch AC. Preparing does not
 * remove stock.
 */
export function CreateReturnManifestPage() {
  const { t } = useLocale();
  const { navigate, setNavigationBlocker } = useOwnerPath();
  const { storeName } = useTenantChrome();
  const { user } = useAuth();

  const [draft, setDraft] = useState<ReturnManifestDraft | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [supplier, setSupplier] = useState<SupplierFull | null>(null);
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [initialLineCount, setInitialLineCount] = useState(0);
  const [missingCount, setMissingCount] = useState(0);
  const [notes, setNotes] = useState("");
  const [supplierReference, setSupplierReference] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(
    null,
  );
  const bypassNavigation = useRef(false);

  const preparedBy = user ? displayNameFromUser(user) : "—";
  const supplierName = supplier?.name ?? draft?.supplierName ?? "";
  const mixedSupplier = lines.some(
    (line) => line.row.supplierId && line.row.supplierId !== draft?.supplierId,
  );

  const dirty =
    notes.trim() !== "" ||
    supplierReference.trim() !== "" ||
    lines.length !== initialLineCount ||
    lines.some((line) => line.returnQty !== String(line.row.quantityOnHand));

  useEffect(() => {
    const blockNavigation = (to: string) => {
      if (bypassNavigation.current || !dirty) return true;
      setPendingNavigation(to);
      return false;
    };
    setNavigationBlocker(blockNavigation);
    return () => setNavigationBlocker(null);
  }, [dirty, setNavigationBlocker]);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  useEffect(() => {
    const next = readReturnManifestDraft();
    setDraft(next);
    setDraftReady(true);
  }, [reload]);

  useEffect(() => {
    if (!draftReady) return;
    if (!draft) {
      setLoading(false);
      setLines([]);
      setSupplier(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void Promise.all([
      fetchSupplierDetail(draft.supplierId),
      fetchReturnLotsByIds(draft.supplierId, draft.batchIds),
    ])
      .then(([supplierDetail, lots]) => {
        if (cancelled) return;
        setSupplier(supplierDetail);
        setLines(
          lots.found.map((row) => ({
            row,
            returnQty: String(row.quantityOnHand),
          })),
        );
        setInitialLineCount(lots.found.length);
        setMissingCount(lots.missingIds.length);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setSupplier(null);
        setLines([]);
        setLoading(false);
        if (err instanceof ApiError) setError(err.message);
        else setError(t("suppliers.manifest.loadError"));
      });

    return () => {
      cancelled = true;
    };
  }, [draft, draftReady, t]);

  const totals = useMemo(() => {
    const units = lines.reduce((sum, line) => {
      const qty = parseReturnQty(line.returnQty);
      return sum + (qty ?? 0);
    }, 0);
    const cost = lines.reduce((sum, line) => sum + lineCost(line), 0);
    return { batches: lines.length, units, cost };
  }, [lines]);

  const allLinesValid = lines.length > 0 && lines.every(lineIsValid);
  const supplierAccepts = supplier?.expiryReturnsAccepted === true;
  const canPrepare =
    Boolean(draft) &&
    !mixedSupplier &&
    supplierAccepts &&
    allLinesValid &&
    !submitting &&
    !loading;

  function go(to: string) {
    bypassNavigation.current = true;
    setNavigationBlocker(null);
    navigate(to);
  }

  function cancel() {
    if (dirty) {
      setPendingNavigation("/suppliers/returns");
      return;
    }
    go("/suppliers/returns");
  }

  async function handlePrepare() {
    if (!draft || !canPrepare) return;
    const payloadLines = lines.map((line) => ({
      batchId: line.row.id,
      returnQty: parseReturnQty(line.returnQty)!,
    }));
    if (payloadLines.some((line) => line.returnQty < 1)) {
      setError(t("suppliers.manifest.validation"));
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const created = await createReturnManifest({
        supplierId: draft.supplierId,
        notes: notes.trim() || null,
        supplierReference: supplierReference.trim() || null,
        lines: payloadLines,
      });
      clearReturnManifestDraft();
      go(`/suppliers/returns/${encodeURIComponent(created.id)}`);
    } catch (err: unknown) {
      setSubmitting(false);
      if (err instanceof ApiError) setError(err.message);
      else setError(t("suppliers.manifest.submitError"));
    }
  }

  return (
    <div className="w-full px-5 py-4">
      {pendingNavigation ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
          onMouseDown={() => setPendingNavigation(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="unsaved-manifest-title"
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700">
                <AlertCircle className="size-5" />
              </span>
              <div>
                <h2
                  id="unsaved-manifest-title"
                  className="text-lg font-semibold text-slate-950"
                >
                  {t("suppliers.manifest.unsavedTitle")}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  {t("suppliers.manifest.unsavedBody")}
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                autoFocus
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => setPendingNavigation(null)}
              >
                {t("suppliers.manifest.keepEditing")}
              </button>
              <button
                type="button"
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                onClick={() => {
                  const to = pendingNavigation;
                  setPendingNavigation(null);
                  go(to);
                }}
              >
                {t("suppliers.manifest.discardChanges")}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <nav
        aria-label={t("header.breadcrumb")}
        className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-muted"
      >
        <button
          type="button"
          className="hover:text-primary"
          onClick={() => navigate("/suppliers")}
        >
          {t("page.suppliersTitle")}
        </button>
        <span aria-hidden="true">›</span>
        <button
          type="button"
          className="hover:text-primary"
          onClick={() => navigate("/suppliers/returns")}
        >
          {t("suppliers.returns.title")}
        </button>
        <span aria-hidden="true">›</span>
        <span className="font-medium text-foreground">
          {t("suppliers.manifest.title")}
        </span>
      </nav>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {t("suppliers.manifest.title")}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {t("suppliers.manifest.subtitle")}
            {supplierName ? ` ${supplierName}.` : ""}
          </p>
        </div>
        <button
          type="button"
          disabled={submitting}
          onClick={cancel}
          className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-canvas disabled:opacity-50"
        >
          {t("suppliers.manifest.cancel")}
        </button>
      </div>

      {error ? (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span className="flex-1">{error}</span>
          {!draft || lines.length === 0 ? (
            <button
              type="button"
              className="font-medium underline"
              onClick={() => setReload((n) => n + 1)}
            >
              {t("suppliers.manifest.retry")}
            </button>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted">{t("suppliers.manifest.loading")}</p>
      ) : null}

      {!loading && !draft ? (
        <section className="rounded-xl border border-dashed border-border bg-surface px-6 py-10 text-center">
          <p className="text-sm font-medium text-foreground">
            {t("suppliers.manifest.emptyDraft")}
          </p>
          <p className="mt-1 text-sm text-muted">
            {t("suppliers.manifest.emptyDraftHint")}
          </p>
          <button
            type="button"
            className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            onClick={() => go("/suppliers/returns")}
          >
            {t("suppliers.manifest.backToQueue")}
          </button>
        </section>
      ) : null}

      {!loading && draft ? (
        <>
          {missingCount > 0 ? (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>
                {t("suppliers.manifest.missingLots")} {formatCount(missingCount)}
              </span>
            </div>
          ) : null}
          {mixedSupplier ? (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{t("suppliers.returns.mixedSupplier")}</span>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="flex flex-col gap-4">
              <section className="rounded-xl border border-border bg-surface p-5">
                <div className="mb-4 flex items-start justify-between gap-3 border-b border-border pb-3">
                  <div className="flex items-start gap-2">
                    <FileText
                      className="mt-0.5 size-4 text-primary"
                      strokeWidth={1.75}
                    />
                    <div>
                      <h2 className="text-sm font-semibold text-foreground">
                        {t("suppliers.manifest.detailsTitle")}
                      </h2>
                      <p className="mt-1 text-xs text-muted">
                        {t("suppliers.manifest.autoNumberHint")}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-md border border-border bg-slate-100 px-2 py-1 font-mono text-xs font-medium text-muted">
                    {t("suppliers.manifest.autoNumber")}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Field label={t("suppliers.manifest.supplier")}>
                    <input
                      className={INPUT_CLASS}
                      value={supplierName}
                      readOnly
                      disabled
                    />
                  </Field>
                  <Field label={t("suppliers.manifest.branch")}>
                    <input
                      className={INPUT_CLASS}
                      value={storeName ?? t("header.storeUnavailable")}
                      readOnly
                      disabled
                    />
                  </Field>
                  <Field label={t("suppliers.manifest.preparedBy")}>
                    <input className={INPUT_CLASS} value={preparedBy} readOnly disabled />
                  </Field>
                  <Field label={t("suppliers.manifest.manifestDate")}>
                    <input
                      type="date"
                      className={INPUT_CLASS}
                      value={localYmd()}
                      readOnly
                      disabled
                    />
                  </Field>
                  <Field label={t("suppliers.manifest.returnReason")}>
                    <select className={INPUT_CLASS} value="EXPIRY" disabled>
                      <option value="EXPIRY">
                        {t("suppliers.manifest.returnReasonExpiry")}
                      </option>
                    </select>
                  </Field>
                  <Field label={t("suppliers.manifest.supplierReference")}>
                    <input
                      type="text"
                      className={INPUT_CLASS}
                      value={supplierReference}
                      onChange={(event) => setSupplierReference(event.target.value)}
                      placeholder={t("suppliers.manifest.supplierReferencePlaceholder")}
                      maxLength={160}
                    />
                  </Field>
                  <div className="sm:col-span-3">
                    <Field label={t("suppliers.manifest.notes")}>
                      <textarea
                        className={`${INPUT_CLASS} min-h-20 resize-y`}
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder={t("suppliers.manifest.notesPlaceholder")}
                        maxLength={1000}
                      />
                    </Field>
                  </div>
                </div>
              </section>

              <section className="overflow-hidden rounded-xl border border-border bg-surface">
                <div className="border-b border-border px-5 py-3">
                  <h2 className="text-sm font-semibold text-foreground">
                    {t("suppliers.manifest.itemsTitle")}
                  </h2>
                </div>
                {lines.length === 0 ? (
                  <div className="px-5 py-8 text-center">
                    <p className="text-sm text-muted">{t("suppliers.manifest.emptyLines")}</p>
                    <button
                      type="button"
                      className="mt-3 text-sm font-medium text-primary hover:underline"
                      onClick={() => go("/suppliers/returns")}
                    >
                      {t("suppliers.manifest.backToQueue")}
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[52rem] text-left text-sm">
                      <thead>
                        <tr className="border-b border-border bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-muted">
                          <th className="px-4 py-2.5 font-semibold">
                            {t("suppliers.manifest.col.medicine")}
                          </th>
                          <th className="px-3 py-2.5 font-semibold">
                            {t("suppliers.manifest.col.batch")}
                          </th>
                          <th className="px-3 py-2.5 font-semibold">
                            {t("suppliers.manifest.col.expiry")}
                          </th>
                          <th className="px-3 py-2.5 font-semibold">
                            {t("suppliers.manifest.col.availableQty")}
                          </th>
                          <th className="px-3 py-2.5 font-semibold">
                            {t("suppliers.manifest.col.returnQty")}
                          </th>
                          <th className="px-3 py-2.5 font-semibold">
                            {t("suppliers.manifest.col.costValue")}
                          </th>
                          <th className="px-3 py-2.5 font-semibold">
                            {t("suppliers.manifest.col.status")}
                          </th>
                          <th className="px-3 py-2.5 pr-4 font-semibold">
                            <span className="sr-only">
                              {t("suppliers.manifest.col.action")}
                            </span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((line) => (
                          <ItemRow
                            key={line.row.id}
                            line={line}
                            onQty={(value) =>
                              setLines((current) =>
                                current.map((item) =>
                                  item.row.id === line.row.id
                                    ? { ...item, returnQty: value }
                                    : item,
                                ),
                              )
                            }
                            onRemove={() =>
                              setLines((current) =>
                                current.filter((item) => item.row.id !== line.row.id),
                              )
                            }
                            onOpenProduct={() =>
                              navigate(`/inventory/${encodeURIComponent(line.row.productId)}`)
                            }
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>

            <div className="flex flex-col gap-4">
              <section className="rounded-xl border border-border bg-surface p-5">
                <SectionHeader
                  icon={
                    <ClipboardList className="size-4 text-primary" strokeWidth={1.75} />
                  }
                  title={t("suppliers.manifest.summary.title")}
                />
                <dl>
                  <SummaryRow
                    label={t("suppliers.manifest.summary.supplier")}
                    value={supplierName || "—"}
                  />
                  <SummaryRow
                    label={t("suppliers.manifest.summary.reason")}
                    value={t("suppliers.manifest.returnReasonExpiry")}
                  />
                  <SummaryRow
                    label={t("suppliers.manifest.summary.batches")}
                    value={formatCount(totals.batches)}
                  />
                  <SummaryRow
                    label={t("suppliers.manifest.summary.units")}
                    value={`${formatCount(totals.units)} ${t("suppliers.returns.pcs")}`}
                  />
                  <div className="flex items-center justify-between gap-3 border-b border-border py-2">
                    <dt className="text-sm text-muted">
                      {t("suppliers.manifest.summary.cost")}
                    </dt>
                    <dd className="text-lg font-semibold text-primary">
                      {formatTaka(totals.cost)}
                    </dd>
                  </div>
                </dl>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-sm text-muted">
                    {t("suppliers.manifest.summary.status")}
                  </span>
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                    {t("suppliers.manifest.summary.statusPrepared")}
                  </span>
                </div>
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2.5 text-xs text-sky-800">
                  <Info className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} />
                  <span>{t("suppliers.manifest.summary.inventoryNote")}</span>
                </div>
              </section>

              <section className="rounded-xl border border-border bg-surface p-5">
                <SectionHeader
                  icon={
                    <ShieldCheck className="size-4 text-primary" strokeWidth={1.75} />
                  }
                  title={t("suppliers.manifest.policy.title")}
                />
                <dl>
                  <SummaryRow
                    label={t("suppliers.manifest.policy.expiryReturns")}
                    value={
                      supplierAccepts
                        ? t("suppliers.manifest.policy.accepted")
                        : t("suppliers.manifest.policy.notAccepted")
                    }
                  />
                  <SummaryRow
                    label={t("suppliers.manifest.policy.minDays")}
                    value={
                      supplier?.minDaysBeforeExpiry != null
                        ? `${formatCount(supplier.minDaysBeforeExpiry)} ${t("suppliers.kpi.days")}`
                        : t("suppliers.manifest.policy.none")
                    }
                  />
                  {supplier?.returnNotes ? (
                    <div className="border-b border-border py-2">
                      <dt className="text-sm text-muted">
                        {t("suppliers.manifest.policy.instructions")}
                      </dt>
                      <dd className="mt-1 text-sm text-foreground">
                        {supplier.returnNotes}
                      </dd>
                    </div>
                  ) : null}
                </dl>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-sm text-muted">
                    {t("suppliers.manifest.policy.status")}
                  </span>
                  {supplierAccepts && allLinesValid && !mixedSupplier ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-teal-100 px-2 py-1 text-xs font-medium text-teal-800">
                      <CheckCircle2 className="size-3" strokeWidth={2} />
                      {t("suppliers.manifest.policy.eligible")}
                    </span>
                  ) : (
                    <span className="rounded-md bg-slate-200 px-2 py-1 text-xs font-medium text-slate-600">
                      {t("suppliers.manifest.policy.notEligible")}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted">
                  {t("suppliers.manifest.policy.hint")}
                </p>
              </section>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2 text-xs text-muted">
              <Info className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} />
              <span>{t("suppliers.manifest.footerNote")}</span>
            </p>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={cancel}
                className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-canvas disabled:opacity-50"
              >
                {t("suppliers.manifest.cancel")}
              </button>
              <button
                type="button"
                disabled
                aria-disabled="true"
                title={t("suppliers.manifest.saveDraftSoon")}
                className="cursor-not-allowed rounded-md border border-border bg-slate-100 px-4 py-2 text-sm font-medium text-muted"
              >
                {t("suppliers.manifest.saveDraft")}
              </button>
              <button
                type="button"
                disabled={!canPrepare}
                onClick={() => void handlePrepare()}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" strokeWidth={2} />
                )}
                {submitting
                  ? t("suppliers.manifest.preparing")
                  : t("suppliers.manifest.prepare")}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function ItemRow({
  line,
  onQty,
  onRemove,
  onOpenProduct,
}: {
  line: LineDraft;
  onQty: (value: string) => void;
  onRemove: () => void;
  onOpenProduct: () => void;
}) {
  const { t } = useLocale();
  const days = daysUntilExpiry(line.row.expiryDate);
  const qty = parseReturnQty(line.returnQty);
  const invalid = !lineIsValid(line);
  const expired = days != null && days < 0;
  const near = days != null && days >= 0 && days <= 30;

  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="px-4 py-3">
        <button
          type="button"
          className="text-left font-medium text-primary hover:underline"
          onClick={onOpenProduct}
        >
          {line.row.product.name}
        </button>
        <p className="text-xs text-muted">{line.row.product.genericName || "—"}</p>
      </td>
      <td className="px-3 py-3 font-medium text-foreground">{line.row.batchNumber}</td>
      <td className="px-3 py-3">
        <p className="text-foreground">{formatUtcDate(line.row.expiryDate)}</p>
        <p className={expired || near ? "text-xs text-red-600" : "text-xs text-muted"}>
          {days == null
            ? "—"
            : expired
              ? `${formatCount(Math.abs(days))} ${t("inventory.expiry.daysExpired")}`
              : `${formatCount(days)} ${t("inventory.expiry.daysLeft")}`}
        </p>
      </td>
      <td className="px-3 py-3 text-foreground">
        {formatCount(line.row.quantityOnHand)} {t("suppliers.returns.pcs")}
      </td>
      <td className="px-3 py-3">
        <input
          type="number"
          min={1}
          max={line.row.quantityOnHand}
          step={1}
          value={line.returnQty}
          onChange={(event) => onQty(event.target.value)}
          className={`w-20 rounded-md border bg-surface px-2 py-1.5 text-sm outline-none focus:ring-1 ${
            invalid
              ? "border-red-400 focus:border-red-500 focus:ring-red-500"
              : "border-border focus:border-teal-600 focus:ring-teal-600"
          }`}
        />
      </td>
      <td className="px-3 py-3 text-foreground">
        {qty == null ? "—" : formatTaka(lineCost(line))}
      </td>
      <td className="px-3 py-3">
        <span className="inline-flex items-center gap-1 rounded-md bg-teal-100 px-2 py-1 text-xs font-medium text-teal-800">
          <CheckCircle2 className="size-3" strokeWidth={2} />
          {t("suppliers.returns.status.eligible")}
        </span>
      </td>
      <td className="px-3 py-3 pr-4">
        <button
          type="button"
          className="rounded-md p-1.5 text-muted hover:bg-red-50 hover:text-red-600"
          aria-label={t("suppliers.manifest.removeLine")}
          title={t("suppliers.manifest.removeLine")}
          onClick={onRemove}
        >
          <Trash2 className="size-4" strokeWidth={1.75} />
        </button>
      </td>
    </tr>
  );
}

function SectionHeader({
  icon,
  title,
}: {
  icon: ReactNode;
  title: string;
}) {
  return (
    <div className="mb-3 flex items-start gap-2 border-b border-border pb-3">
      <span className="mt-0.5">{icon}</span>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-b-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="max-w-[60%] truncate text-right text-sm font-medium text-foreground">
        {value}
      </dd>
    </div>
  );
}
