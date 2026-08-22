import { AlertCircle, CalendarDays, Check, Loader2, X } from "lucide-react";
import { useState } from "react";
import { useLocale } from "@/i18n";
import { formatDateTime, formatTaka } from "@/lib/format";
import {
  moneyNumber,
  resolveShiftVariance,
  type ShiftDetail,
  type ShiftListRow,
  type ShiftVarianceDecision,
} from "@/lib/shifts";

type ReviewableShift = Pick<
  ShiftListRow | ShiftDetail,
  "id" | "shiftNo" | "user" | "storeId" | "openedAt" | "expectedCash" | "countedCash" | "variance"
>;

const DECISIONS: ShiftVarianceDecision[] = [
  "ACCEPTED_DIFFERENCE",
  "COUNT_CORRECTED",
  "OTHER",
];

export function ReviewCashVarianceModal({
  shift,
  onCancel,
  onResolved,
}: {
  shift: ReviewableShift;
  onCancel: () => void;
  onResolved: () => void;
}) {
  const { t } = useLocale();
  const [decision, setDecision] = useState<ShiftVarianceDecision | "">("");
  const [note, setNote] = useState("");
  const [adjustmentReference, setAdjustmentReference] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expectedCash = moneyNumber(shift.expectedCash);
  const countedCash = moneyNumber(shift.countedCash);
  const variance = moneyNumber(shift.variance);

  async function submit() {
    if (!decision || !confirmed || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await resolveShiftVariance(shift.id, {
        varianceDecision: decision,
        varianceNote: note.trim() || undefined,
        adjustmentReference: adjustmentReference.trim() || undefined,
      });
      onResolved();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("shifts.review.error"));
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm" onMouseDown={onCancel}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-cash-variance-title"
        className="max-h-[92vh] w-full max-w-[720px] overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
          <div>
            <h2 id="review-cash-variance-title" className="text-lg font-semibold text-gray-900">
              {t("shifts.review.title")}
            </h2>
            <p className="mt-1 text-xs text-gray-500">{t("shifts.review.subtitle")}</p>
          </div>
          <button
            type="button"
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            onClick={onCancel}
            disabled={submitting}
            aria-label={t("shifts.review.close")}
          >
            <X className="size-5" strokeWidth={1.75} />
          </button>
        </header>

        <div className="space-y-5 px-5 py-4">
          <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <ModalMetric label={t("shifts.review.shift")} value={shift.shiftNo} />
            <ModalMetric label={t("shifts.review.cashier")} value={shift.user?.name ?? "—"} />
            <ModalMetric label={t("shifts.review.branch")} value={shift.storeId} />
            <ModalMetric label={t("shifts.review.date")} value={formatDateTime(shift.openedAt)} />
          </div>

          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              {t("shifts.review.discrepancy")}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <CashBox label={t("shifts.detail.expectedCash")} value={formatTaka(expectedCash)} />
              <CashBox label={t("shifts.detail.countedCash")} value={formatTaka(countedCash)} />
              <CashBox label={t("shifts.col.variance")} value={formatTaka(variance)} danger />
            </div>
            <div className="mt-3 flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
              <span>{t(variance < 0 ? "shifts.review.shortage" : "shifts.review.overage")}</span>
            </div>
          </section>

          <section className="border-t border-gray-200 pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
              {t("shifts.review.decision")}
            </p>
            <label className="block text-xs font-medium text-gray-600">
              {t("shifts.review.category")}
              <select
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                value={decision}
                onChange={(event) => setDecision(event.target.value as ShiftVarianceDecision | "")}
                disabled={submitting}
              >
                <option value="">{t("shifts.review.selectDecision")}</option>
                {DECISIONS.map((item) => (
                  <option key={item} value={item}>{t(`shifts.review.decision.${item}`)}</option>
                ))}
              </select>
            </label>

            <label className="mt-3 block text-xs font-medium text-gray-600">
              {t("shifts.review.notes")}
              <textarea
                className="mt-1 min-h-[88px] w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={t("shifts.review.notesPlaceholder")}
                maxLength={1000}
                disabled={submitting}
              />
            </label>

            <label className="mt-3 block text-xs font-medium text-gray-600">
              {t("shifts.review.adjustmentReference")}
              <input
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                value={adjustmentReference}
                onChange={(event) => setAdjustmentReference(event.target.value)}
                placeholder={t("shifts.review.adjustmentPlaceholder")}
                disabled={submitting}
              />
            </label>
          </section>

          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
            <CalendarDays className="mr-1 inline size-3.5" strokeWidth={1.75} />
            {t("shifts.review.auditHint")}
          </div>

          <label className="flex items-start gap-2 rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-700">
            <input
              type="checkbox"
              className="mt-0.5 size-4 rounded border-gray-300 text-teal-600"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              disabled={submitting}
            />
            <span>{t("shifts.review.confirm")}</span>
          </label>

          {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p> : null}
        </div>

        <footer className="flex flex-col-reverse gap-3 border-t border-gray-200 px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            onClick={onCancel}
            disabled={submitting}
          >
            {t("shifts.review.cancel")}
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={submit}
            disabled={!decision || !confirmed || submitting}
          >
            {submitting ? <Loader2 className="size-4 animate-spin" strokeWidth={1.75} /> : <Check className="size-4" strokeWidth={1.75} />}
            {submitting ? t("shifts.review.resolving") : t("shifts.review.resolve")}
          </button>
        </footer>
      </section>
    </div>
  );
}

function ModalMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function CashBox({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${danger ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"}`}>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tracking-tight ${danger ? "text-red-600" : "text-gray-900"}`}>{value}</p>
    </div>
  );
}
