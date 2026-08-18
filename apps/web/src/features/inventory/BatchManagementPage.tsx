import {
  AlertCircle,
  ArrowRight,
  Boxes,
  CalendarClock,
  CheckCircle2,
  ClipboardEdit,
  History,
  PackageX,
  Scale,
  ShieldAlert,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useLocale, type MessageKey } from "@/i18n";
import { ApiError } from "@/lib/api";
import {
  adjustOwnerBatch,
  correctOwnerBatch,
  fetchOwnerBatch,
  retireOwnerBatch,
  voidOwnerBatch,
  type BatchRevisionAction,
  type BatchSnapshot,
  type InventoryAdjustmentReason,
  type OwnerBatchDetail,
  type OwnerBatchRevision,
} from "@/lib/ownerBatch";
import {
  formatCount,
  formatDateTime,
  formatExpiryShort,
  formatTaka,
} from "@/lib/format";
import { useOwnerPath } from "@/lib/OwnerPathProvider";
import type { BatchLifecycleStatus, BatchReturnStatus } from "@/lib/ownerProduct";

const INPUT_CLASS =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-teal-600 focus:ring-1 focus:ring-teal-600 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

const LIFECYCLE_KEYS: Record<BatchLifecycleStatus, MessageKey> = {
  ACTIVE: "inventory.batch.lifecycle.active",
  RETIRED: "inventory.batch.lifecycle.retired",
  VOIDED: "inventory.batch.lifecycle.voided",
};

const RETURN_STATUS_KEYS: Record<BatchReturnStatus, MessageKey> = {
  ELIGIBLE: "inventory.expiry.return.eligible",
  NOT_ELIGIBLE: "inventory.expiry.return.notEligible",
  MANIFEST_PREPARED: "inventory.expiry.return.manifestPrepared",
};

const ADJUSTMENT_REASON_KEYS: Record<InventoryAdjustmentReason, MessageKey> = {
  COUNT_CORRECTION: "inventory.batch.reason.countCorrection",
  DAMAGE: "inventory.batch.reason.damage",
  BREAKAGE: "inventory.batch.reason.breakage",
  RETURN: "inventory.batch.reason.return",
  RECEIVE_CORRECTION: "inventory.batch.reason.receiveCorrection",
  OTHER: "inventory.batch.reason.other",
};

const REVISION_ACTION_KEYS: Record<BatchRevisionAction, MessageKey> = {
  METADATA_CORRECTION: "inventory.batch.action.metadataCorrection",
  PRICE_CORRECTION: "inventory.batch.action.priceCorrection",
  VOID: "inventory.batch.action.void",
  RETIRE: "inventory.batch.action.retire",
};

const SNAPSHOT_FIELDS: Array<{
  name: keyof BatchSnapshot;
  label: MessageKey;
}> = [
  { name: "batchNumber", label: "inventory.batch.field.batchNumber" },
  { name: "expiryDate", label: "inventory.batch.field.expiryDate" },
  { name: "costPerBase", label: "inventory.batch.field.costPerBase" },
  { name: "sellPerBase", label: "inventory.batch.field.sellPerBase" },
  { name: "supplierName", label: "inventory.expiry.filterSupplier" },
  { name: "returnStatus", label: "inventory.expiry.col.returnEligibility" },
  { name: "quantityOnHand", label: "inventory.batch.field.quantity" },
  { name: "status", label: "inventory.batch.field.status" },
];

type CorrectionForm = {
  batchNumber: string;
  expiryDate: string;
  costPerBase: string;
  sellPerBase: string;
  reason: string;
};

type MutationNotice = {
  key: MessageKey;
  detail?: string;
};

type LoadError = { key?: MessageKey; detail?: string };
type LifecycleIntent = "void" | "retire";

function correctionValues(batch: OwnerBatchDetail): CorrectionForm {
  return {
    batchNumber: batch.batchNumber,
    expiryDate: batch.expiryDate.slice(0, 10),
    costPerBase: String(batch.costPerBase),
    sellPerBase: String(batch.sellPerBase),
    reason: "",
  };
}

function numericValue(value: string): number {
  return value.trim() === "" ? Number.NaN : Number(value);
}

