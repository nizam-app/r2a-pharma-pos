import {
  Boxes,
  Building2,
  CalendarClock,
  ClipboardList,
  FileText,
  MoreHorizontal,
  PackageCheck,
  PackageMinus,
  Printer,
  ReceiptText,
  Truck,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocale } from "@/i18n";
import { ApiError } from "@/lib/api";
import {
  formatCount,
  formatDateTime,
  formatTaka,
  formatUtcDate,
} from "@/lib/format";
import { useOwnerPath } from "@/lib/OwnerPathProvider";
import {
  fetchPurchaseOrder,
  type PurchaseOrderDetail,
  type PurchaseOrderStatus,
} from "@/lib/purchaseOrders";
import { useTenantChrome } from "@/lib/TenantContextProvider";

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Purchase Order Details (Batch V). Content region only — chrome is Batch B.
 * Live GET /owner/purchase-orders/:poId — header, KPIs, line receiving progress,
 * and GRN history for this order. Export / Print / More Actions stay disabled.
 * Receive Stock (enabled while remaining qty > 0 on a sent/partial order)
 * navigates to /purchasing/:poId/receive; the GRN form itself is Batch W.
 */
export function PurchaseOrderDetailPage({ poId }: { poId: string }) {
  const { t } = useLocale();
  const { navigate } = useOwnerPath();
  const { storeName } = useTenantChrome();

  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrderDetail | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchPurchaseOrder(poId)
      .then((payload) => {
        if (cancelled) return;
        setPurchaseOrder(payload);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setPurchaseOrder(null);
        setLoading(false);
        if (err instanceof ApiError && err.statusCode === 404) {
          setError(t("purchasing.detail.notFound"));
        } else if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError(t("purchasing.detail.error"));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [poId, reload, t]);

  return (
    <div className="w-full px-5 py-4">
      <nav aria-label={t("header.breadcrumb")} className="mb-3 text-sm text-muted">
        <button
          type="button"
          className="hover:text-foreground hover:underline"
          onClick={() => navigate("/purchasing")}
        >
          {t("nav.purchasing")}
        </button>
        <span className="px-1.5">›</span>
        <span className="text-foreground">{t("purchasing.detail.crumb")}</span>
      </nav>

      {loading && !purchaseOrder ? (
        <p className="text-sm text-muted">{t("purchasing.detail.loading")}</p>
      ) : null}

      {error && !purchaseOrder ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
          <p className="text-destructive">{error}</p>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1 text-foreground hover:bg-canvas"
            onClick={() => setReload((n) => n + 1)}
          >
            {t("purchasing.retry")}
          </button>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1 text-foreground hover:bg-canvas"
            onClick={() => navigate("/purchasing")}
          >
            {t("purchasing.detail.back")}
          </button>
        </div>
      ) : null}

      {purchaseOrder ? (
        <PurchaseOrderDetailBody
          purchaseOrder={purchaseOrder}
          storeName={storeName?.trim() || t("header.storeUnavailable")}
          onReceive={() => navigate(`/purchasing/${encodeURIComponent(poId)}/receive`)}
        />
      ) : null}
    </div>
  );
}

