import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Landmark,
  Loader2,
  UserRound,
  AlertTriangle,
  FileCheck2,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useLocale } from "@/i18n";
import { ApiError } from "@/lib/api";
import { formatCount, formatDateTime, formatSalesDateTime, formatTaka, formatTime, initialsFromName } from "@/lib/format";
import { useOwnerPath } from "@/lib/OwnerPathProvider";
import {
  fetchShiftDetail,
  moneyNumber,
  type ShiftDetail,
  type ShiftStatus,
} from "@/lib/shifts";
import { ReviewCashVarianceModal } from "./ReviewCashVarianceModal";

export function ShiftDetailPage({ shiftId }: { shiftId: string }) {
  const { t } = useLocale();
  const { navigate } = useOwnerPath();
  const [detail, setDetail] = useState<ShiftDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [reviewOpen, setReviewOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetchShiftDetail(shiftId)
      .then((data) => {
        if (cancelled) return;
        setDetail(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setDetail(null);
        setLoading(false);
        setError(err instanceof ApiError ? err.message : t("shifts.detail.error"));
      });

    return () => {
      cancelled = true;
    };
  }, [shiftId, reload, t]);

  if (loading && !detail) {
    return (
      <div className="w-full px-5 py-4">
        <p className="flex items-center gap-2 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />
          {t("shifts.detail.loading")}
        </p>
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div className="w-full px-5 py-4">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
          <p className="text-destructive">{error}</p>
          <button type="button" className="rounded-md border border-border px-3 py-1 text-foreground hover:bg-canvas" onClick={() => setReload((n) => n + 1)}>
            {t("shifts.retry")}
          </button>
          <button type="button" className="rounded-md border border-border px-3 py-1 text-foreground hover:bg-canvas" onClick={() => navigate("/staff/shifts")}>
            {t("shifts.detail.back")}
          </button>
        </div>
      </div>
    );
  }

  if (!detail) return null;

  const openedAt = detail.openedAt;
  const closedAt = detail.closedAt;
  const expectedCash = moneyNumber(detail.expectedCash) || moneyNumber(detail.openingFloat) + moneyNumber(detail.cashSales);
  const countedCash = detail.countedCash == null ? null : moneyNumber(detail.countedCash);
  const variance = detail.variance == null ? 0 : moneyNumber(detail.variance);
  const hasUnresolvedVariance = detail.status === "FLAGGED" && variance !== 0;
  const hasResolvedVariance = detail.status === "CLOSED" && variance !== 0 && Boolean(detail.reviewedAt || detail.varianceDecision);
  const totalSales = moneyNumber(detail.cashSales) + moneyNumber(detail.cardSales) + moneyNumber(detail.mfsSales);
  const posActivityUrl = buildPosActivityUrl(detail);

  const breakdown = new Map(detail.breakdown.map((row) => [row.method, moneyNumber(row.amount)]));
  const cashBreakdown = breakdown.get("CASH") ?? moneyNumber(detail.cashSales);
  const cardBreakdown = breakdown.get("CARD") ?? moneyNumber(detail.cardSales);
  const mfsBreakdown = breakdown.get("MFS") ?? moneyNumber(detail.mfsSales);

  return (
    <div className="w-full px-5 py-4">
      <nav className="mb-3 flex items-center gap-1.5 text-xs text-muted">
        <button type="button" onClick={() => navigate("/staff")} className="hover:text-primary hover:underline">
          {t("page.staffTitle")}
        </button>
        <span>/</span>
        <button type="button" onClick={() => navigate("/staff/shifts")} className="hover:text-primary hover:underline">
          {t("shifts.title")}
        </button>
        <span>/</span>
        <span className="font-medium text-foreground">{detail.shiftNo}</span>
      </nav>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{detail.shiftNo}</h1>
            <ShiftStatusBadge status={detail.status} />
          </div>
          <p className="mt-1 text-sm text-muted">
            {detail.user?.name ?? t("shifts.detail.unknownCashier")} · {formatSalesDateTime(openedAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-canvas" onClick={() => navigate("/staff/shifts")}>
            <ArrowLeft className="size-4" strokeWidth={1.75} />
            {t("shifts.detail.back")}
          </button>
          <button type="button" className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted disabled:cursor-not-allowed disabled:opacity-70" disabled title={t("shifts.disabled.requestCashCountHint")}>
            {t("shifts.requestCashCount")}
          </button>
          <button type="button" className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted disabled:cursor-not-allowed disabled:opacity-70" disabled>
            {t("shifts.detail.generateReport")}
          </button>
          {detail.status === "FLAGGED" ? (
            <button type="button" className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700" onClick={() => setReviewOpen(true)}>
              {t("shifts.action.review")}
            </button>
          ) : null}
          <button type="button" className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700" onClick={() => navigate(posActivityUrl)}>
            {t("shifts.detail.viewPosActivity")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DetailCard icon={<UserRound className="size-4" strokeWidth={1.75} />} label={t("shifts.detail.kpi.cashier")}>
          <div className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-indigo-100 text-xs font-semibold text-indigo-700">
              {initialsFromName(detail.user?.name ?? "")}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{detail.user?.name ?? t("shifts.detail.unknownCashier")}</p>
              <p className="text-xs text-muted">{t("shifts.detail.kpi.cashierHint")}</p>
            </div>
          </div>
        </DetailCard>
        <DetailCard icon={<Clock3 className="size-4" strokeWidth={1.75} />} label={t("shifts.detail.kpi.time")}>
          <div className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1 text-sm">
            <span className="text-muted">{t("shifts.detail.audit.openedAt")}</span>
            <span className="font-semibold text-foreground">{formatTime(openedAt)}</span>
            <span className="text-muted">{t("shifts.detail.audit.closedAt")}</span>
            <span className="font-semibold text-foreground">{closedAt ? formatTime(closedAt) : "—"}</span>
          </div>
        </DetailCard>
        <DetailCard icon={<Landmark className="size-4" strokeWidth={1.75} />} label={t("shifts.detail.kpi.float")}>
          <p className="text-2xl font-semibold tracking-tight text-foreground">{formatTaka(moneyNumber(detail.openingFloat))}</p>
        </DetailCard>
        <DetailCard icon={<CheckCircle2 className="size-4" strokeWidth={1.75} />} label={t("shifts.detail.kpi.status")}>
          <ShiftStatusBadge status={detail.status} />
        </DetailCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          {hasUnresolvedVariance ? (
            <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 size-5 shrink-0" strokeWidth={1.75} />
              <div>
                <p className="font-semibold">{t("shifts.detail.varianceRequiresReview")}</p>
                <p>{t("shifts.detail.varianceDifference")} {formatTaka(variance)}.</p>
              </div>
            </div>
          ) : null}

          {hasResolvedVariance ? (
            <section className="overflow-hidden rounded-xl border border-teal-200 bg-surface">
              <div className="border-b border-teal-100 bg-teal-50 px-4 py-3">
                <h2 className="flex items-center gap-2 text-base font-semibold text-teal-800">
                  <FileCheck2 className="size-4" strokeWidth={1.75} />
                  {t("shifts.detail.reviewCard.title")}
                </h2>
                <p className="mt-1 text-xs text-teal-700">{t("shifts.detail.reviewCard.subtitle")}</p>
              </div>
              <div className="grid grid-cols-1 gap-x-8 px-4 py-3 text-sm sm:grid-cols-2">
                <SummaryRow label={t("shifts.detail.reviewCard.decision")} value={detail.varianceDecision ? t(`shifts.review.decision.${detail.varianceDecision}` as any) : "—"} />
                <SummaryRow label={t("shifts.detail.reviewCard.reviewedAt")} value={detail.reviewedAt ? formatDateTime(detail.reviewedAt) : "—"} />
                <SummaryRow label={t("shifts.detail.reviewCard.adjustmentReference")} value={detail.adjustmentReference || "—"} />
                <SummaryRow label={t("shifts.col.variance")} value={formatTaka(variance)} valueClass="text-amber-700" />
              </div>
              {detail.varianceNote ? (
                <div className="mx-4 mb-4 rounded-lg border border-border bg-canvas px-3 py-2 text-sm text-muted">
                  <span className="font-semibold text-foreground">{t("shifts.detail.reviewCard.note")}: </span>
                  {detail.varianceNote}
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="overflow-hidden rounded-xl border border-border bg-surface">
            <SectionHeader title={t("shifts.detail.cashSummary")} />
            <div className="divide-y divide-border px-4 py-3 text-sm">
              <SummaryRow label={t("shifts.openingFloat")} value={formatTaka(moneyNumber(detail.openingFloat))} />
              <SummaryRow label={t("shifts.detail.cashSales")} value={`+ ${formatTaka(moneyNumber(detail.cashSales))}`} valueClass="text-primary" />
              <SummaryRow label={t("shifts.detail.expectedCash")} value={formatTaka(expectedCash)} strong />
              <SummaryRow label={t("shifts.detail.countedCash")} value={countedCash == null ? "—" : formatTaka(countedCash)} />
              <SummaryRow label={t("shifts.col.variance")} value={formatTaka(variance)} valueClass={variance === 0 ? "text-foreground" : "text-red-600"} />
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-border bg-surface">
            <SectionHeader title={t("shifts.detail.salesSummary")} />
            <div className="grid grid-cols-1 gap-x-8 px-4 py-3 text-sm sm:grid-cols-2">
              <SummaryRow label={t("shifts.detail.salesTransactions")} value={formatCount(detail.txnCount)} />
              <SummaryRow label={t("shifts.detail.payment.cash")} value={formatTaka(cashBreakdown)} />
              <SummaryRow label={t("shifts.detail.payment.card")} value={formatTaka(cardBreakdown)} />
              <SummaryRow label={t("shifts.detail.payment.mfs")} value={formatTaka(mfsBreakdown)} />
            </div>
            <div className="mx-4 mb-4 mt-2 flex items-center justify-between rounded-lg bg-teal-50 px-4 py-3 text-primary">
              <span className="text-base font-semibold">{t("shifts.detail.totalSales")}</span>
              <span className="text-3xl font-semibold tracking-tight">{formatTaka(totalSales)}</span>
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="overflow-hidden rounded-xl border border-border bg-surface">
            <SectionHeader title={t("shifts.detail.activity")} />
            <div className="p-4">
              {detail.activity.length === 0 ? (
                <p className="text-sm text-muted">{t("shifts.detail.noActivity")}</p>
              ) : (
                <ol className="relative space-y-4 before:absolute before:left-[3px] before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-border">
                  {detail.activity.map((event, index) => (
                    <li key={event.id} className="relative flex gap-3 pl-0">
                      <span className={`mt-1 size-2 shrink-0 rounded-full ${index === 0 ? "bg-primary" : "bg-border"}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{t(`shifts.detail.activity.${event.type}`)}</p>
                        <p className="text-xs text-muted">{formatSalesDateTime(event.createdAt)}</p>
                        {event.note ? <p className="mt-1 text-sm text-muted">{event.note}</p> : null}
                      </div>
                    </li>
                  ))}
                  {detail.status === "OPEN" ? (
                    <li className="relative flex gap-3 pl-0 italic text-muted">
                      <span className="mt-1 size-2 shrink-0 rounded-full border border-border bg-surface" />
                      <p className="text-sm">{t("shifts.detail.inProgress")}</p>
                    </li>
                  ) : null}
                </ol>
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-border bg-surface">
            <SectionHeader title={t("shifts.detail.audit")} />
            <div className="space-y-3 p-4 text-sm">
              <AuditBlock label={t("shifts.detail.audit.createdBy")} value={t("shifts.detail.audit.systemPos")} />
              <AuditBlock label={t("shifts.detail.audit.updatedAt")} value={formatDateTime(detail.updatedAt)} />
              <AuditBlock label={t("shifts.detail.audit.branch")} value={detail.storeId} />
              <div className="rounded-lg border border-border bg-canvas px-3 py-2 text-xs text-muted">
                <CalendarClock className="mr-1 inline size-3.5" strokeWidth={1.75} />
                {t("shifts.detail.auditHint")}
              </div>
            </div>
          </section>
        </div>
      </div>

      {reviewOpen ? (
        <ReviewCashVarianceModal
          shift={detail}
          onCancel={() => setReviewOpen(false)}
          onResolved={() => {
            setReviewOpen(false);
            setReload((n) => n + 1);
          }}
        />
      ) : null}
    </div>
  );
}

function buildPosActivityUrl(detail: ShiftDetail): string {
  const params = new URLSearchParams();
  params.set("userId", detail.userId);
  params.set("from", detail.openedAt.slice(0, 10));
  params.set("to", (detail.closedAt ?? new Date().toISOString()).slice(0, 10));
  return `/sales?${params.toString()}`;
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

function DetailCard({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  return (
    <article className="min-h-[5rem] rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-primary">{icon}</span>
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground">{label}</p>
      </div>
      {children}
    </article>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="border-b border-border bg-slate-50 px-4 py-3">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
    </div>
  );
}

function SummaryRow({ label, value, valueClass, strong }: { label: string; value: string; valueClass?: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 py-2 ${strong ? "bg-slate-50 px-2 font-semibold" : ""}`}>
      <span className="text-muted">{label}</span>
      <span className={`font-medium ${valueClass ?? "text-foreground"}`}>{value}</span>
    </div>
  );
}

function AuditBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 break-words font-medium text-foreground">{value}</p>
    </div>
  );
}