function operationId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function BatchManagementPage({
  productId,
  batchId,
}: {
  productId: string;
  batchId: string;
}) {
  const { t } = useLocale();
  const { navigate } = useOwnerPath();
  const requestSequence = useRef(0);
  const [batch, setBatch] = useState<OwnerBatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  const [reload, setReload] = useState(0);
  const [correction, setCorrection] = useState<CorrectionForm>({
    batchNumber: "",
    expiryDate: "",
    costPerBase: "",
    sellPerBase: "",
    reason: "",
  });
  const [quantityChange, setQuantityChange] = useState("");
  const [adjustmentReason, setAdjustmentReason] =
    useState<InventoryAdjustmentReason>("COUNT_CORRECTION");
  const [adjustmentNote, setAdjustmentNote] = useState("");
  const [submitting, setSubmitting] = useState<
    "correction" | "adjustment" | "lifecycle" | null
  >(null);
  const [mutationError, setMutationError] =
    useState<MutationNotice | null>(null);
  const [success, setSuccess] = useState<MessageKey | null>(null);
  const [lifecycleIntent, setLifecycleIntent] =
    useState<LifecycleIntent | null>(null);
  const [lifecycleReason, setLifecycleReason] = useState("");

  async function loadBatch(
    resetForms: boolean,
    showLoading: boolean,
  ): Promise<boolean> {
    const sequence = ++requestSequence.current;
    if (showLoading) setLoading(true);
    setLoadError(null);
    try {
      const payload = await fetchOwnerBatch(batchId);
      if (sequence !== requestSequence.current) return false;
      if (payload.productId !== productId) {
        setBatch(null);
        setLoadError({ key: "inventory.batch.notFound" });
        return false;
      }
      setBatch(payload);
      if (resetForms) {
        setCorrection(correctionValues(payload));
        setQuantityChange("");
        setAdjustmentNote("");
      }
      return true;
    } catch (error: unknown) {
      if (sequence !== requestSequence.current) return false;
      if (error instanceof ApiError && error.statusCode === 404) {
        setBatch(null);
        setLoadError({ key: "inventory.batch.notFound" });
      } else if (error instanceof ApiError) {
        setLoadError({
          key: batch
            ? "inventory.batch.refreshError"
            : "inventory.batch.loadError",
          detail: error.message,
        });
      } else {
        setLoadError({
          key: batch
            ? "inventory.batch.refreshError"
            : "inventory.batch.loadError",
        });
      }
      return false;
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }

  useEffect(() => {
    void loadBatch(true, true);
    return () => {
      requestSequence.current += 1;
    };
  }, [batchId, productId, reload]);

  async function runMutation(
    kind: "correction" | "adjustment" | "lifecycle",
    request: () => Promise<unknown>,
    successKey: MessageKey,
  ): Promise<boolean> {
    setSubmitting(kind);
    setMutationError(null);
    setSuccess(null);
    try {
      await request();
      const refreshed = await loadBatch(true, false);
      if (refreshed) {
        setSuccess(successKey);
      } else {
        setMutationError({ key: "inventory.batch.savedRefreshError" });
      }
      return true;
    } catch (error: unknown) {
      if (error instanceof ApiError && error.statusCode === 409) {
        const refreshed = await loadBatch(true, false);
        if (kind === "lifecycle") {
          setLifecycleIntent(null);
          setLifecycleReason("");
        }
        setMutationError({
          key: refreshed
            ? "inventory.batch.conflict"
            : "inventory.batch.conflictRefreshError",
          detail: error.message,
        });
      } else if (error instanceof ApiError) {
        setMutationError({
          key: "inventory.batch.submitError",
          detail: error.message,
        });
      } else {
        setMutationError({ key: "inventory.batch.submitError" });
      }
      return false;
    } finally {
      setSubmitting(null);
    }
  }

  async function submitCorrection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!batch || batch.status !== "ACTIVE") return;
    const reason = correction.reason.trim();
    const cost = numericValue(correction.costPerBase);
    const sell = numericValue(correction.sellPerBase);
    if (
      reason.length < 3 ||
      !correction.batchNumber.trim() ||
      !correction.expiryDate ||
      !Number.isFinite(cost) ||
      cost < 0 ||
      !Number.isFinite(sell) ||
      sell < 0
    ) {
      setMutationError({ key: "inventory.batch.correction.validation" });
      return;
    }

    const changes: {
      batchNumber?: string;
      expiryDate?: Date;
      costPerBase?: number;
      sellPerBase?: number;
    } = {};
    if (correction.batchNumber.trim() !== batch.batchNumber) {
      changes.batchNumber = correction.batchNumber.trim();
    }
    if (correction.expiryDate !== batch.expiryDate.slice(0, 10)) {
      changes.expiryDate = new Date(`${correction.expiryDate}T00:00:00.000Z`);
    }
    if (cost !== batch.costPerBase) changes.costPerBase = cost;
    if (sell !== batch.sellPerBase) changes.sellPerBase = sell;
    if (Object.keys(changes).length === 0) {
      setMutationError({ key: "inventory.batch.correction.noChanges" });
      return;
    }

    await runMutation(
      "correction",
      () =>
        correctOwnerBatch(batch.id, {
          operationId: operationId("batch-correction"),
          expectedVersion: batch.version,
          reason,
          ...changes,
        }),
      "inventory.batch.success.corrected",
    );
  }

  const adjustmentDelta = numericValue(quantityChange);
  const validAdjustment =
    Number.isInteger(adjustmentDelta) &&
    adjustmentDelta !== 0 &&
    Boolean(batch) &&
    batch!.quantityOnHand + adjustmentDelta >= 0;
  const projectedQuantity = batch
    ? batch.quantityOnHand + (Number.isInteger(adjustmentDelta) ? adjustmentDelta : 0)
    : 0;

  async function submitAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!batch || batch.status !== "ACTIVE") return;
    if (!validAdjustment) {
      setMutationError({ key: "inventory.batch.adjustment.validation" });
      return;
    }
    const succeeded = await runMutation(
      "adjustment",
      () =>
        adjustOwnerBatch(batch.id, {
          eventId: operationId("batch-adjustment"),
          expectedVersion: batch.version,
          quantityChange: adjustmentDelta,
          reasonCode: adjustmentReason,
          ...(adjustmentNote.trim() ? { note: adjustmentNote.trim() } : {}),
        }),
      "inventory.batch.success.adjusted",
    );
    if (succeeded) {
      setQuantityChange("");
      setAdjustmentNote("");
    }
  }

  async function confirmLifecycle() {
    if (!batch || !lifecycleIntent || lifecycleReason.trim().length < 3) {
      setMutationError({ key: "inventory.batch.lifecycle.reasonRequired" });
      return;
    }
    const intent = lifecycleIntent;
    const payload = {
      operationId: operationId(`batch-${intent}`),
      expectedVersion: batch.version,
      reason: lifecycleReason.trim(),
    };
    const succeeded = await runMutation(
      "lifecycle",
      () =>
        intent === "void"
          ? voidOwnerBatch(batch.id, payload)
          : retireOwnerBatch(batch.id, payload),
      intent === "void"
        ? "inventory.batch.success.voided"
        : "inventory.batch.success.retired",
    );
    if (succeeded) {
      setLifecycleIntent(null);
      setLifecycleReason("");
    }
  }

  const inactive = batch?.status !== "ACTIVE";
  const controlsDisabled = inactive || submitting !== null || loading || Boolean(loadError);
  const productPath = `/inventory/${encodeURIComponent(productId)}`;

  return (
    <div className="w-full px-4 py-4 sm:px-5">
      <nav
        aria-label={t("header.breadcrumb")}
        className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-muted"
      >
        <button
          type="button"
          className="hover:text-foreground hover:underline"
          onClick={() => navigate("/inventory")}
        >
          {t("nav.inventory")}
        </button>
        <span>›</span>
        {batch ? (
          <>
            <button
              type="button"
              className="max-w-52 truncate hover:text-foreground hover:underline"
              onClick={() => navigate(productPath)}
            >
              {batch.product.name}
            </button>
            <span>›</span>
          </>
        ) : null}
        <span className="font-medium text-foreground">
          {t("inventory.batch.crumb")}
        </span>
      </nav>

      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t("inventory.batch.title")}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {t("inventory.batch.subtitle")}
        </p>
      </div>

      {loading && !batch ? (
        <p className="text-sm text-muted">{t("inventory.batch.loading")}</p>
      ) : null}

      {loadError && !batch ? (
        <LoadErrorCard
          message={loadError.key ? t(loadError.key) : loadError.detail ?? t("inventory.batch.loadError")}
          onRetry={() => setReload((value) => value + 1)}
          onBack={() => navigate(productPath)}
        />
      ) : null}

      {batch ? (
        <div className="space-y-4">
          <BatchContextCard batch={batch} />

          {loadError ? (
            <LoadErrorCard
              message={`${loadError.key ? t(loadError.key) : t("inventory.batch.refreshError")}${loadError.detail ? ` ${loadError.detail}` : ""}`}
              onRetry={() => setReload((value) => value + 1)}
              onBack={() => navigate(productPath)}
            />
          ) : null}

          {success ? (
            <div
              role="status"
              className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
            >
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              <span>{t(success)}</span>
            </div>
          ) : null}

          {mutationError ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>
                {t(mutationError.key)}
                {mutationError.detail ? ` ${mutationError.detail}` : ""}
              </span>
            </div>
          ) : null}

          {inactive ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              <span>{t("inventory.batch.inactiveHint")}</span>
            </div>
          ) : null}

          <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
            <div className="space-y-4 xl:col-span-8">
              <CorrectionSection
                batch={batch}
                values={correction}
                disabled={controlsDisabled}
                submitting={submitting === "correction"}
                onChange={(field, value) =>
                  setCorrection((current) => ({ ...current, [field]: value }))
                }
                onSubmit={submitCorrection}
              />
              <AdjustmentSection
                batch={batch}
                quantityChange={quantityChange}
                reason={adjustmentReason}
                note={adjustmentNote}
                projectedQuantity={projectedQuantity}
                valid={validAdjustment}
                disabled={controlsDisabled}
                submitting={submitting === "adjustment"}
                onQuantityChange={setQuantityChange}
                onReasonChange={setAdjustmentReason}
                onNoteChange={setAdjustmentNote}
                onSubmit={submitAdjustment}
              />
            </div>

            <aside className="space-y-4 xl:col-span-4">
              <LifecycleSection
                batch={batch}
                disabled={controlsDisabled}
                onVoid={() => {
                  setMutationError(null);
                  setLifecycleReason("");
                  setLifecycleIntent("void");
                }}
                onRetire={() => {
                  setMutationError(null);
                  setLifecycleReason("");
                  setLifecycleIntent("retire");
                }}
              />
              <StockSummary batch={batch} projectedQuantity={projectedQuantity} />
            </aside>
          </div>

          <HistorySections batch={batch} />
        </div>
      ) : null}

      {batch && lifecycleIntent ? (
        <LifecycleModal
          batch={batch}
          intent={lifecycleIntent}
          reason={lifecycleReason}
          processing={submitting === "lifecycle"}
          onReasonChange={setLifecycleReason}
          onCancel={() => {
            if (!submitting) {
              setLifecycleIntent(null);
              setLifecycleReason("");
            }
          }}
          onConfirm={() => void confirmLifecycle()}
        />
      ) : null}
    </div>
  );
}