function PurchaseOrderDetailBody({
  purchaseOrder,
  storeName,
  onReceive,
}: {
  purchaseOrder: PurchaseOrderDetail;
  storeName: string;
  onReceive: () => void;
}) {
  const { t } = useLocale();

  const progress = useMemo(() => {
    const ordered = purchaseOrder.lines.reduce(
      (sum, line) => sum + line.qtyOrdered,
      0,
    );
    const received = purchaseOrder.lines.reduce(
      (sum, line) => sum + line.qtyReceived,
      0,
    );
    const receivedValue = roundMoney(
      purchaseOrder.lines.reduce(
        (sum, line) => sum + line.qtyReceived * line.costPerBase,
        0,
      ),
    );
    const remainingValue = roundMoney(
      purchaseOrder.lines.reduce(
        (sum, line) => sum + (line.qtyOrdered - line.qtyReceived) * line.costPerBase,
        0,
      ),
    );
    const pct = ordered > 0 ? Math.round((received / ordered) * 100) : 0;
    return { ordered, received, receivedValue, remainingValue, pct };
  }, [purchaseOrder]);

  const remainingPcs = progress.ordered - progress.received;
  const canReceive =
    (purchaseOrder.status === "SENT" ||
      purchaseOrder.status === "PARTIALLY_RECEIVED") &&
    remainingPcs > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {purchaseOrder.poNumber}
            </h1>
            <StatusBadge status={purchaseOrder.status} />
          </div>
          <p className="mt-1 text-sm text-muted">
            {purchaseOrder.supplier?.name ?? "—"}
            {purchaseOrder.reference
              ? ` · ${purchaseOrder.reference}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled
            aria-disabled="true"
            title={t("purchasing.detail.exportSoon")}
            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-muted"
          >
            <FileText className="size-3.5" strokeWidth={1.75} />
            {t("purchasing.detail.export")}
          </button>
          <button
            type="button"
            disabled
            aria-disabled="true"
            title={t("purchasing.detail.printSoon")}
            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-muted"
          >
            <Printer className="size-3.5" strokeWidth={1.75} />
            {t("purchasing.detail.print")}
          </button>
          <button
            type="button"
            disabled
            aria-disabled="true"
            title={t("purchasing.detail.moreActionsSoon")}
            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-muted"
          >
            <MoreHorizontal className="size-3.5" strokeWidth={1.75} />
            {t("purchasing.detail.moreActions")}
          </button>
          {canReceive ? (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              onClick={onReceive}
            >
              <Truck className="size-3.5" strokeWidth={1.75} />
              {t("purchasing.detail.receive")}
            </button>
          ) : (
            <button
              type="button"
              disabled
              aria-disabled="true"
              title={t("purchasing.detail.receiveFull")}
              className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-border bg-canvas px-3 py-1.5 text-sm font-medium text-muted"
            >
              <Truck className="size-3.5" strokeWidth={1.75} />
              {t("purchasing.detail.receive")}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard
          label={t("purchasing.detail.kpi.orderValue")}
          value={formatTaka(purchaseOrder.estimatedTotal)}
          icon={<Boxes className="size-4 text-primary" strokeWidth={1.75} />}
        />
        <KpiCard
          label={t("purchasing.detail.kpi.receivedValue")}
          value={formatTaka(progress.receivedValue)}
          icon={
            <PackageCheck className="size-4 text-emerald-600" strokeWidth={1.75} />
          }
        />
        <KpiCard
          label={t("purchasing.detail.kpi.remainingValue")}
          value={formatTaka(progress.remainingValue)}
          icon={
            <PackageMinus className="size-4 text-amber-600" strokeWidth={1.75} />
          }
        />
        <KpiCard
          label={t("purchasing.detail.kpi.receipts")}
          value={formatCount(purchaseOrder.goodsReceipts.length)}
          hint={t("purchasing.detail.kpi.receiptsHint")}
          icon={<ReceiptText className="size-4 text-muted" strokeWidth={1.75} />}
        />
        <KpiCard
          label={t("purchasing.detail.progress.title")}
          value={`${formatCount(progress.pct)}%`}
          hint={`${formatCount(progress.received)} / ${formatCount(progress.ordered)} ${t("purchasing.detail.progress.pcs")}`}
          icon={
            <ClipboardList className="size-4 text-muted" strokeWidth={1.75} />
          }
        />
      </div>

      {purchaseOrder.lines.length > 0 ? (
        <section className="rounded-xl border border-border bg-surface p-5">
          <SectionHeader
            icon={<ClipboardList className="size-4 text-primary" strokeWidth={1.75} />}
            title={t("purchasing.detail.progress.title")}
            hint={`${formatCount(progress.received)} ${t("purchasing.detail.progress.received")} ${t("purchasing.detail.progress.of")} ${formatCount(progress.ordered)} ${t("purchasing.detail.progress.pcs")}`}
          />
          <div
            role="progressbar"
            aria-valuenow={progress.pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t("purchasing.detail.progress.title")}
            className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
          >
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(100, Math.max(0, progress.pct))}%` }}
            />
          </div>
        </section>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          <section className="rounded-xl border border-border bg-surface p-5">
            <SectionHeader
              icon={<ClipboardList className="size-4 text-primary" strokeWidth={1.75} />}
              title={t("purchasing.detail.lines.title")}
              hint={t("purchasing.detail.lines.hint")}
            />
            {purchaseOrder.lines.length === 0 ? (
              <p className="text-sm text-muted">{t("purchasing.detail.lines.empty")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[48rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-slate-50 text-xs font-medium uppercase tracking-wide text-muted">
                      <th className="px-3 py-2 font-medium">
                        {t("purchasing.detail.lines.col.product")}
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        {t("purchasing.detail.lines.col.ordered")}
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        {t("purchasing.detail.lines.col.received")}
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        {t("purchasing.detail.lines.col.remaining")}
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        {t("purchasing.detail.lines.col.cost")}
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        {t("purchasing.detail.lines.col.total")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseOrder.lines.map((line) => {
                      const remaining = line.qtyOrdered - line.qtyReceived;
                      const full = remaining <= 0;
                      return (
                        <tr
                          key={line.id}
                          className="border-b border-border last:border-b-0"
                        >
                          <td className="px-3 py-2.5">
                            <p className="font-medium text-foreground">
                              {line.product.name}
                            </p>
                            <p className="text-xs text-muted">
                              {[line.product.genericName, line.product.sku]
                                .filter(Boolean)
                                .join(" · ") || "—"}
                            </p>
                          </td>
                          <td className="px-3 py-2.5 text-right text-foreground">
                            {formatCount(line.qtyOrdered)}
                          </td>
                          <td className="px-3 py-2.5 text-right text-emerald-700">
                            {formatCount(line.qtyReceived)}
                          </td>
                          <td className="px-3 py-2.5 text-right text-foreground">
                            {full ? (
                              <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                {t("purchasing.detail.lines.full")}
                              </span>
                            ) : (
                              formatCount(remaining)
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right text-foreground">
                            {formatTaka(line.costPerBase)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-medium text-foreground">
                            {formatTaka(line.qtyOrdered * line.costPerBase)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-border bg-surface p-5">
            <SectionHeader
              icon={<ReceiptText className="size-4 text-primary" strokeWidth={1.75} />}
              title={t("purchasing.detail.receipts.title")}
              hint={t("purchasing.detail.receipts.hint")}
            />
            {purchaseOrder.goodsReceipts.length === 0 ? (
              <p className="text-sm text-muted">{t("purchasing.detail.receipts.empty")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[44rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-slate-50 text-xs font-medium uppercase tracking-wide text-muted">
                      <th className="px-3 py-2 font-medium">
                        {t("purchasing.detail.receipts.col.grn")}
                      </th>
                      <th className="px-3 py-2 font-medium">
                        {t("purchasing.detail.receipts.col.date")}
                      </th>
                      <th className="px-3 py-2 font-medium">
                        {t("purchasing.detail.receipts.col.by")}
                      </th>
                      <th className="px-3 py-2 font-medium">
                        {t("purchasing.detail.receipts.col.lines")}
                      </th>
                      <th className="px-3 py-2 font-medium">
                        {t("purchasing.detail.receipts.col.invoice")}
                      </th>
                      <th className="px-3 py-2 font-medium">
                        {t("purchasing.detail.receipts.col.delivery")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseOrder.goodsReceipts.map((receipt) => (
                      <tr
                        key={receipt.id}
                        className="border-b border-border last:border-b-0"
                      >
                        <td className="px-3 py-2.5 font-semibold text-primary">
                          {receipt.grnNumber}
                        </td>
                        <td className="px-3 py-2.5 text-foreground">
                          {formatDateTime(receipt.receivedAt)}
                        </td>
                        <td className="px-3 py-2.5 text-foreground">
                          {receipt.receivedBy?.name ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 text-foreground">
                          {formatCount(receipt._count.lines)}
                        </td>
                        <td className="px-3 py-2.5 text-foreground">
                          {receipt.supplierInvoiceRef ?? "—"}
                        </td>
                        <td className="px-3 py-2.5 text-foreground">
                          {receipt.deliveryNote ?? "—"}
                        </td>
                      </tr>
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
              icon={<Building2 className="size-4 text-primary" strokeWidth={1.75} />}
              title={t("purchasing.detail.info.title")}
            />
            <dl className="flex flex-col">
              <InfoRow
                label={t("purchasing.detail.info.supplier")}
                value={purchaseOrder.supplier?.name ?? "—"}
              />
              {purchaseOrder.supplier?.contactPerson ? (
                <InfoRow
                  label={t("purchasing.detail.info.contact")}
                  value={purchaseOrder.supplier.contactPerson}
                />
              ) : null}
              {purchaseOrder.supplier?.phone ? (
                <InfoRow
                  label={t("purchasing.detail.info.phone")}
                  value={purchaseOrder.supplier.phone}
                />
              ) : null}
              {purchaseOrder.supplier?.city ? (
                <InfoRow
                  label={t("purchasing.detail.info.city")}
                  value={purchaseOrder.supplier.city}
                />
              ) : null}
              <InfoRow
                label={t("purchasing.detail.info.reference")}
                value={purchaseOrder.reference ?? "—"}
              />
              <InfoRow
                label={t("purchasing.detail.info.expected")}
                value={
                  purchaseOrder.expectedDelivery
                    ? formatUtcDate(purchaseOrder.expectedDelivery)
                    : "—"
                }
              />
              <InfoRow
                label={t("purchasing.detail.info.branch")}
                value={purchaseOrder.store?.name ?? storeName}
              />
              <InfoRow
                label={t("purchasing.detail.info.createdBy")}
                value={purchaseOrder.createdBy?.name ?? "—"}
              />
              <InfoRow
                label={t("purchasing.detail.info.createdAt")}
                value={formatDateTime(purchaseOrder.createdAt)}
              />
              <InfoRow
                label={t("purchasing.detail.info.updatedAt")}
                value={formatDateTime(purchaseOrder.updatedAt)}
              />
            </dl>
            <div className="mt-4 flex items-start gap-3 rounded-lg border border-border bg-canvas px-4 py-3">
              <CalendarClock
                className="mt-0.5 size-4 shrink-0 text-muted"
                strokeWidth={1.75}
              />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {t("purchasing.create.branch")}
                </p>
                <p className="text-sm text-foreground">
                  {purchaseOrder.store?.name ?? storeName}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {t("purchasing.create.branchLocked")}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-surface p-5">
            <SectionHeader
              icon={<UserRound className="size-4 text-primary" strokeWidth={1.75} />}
              title={t("purchasing.detail.kpi.receipts")}
            />
            <dl className="flex flex-col">
              <InfoRow
                label={t("purchasing.detail.kpi.orderValue")}
                value={formatTaka(purchaseOrder.estimatedTotal)}
              />
              <InfoRow
                label={t("purchasing.detail.kpi.receivedValue")}
                value={formatTaka(progress.receivedValue)}
              />
              <InfoRow
                label={t("purchasing.detail.kpi.remainingValue")}
                value={formatTaka(progress.remainingValue)}
              />
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: PurchaseOrderStatus }) {
  const { t } = useLocale();
  const cls =
    status === "DRAFT"
      ? "bg-slate-100 text-slate-700"
      : status === "SENT"
        ? "bg-sky-100 text-sky-800"
        : status === "PARTIALLY_RECEIVED"
          ? "bg-amber-100 text-amber-800"
          : "bg-emerald-100 text-emerald-800";
  const label =
    status === "DRAFT"
      ? "purchasing.status.draft"
      : status === "SENT"
        ? "purchasing.status.sent"
        : status === "PARTIALLY_RECEIVED"
          ? "purchasing.status.partial"
          : "purchasing.status.received";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {t(label)}
    </span>
  );
}

function SectionHeader({
  icon,
  title,
  hint,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <div className="mb-4 flex items-start gap-2 border-b border-border pb-3">
      <span className="mt-0.5">{icon}</span>
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: ReactNode;
}) {
  return (
    <article className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
          {label}
        </p>
        <span className="text-muted">{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </article>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border py-2 last:border-b-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-right text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}