function LoadErrorCard({
  message,
  onRetry,
  onBack,
}: {
  message: string;
  onRetry: () => void;
  onBack: () => void;
}) {
  const { t } = useLocale();
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
      <AlertCircle className="size-4 text-destructive" />
      <p className="text-destructive">{message}</p>
      <button
        type="button"
        className="rounded-md border border-border px-3 py-1 hover:bg-canvas"
        onClick={onRetry}
      >
        {t("inventory.retry")}
      </button>
      <button
        type="button"
        className="rounded-md border border-border px-3 py-1 hover:bg-canvas"
        onClick={onBack}
      >
        {t("inventory.detail.back")}
      </button>
    </div>
  );
}

function BatchContextCard({ batch }: { batch: OwnerBatchDetail }) {
  const { t } = useLocale();
  const subtitle = [
    batch.product.genericName,
    batch.product.strength,
    batch.product.manufacturer,
  ]
    .filter(Boolean)
    .join(" | ");
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-teal-100 bg-teal-50 text-teal-700">
            <Boxes className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-slate-950">
              {batch.product.name}
            </h2>
            {subtitle ? (
              <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
            ) : null}
          </div>
        </div>
        <LifecycleBadge status={batch.status} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4 xl:grid-cols-8">
        <ContextField
          label={t("inventory.batch.field.batchNumber")}
          value={batch.batchNumber}
        />
        <ContextField
          label={t("inventory.batch.field.expiryDate")}
          value={formatExpiryShort(batch.expiryDate)}
        />
        <ContextField
          label={t("inventory.batch.currentStock")}
          value={`${formatCount(batch.quantityOnHand)} ${t("inventory.pcs")}`}
        />
        <ContextField
          label={t("inventory.batch.costPerPiece")}
          value={formatTaka(batch.costPerBase)}
        />
        <ContextField
          label={t("inventory.batch.sellPerPiece")}
          value={formatTaka(batch.sellPerBase)}
        />
        <ContextField
          label={t("inventory.batch.version")}
          value={formatCount(batch.version)}
        />
        <ContextField
          label={t("inventory.expiry.filterSupplier")}
          value={batch.supplierName ?? "—"}
        />
        <ContextField
          label={t("inventory.expiry.col.returnEligibility")}
          value={t(RETURN_STATUS_KEYS[batch.returnStatus])}
        />
      </div>
    </section>
  );
}

function CorrectionSection({
  batch,
  values,
  disabled,
  submitting,
  onChange,
  onSubmit,
}: {
  batch: OwnerBatchDetail;
  values: CorrectionForm;
  disabled: boolean;
  submitting: boolean;
  onChange: (field: keyof CorrectionForm, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const { t } = useLocale();
  return (
    <form onSubmit={onSubmit}>
      <Section
        icon={ClipboardEdit}
        title={t("inventory.batch.correction.title")}
        hint={t("inventory.batch.correction.hint")}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("inventory.batch.field.batchNumber")} required>
            <input
              className={INPUT_CLASS}
              value={values.batchNumber}
              disabled={disabled}
              onChange={(event) => onChange("batchNumber", event.target.value)}
              required
            />
          </Field>
          <Field label={t("inventory.batch.field.expiryDate")} required>
            <input
              className={INPUT_CLASS}
              type="date"
              value={values.expiryDate}
              disabled={disabled}
              onChange={(event) => onChange("expiryDate", event.target.value)}
              required
            />
          </Field>
          <Field label={t("inventory.batch.costPerPiece")} required>
            <MoneyInput
              value={values.costPerBase}
              disabled={disabled}
              onChange={(value) => onChange("costPerBase", value)}
            />
          </Field>
          <Field label={t("inventory.batch.sellPerPiece")} required>
            <MoneyInput
              value={values.sellPerBase}
              disabled={disabled}
              onChange={(value) => onChange("sellPerBase", value)}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label={t("inventory.batch.correction.reason")} required>
              <textarea
                className={`${INPUT_CLASS} min-h-20 resize-y`}
                value={values.reason}
                disabled={disabled}
                maxLength={500}
                placeholder={t("inventory.batch.correction.reasonPlaceholder")}
                onChange={(event) => onChange("reason", event.target.value)}
                required
              />
            </Field>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-500">
            {t("inventory.batch.expectedVersion")} {formatCount(batch.version)}
          </p>
          <button
            type="submit"
            disabled={disabled}
            className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            {submitting
              ? t("inventory.batch.correction.saving")
              : t("inventory.batch.correction.save")}
          </button>
        </div>
      </Section>
    </form>
  );
}

function AdjustmentSection({
  batch,
  quantityChange,
  reason,
  note,
  projectedQuantity,
  valid,
  disabled,
  submitting,
  onQuantityChange,
  onReasonChange,
  onNoteChange,
  onSubmit,
}: {
  batch: OwnerBatchDetail;
  quantityChange: string;
  reason: InventoryAdjustmentReason;
  note: string;
  projectedQuantity: number;
  valid: boolean;
  disabled: boolean;
  submitting: boolean;
  onQuantityChange: (value: string) => void;
  onReasonChange: (value: InventoryAdjustmentReason) => void;
  onNoteChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const { t } = useLocale();
  const delta = numericValue(quantityChange);
  const projectedRetail = Math.max(0, projectedQuantity) * batch.sellPerBase;
  return (
    <form onSubmit={onSubmit}>
      <Section
        icon={Scale}
        title={t("inventory.batch.adjustment.title")}
        hint={t("inventory.batch.adjustment.hint")}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("inventory.batch.adjustment.quantityChange")} required>
            <input
              className={INPUT_CLASS}
              type="number"
              step="1"
              value={quantityChange}
              disabled={disabled}
              placeholder={t("inventory.batch.adjustment.quantityPlaceholder")}
              onChange={(event) => onQuantityChange(event.target.value)}
              required
            />
            <p className="mt-1 text-[11px] text-slate-500">
              {t("inventory.batch.adjustment.quantityHint")}
            </p>
          </Field>
          <Field label={t("inventory.batch.adjustment.reasonCode")} required>
            <select
              className={INPUT_CLASS}
              value={reason}
              disabled={disabled}
              onChange={(event) =>
                onReasonChange(event.target.value as InventoryAdjustmentReason)
              }
            >
              {Object.entries(ADJUSTMENT_REASON_KEYS).map(([value, key]) => (
                <option key={value} value={value}>
                  {t(key)}
                </option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label={t("inventory.batch.adjustment.note")}> 
              <textarea
                className={`${INPUT_CLASS} min-h-20 resize-y`}
                value={note}
                disabled={disabled}
                maxLength={500}
                placeholder={t("inventory.batch.adjustment.notePlaceholder")}
                onChange={(event) => onNoteChange(event.target.value)}
              />
            </Field>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {t("inventory.batch.adjustment.projectedImpact")}
          </p>
          <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
            <ImpactValue
              label={t("inventory.batch.adjustment.currentQuantity")}
              value={formatCount(batch.quantityOnHand)}
            />
            <div className="flex flex-col items-center gap-1 text-teal-700">
              <ArrowRight className="size-4" />
              <span className="rounded bg-white px-2 py-0.5 text-xs font-semibold ring-1 ring-slate-200">
                {Number.isInteger(delta) && delta !== 0
                  ? `${delta > 0 ? "+" : ""}${formatCount(delta)}`
                  : "0"}
              </span>
            </div>
            <ImpactValue
              label={t("inventory.batch.adjustment.projectedQuantity")}
              value={valid ? formatCount(projectedQuantity) : "—"}
            />
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-dashed border-slate-200 pt-3 text-sm">
            <span className="text-slate-600">
              {t("inventory.batch.adjustment.projectedRetailValue")}
            </span>
            <span className="font-semibold text-slate-950">
              {valid ? formatTaka(projectedRetail) : "—"}
            </span>
          </div>
        </div>

        <div className="mt-4 flex justify-end border-t border-slate-100 pt-4">
          <button
            type="submit"
            disabled={disabled || !valid}
            className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Scale className="size-4" />
            )}
            {submitting
              ? t("inventory.batch.adjustment.applying")
              : t("inventory.batch.adjustment.apply")}
          </button>
        </div>
      </Section>
    </form>
  );
}

function LifecycleSection({
  batch,
  disabled,
  onVoid,
  onRetire,
}: {
  batch: OwnerBatchDetail;
  disabled: boolean;
  onVoid: () => void;
  onRetire: () => void;
}) {
  const { t } = useLocale();
  return (
    <Section
      icon={ShieldAlert}
      title={t("inventory.batch.lifecycle.title")}
      hint={t("inventory.batch.lifecycle.hint")}
    >
      <div className="space-y-3">
        <div className="rounded-lg bg-slate-50 p-3 text-sm">
          <SummaryRow
            label={t("inventory.batch.lifecycle.saleReferences")}
            value={formatCount(batch.saleReferenceCount)}
          />
          <SummaryRow
            label={t("inventory.batch.field.status")}
            value={t(LIFECYCLE_KEYS[batch.status])}
          />
        </div>
        <button
          type="button"
          disabled={disabled || !batch.canVoid}
          title={!batch.canVoid ? t("inventory.batch.lifecycle.voidUnavailable") : undefined}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onVoid}
        >
          <PackageX className="size-4" />
          {t("inventory.batch.lifecycle.void")}
        </button>
        <button
          type="button"
          disabled={disabled}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onRetire}
        >
          <ShieldAlert className="size-4" />
          {t("inventory.batch.lifecycle.retire")}
        </button>
        {!batch.canVoid && batch.status === "ACTIVE" ? (
          <p className="text-xs leading-relaxed text-amber-700">
            {t("inventory.batch.lifecycle.voidUnavailable")}
          </p>
        ) : null}
      </div>
    </Section>
  );
}

function StockSummary({
  batch,
  projectedQuantity,
}: {
  batch: OwnerBatchDetail;
  projectedQuantity: number;
}) {
  const { t } = useLocale();
  const safeProjected = Math.max(0, projectedQuantity);
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <CalendarClock className="size-4 text-teal-600" />
        <h2 className="text-sm font-semibold text-slate-900">
          {t("inventory.batch.stockSummary")}
        </h2>
      </div>
      <SummaryRow
        label={t("inventory.batch.currentStock")}
        value={`${formatCount(batch.quantityOnHand)} ${t("inventory.pcs")}`}
      />
      <SummaryRow
        label={t("inventory.batch.currentCostValue")}
        value={formatTaka(batch.quantityOnHand * batch.costPerBase)}
      />
      <SummaryRow
        label={t("inventory.batch.currentRetailValue")}
        value={formatTaka(batch.quantityOnHand * batch.sellPerBase)}
      />
      <div className="my-1 border-t border-dashed border-slate-200" />
      <SummaryRow
        label={t("inventory.batch.adjustment.projectedQuantity")}
        value={`${formatCount(safeProjected)} ${t("inventory.pcs")}`}
        strong
      />
    </section>
  );
}

function HistorySections({ batch }: { batch: OwnerBatchDetail }) {
  const { t } = useLocale();
  return (
    <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
          <History className="size-4 text-teal-600" />
          <h2 className="text-sm font-semibold text-slate-900">
            {t("inventory.batch.history.corrections")}
          </h2>
        </div>
        {batch.revisions.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">
            {t("inventory.batch.history.noCorrections")}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {batch.revisions.map((revision) => (
              <RevisionRow key={revision.id} revision={revision} />
            ))}
          </ul>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
          <Scale className="size-4 text-teal-600" />
          <h2 className="text-sm font-semibold text-slate-900">
            {t("inventory.batch.history.adjustments")}
          </h2>
        </div>
        {batch.adjustments.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">
            {t("inventory.batch.history.noAdjustments")}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {batch.adjustments.map((event) => (
              <li key={event.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p
                      className={`font-semibold ${event.quantityBaseChange < 0 ? "text-red-700" : "text-emerald-700"}`}
                    >
                      {event.quantityBaseChange > 0 ? "+" : ""}
                      {formatCount(event.quantityBaseChange)} {t("inventory.pcs")}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {adjustmentReasonLabel(event.reasonCode, t)}
                    </p>
                  </div>
                  <p className="shrink-0 text-xs text-slate-500">
                    {formatDateTime(event.createdAt)}
                  </p>
                </div>
                {event.note ? (
                  <p className="mt-2 text-sm text-slate-700">{event.note}</p>
                ) : null}
                <p className="mt-2 text-xs text-slate-500">
                  {t("inventory.batch.history.resultingQuantity")} {event.quantityAfter == null ? "—" : formatCount(event.quantityAfter)}
                  {" | "}
                  {event.actorName ?? t("inventory.batch.history.unknownActor")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function RevisionRow({ revision }: { revision: OwnerBatchRevision }) {
  const { t } = useLocale();
  const changes = SNAPSHOT_FIELDS.filter(
    ({ name }) => String(revision.before[name]) !== String(revision.after[name]),
  );
  return (
    <li className="px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900">
            {t(REVISION_ACTION_KEYS[revision.action])}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {revision.actorName || t("inventory.batch.history.unknownActor")}
          </p>
        </div>
        <p className="shrink-0 text-xs text-slate-500">
          {formatDateTime(revision.createdAt)}
        </p>
      </div>
      <p className="mt-2 text-sm text-slate-700">{revision.reason}</p>
      {changes.length > 0 ? (
        <dl className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3 text-xs">
          {changes.map(({ name, label }) => (
            <div key={name} className="grid grid-cols-[7rem_1fr] gap-2">
              <dt className="font-medium text-slate-600">{t(label)}</dt>
              <dd className="min-w-0 text-slate-800">
                {snapshotValue(name, revision.before[name], t)}
                <span className="px-1.5 text-slate-400">→</span>
                {snapshotValue(name, revision.after[name], t)}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </li>
  );
}

function LifecycleModal({
  batch,
  intent,
  reason,
  processing,
  onReasonChange,
  onCancel,
  onConfirm,
}: {
  batch: OwnerBatchDetail;
  intent: LifecycleIntent;
  reason: string;
  processing: boolean;
  onReasonChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useLocale();
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !processing) onCancel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [processing, onCancel]);

  const isVoid = intent === "void";
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/50 px-4 py-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={onCancel}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-lifecycle-title"
        className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span
            className={`grid size-10 shrink-0 place-items-center rounded-full ${isVoid ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}
          >
            {isVoid ? <PackageX className="size-5" /> : <ShieldAlert className="size-5" />}
          </span>
          <div>
            <h2 id="batch-lifecycle-title" className="text-lg font-semibold text-slate-950">
              {isVoid
                ? t("inventory.batch.confirm.voidTitle")
                : t("inventory.batch.confirm.retireTitle")}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              {isVoid
                ? t("inventory.batch.confirm.voidBody")
                : t("inventory.batch.confirm.retireBody")}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <SummaryRow
            label={t("inventory.batch.field.batchNumber")}
            value={batch.batchNumber}
          />
          <SummaryRow
            label={t("inventory.batch.confirm.currentStock")}
            value={`${formatCount(batch.quantityOnHand)} ${t("inventory.pcs")}`}
          />
          <SummaryRow
            label={t("inventory.batch.confirm.removedStock")}
            value={`-${formatCount(batch.quantityOnHand)} ${t("inventory.pcs")}`}
          />
          <div className="my-1 border-t border-dashed border-slate-200" />
          <SummaryRow
            label={t("inventory.batch.confirm.stockAfter")}
            value={`0 ${t("inventory.pcs")}`}
            strong
          />
          <SummaryRow
            label={t("inventory.batch.confirm.removedRetailValue")}
            value={formatTaka(batch.quantityOnHand * batch.sellPerBase)}
          />
        </div>

        <div className="mt-4">
          <Field label={t("inventory.batch.confirm.reason")} required>
            <textarea
              autoFocus
              className={`${INPUT_CLASS} min-h-20 resize-y`}
              value={reason}
              disabled={processing}
              maxLength={500}
              placeholder={t("inventory.batch.confirm.reasonPlaceholder")}
              onChange={(event) => onReasonChange(event.target.value)}
            />
          </Field>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={processing}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            onClick={onCancel}
          >
            {t("inventory.batch.confirm.cancel")}
          </button>
          <button
            type="button"
            disabled={processing || reason.trim().length < 3}
            className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${isVoid ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700"}`}
            onClick={onConfirm}
          >
            {processing ? (
              <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : isVoid ? (
              <PackageX className="size-4" />
            ) : (
              <ShieldAlert className="size-4" />
            )}
            {processing
              ? t("inventory.batch.confirm.processing")
              : isVoid
                ? t("inventory.batch.confirm.void")
                : t("inventory.batch.confirm.retire")}
          </button>
        </div>
      </section>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: typeof Boxes;
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-2 border-b border-slate-100 pb-3">
        <Icon className="mt-0.5 size-4 text-teal-600" />
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-xs text-slate-500">{hint}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-700">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function MoneyInput({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-2 text-sm text-slate-500">
        ৳
      </span>
      <input
        className={`${INPUT_CLASS} pl-7`}
        type="number"
        min="0"
        step="0.0001"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        required
      />
    </div>
  );
}

function LifecycleBadge({ status }: { status: BatchLifecycleStatus }) {
  const { t } = useLocale();
  const cls =
    status === "ACTIVE"
      ? "bg-emerald-50 text-emerald-800"
      : status === "RETIRED"
        ? "bg-amber-50 text-amber-800"
        : "bg-red-50 text-red-700";
  return (
    <span className={`rounded px-2.5 py-1 text-xs font-semibold ${cls}`}>
      {t(LIFECYCLE_KEYS[status])}
    </span>
  );
}

function ContextField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="text-slate-600">{label}</span>
      <span className={strong ? "font-bold text-slate-950" : "font-medium text-slate-900"}>
        {value}
      </span>
    </div>
  );
}

function ImpactValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function adjustmentReasonLabel(
  reason: string | null,
  t: (key: MessageKey) => string,
): string {
  if (reason && reason in ADJUSTMENT_REASON_KEYS) {
    return t(ADJUSTMENT_REASON_KEYS[reason as InventoryAdjustmentReason]);
  }
  if (reason === "BATCH_VOID") return t("inventory.batch.reason.batchVoid");
  if (reason === "BATCH_RETIRE") return t("inventory.batch.reason.batchRetire");
  return reason ?? t("inventory.batch.reason.other");
}

function snapshotValue(
  field: keyof BatchSnapshot,
  value: unknown,
  t: (key: MessageKey) => string,
): string {
  if (value == null) return "—";
  if (field === "costPerBase" || field === "sellPerBase") {
    const number = Number(value);
    return Number.isFinite(number) ? formatTaka(number) : String(value);
  }
  if (field === "expiryDate") {
    return typeof value === "string" ? formatExpiryShort(value) : String(value);
  }
  if (field === "status" && typeof value === "string" && value in LIFECYCLE_KEYS) {
    return t(LIFECYCLE_KEYS[value as BatchLifecycleStatus]);
  }
  if (
    field === "returnStatus" &&
    typeof value === "string" &&
    value in RETURN_STATUS_KEYS
  ) {
    return t(RETURN_STATUS_KEYS[value as BatchReturnStatus]);
  }
  return String(value);
}
