import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { AlertTriangle, ArrowLeft, ShieldCheck, X } from "lucide-react";
import { useLocale, type MessageKey } from "@/i18n";
import type { CartLine } from "@/features/pos/cartTypes";
import type { PosBatchRow } from "@/lib/batchSelect";
import type { ChangeBatchDraft } from "@/lib/changeBatch";
import {
  STUB_AUTHORIZER_OPTIONS,
  STUB_MANAGER_PIN_LENGTH,
  acceptStubManagerPin,
  authorizerLabel,
  isStubManagerPinComplete,
  type StagedFefoOverride,
} from "@/lib/fefoOverrideAuth";
import { formatExpiryMonthYear } from "@/lib/productSearch";
import type { PackagingUnitType } from "@/lib/qtyPackaging";

export type ManagerAuthorizationModalProps = {
  line: CartLine;
  draft: ChangeBatchDraft;
  requestedBatch: PosBatchRow;
  fefoBatch: PosBatchRow | null;
  /** Back to Change Batch selection. */
  onBack: () => void;
  onCancel: () => void;
  /**
   * Stub authorize succeeded — App stages override for Batch P
   * (Edit Sale Item - Override Authorized / cart toast).
   */
  onAuthorized: (staged: StagedFefoOverride) => void;
};

function packagingLabel(
  unitType: PackagingUnitType,
  t: (key: MessageKey) => string,
): string {
  if (unitType === "PIECE") return t("pos.piece");
  if (unitType === "STRIP") return t("pos.strip");
  return t("pos.box");
}

/**
 * Manager Authorization — MANUAL FEFO OVERRIDE (Batch O).
 * Esc / Back → Change Batch · Enter → Authorize when stub form valid.
 *
 * TODO(real integration): MANAGER/OWNER PIN/password verify + audit API.
 * Stub PIN rule: any complete 4-digit PIN (see `acceptStubManagerPin`).
 */
export function ManagerAuthorizationModal({
  line,
  draft,
  requestedBatch,
  fefoBatch,
  onBack,
  onCancel,
  onAuthorized,
}: ManagerAuthorizationModalProps) {
  const { t } = useLocale();
  const titleId = useId();
  const pinGroupId = useId();
  const authorizerId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const pinRefs = useRef<Array<HTMLInputElement | null>>([]);

  const [pinDigits, setPinDigits] = useState<string[]>(() =>
    Array.from({ length: STUB_MANAGER_PIN_LENGTH }, () => ""),
  );
  const [authorizerOptionId, setAuthorizerOptionId] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);

  const requiredPcs = Math.max(1, draft.quantityBase);
  const unitLabel = packagingLabel(draft.unitType, t);
  const pinValue = pinDigits.join("");
  const pinComplete = isStubManagerPinComplete(pinValue);
  const authorizer = STUB_AUTHORIZER_OPTIONS.find(
    (o) => o.id === authorizerOptionId,
  );
  const canAuthorize = pinComplete && Boolean(authorizer);

  useEffect(() => {
    dialogRef.current?.focus();
    queueMicrotask(() => pinRefs.current[0]?.focus());
  }, []);

  const setDigitAt = useCallback((index: number, raw: string) => {
    const digit = raw.replace(/\D/g, "").slice(-1);
    setPinError(null);
    setPinDigits((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (digit && index < STUB_MANAGER_PIN_LENGTH - 1) {
      pinRefs.current[index + 1]?.focus();
    }
  }, []);

  const clearPinFrom = useCallback((index: number) => {
    setPinDigits((prev) => {
      const next = [...prev];
      for (let i = index; i < STUB_MANAGER_PIN_LENGTH; i++) next[i] = "";
      return next;
    });
  }, []);

  const authorize = useCallback(() => {
    if (!authorizer) return;
    if (!acceptStubManagerPin(pinValue)) {
      setPinError(t("managerAuth.enterPin"));
      pinRefs.current[0]?.focus();
      return;
    }
    onAuthorized({
      lineId: line.id,
      requestedBatch,
      fefoBatch,
      authorizedById: authorizer.id,
      authorizedByName: authorizer.name,
      authorizedAt: new Date().toISOString(),
    });
  }, [
    authorizer,
    pinValue,
    onAuthorized,
    line.id,
    requestedBatch,
    fefoBatch,
    t,
  ]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onBack();
      return;
    }
    if (event.key === "Enter") {
      if (!canAuthorize) return;
      event.preventDefault();
      event.stopPropagation();
      authorize();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-xl outline-none"
      >
        <div className="relative border-b border-border px-5 pt-4 pb-3">
          <button
            type="button"
            onClick={onBack}
            className="absolute top-4 left-5 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <ArrowLeft className="size-4" strokeWidth={2} aria-hidden />
            {t("managerAuth.backToBatch")}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="absolute top-3.5 right-4 rounded-md p-1 text-muted hover:bg-shell hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label={t("pos.close")}
          >
            <X className="size-5" strokeWidth={1.75} />
          </button>
          <div className="px-8 pt-1 text-center">
            <h2
              id={titleId}
              className="text-xl font-bold tracking-tight text-primary"
            >
              {t("managerAuth.title")}
            </h2>
            <p className="mt-0.5 text-[11px] font-bold tracking-wide text-muted uppercase">
              {t("managerAuth.manualFefoOverride")}
            </p>
          </div>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">
                {t("managerAuth.medicine")}
              </p>
              <p className="text-base font-bold text-foreground">
                {line.productName}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">
                {t("managerAuth.quantityRequired")}
              </p>
              <p className="text-sm font-bold text-foreground tabular-nums">
                {requiredPcs} {t("pos.pieces")}
              </p>
              <p className="text-[11px] text-muted">
                ({draft.unitQty} × {unitLabel})
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border border-primary/25 bg-primary/5 px-3 py-2.5">
              <p className="text-[10px] font-bold tracking-wide text-primary uppercase">
                {t("managerAuth.currentFefoBatch")}
              </p>
              <p className="mt-1 text-sm font-bold text-foreground">
                {fefoBatch?.batchNumber ?? "—"}
              </p>
              <p className="mt-0.5 text-xs text-muted tabular-nums">
                {t("edit.exp")}:{" "}
                {fefoBatch
                  ? formatExpiryMonthYear(fefoBatch.expiryDate)
                  : "—"}
              </p>
            </div>
            <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2.5">
              <p className="text-[10px] font-bold tracking-wide text-sky-700 uppercase">
                {t("managerAuth.requestedBatch")}
              </p>
              <p className="mt-1 text-sm font-bold text-foreground">
                {requestedBatch.batchNumber}
              </p>
              <p className="mt-0.5 text-xs text-muted tabular-nums">
                {t("edit.exp")}: {formatExpiryMonthYear(requestedBatch.expiryDate)}
              </p>
            </div>
          </div>

          <div
            role="alert"
            className="flex gap-2.5 rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-sm"
          >
            <AlertTriangle
              className="mt-0.5 size-4 shrink-0 text-destructive"
              strokeWidth={2}
              aria-hidden
            />
            <p className="text-destructive">
              <span className="font-bold tracking-wide uppercase">
                {t("managerAuth.reasonForOverride")}{" "}
              </span>
              <span className="font-medium text-destructive/90">
                {t("managerAuth.reasonBody")}
              </span>
            </p>
          </div>

          <div>
            <label
              htmlFor={pinGroupId}
              className="text-sm font-semibold text-foreground"
            >
              {t("managerAuth.managerPin")}
            </label>
            <div
              id={pinGroupId}
              className="mt-2 flex items-center justify-center gap-2"
              role="group"
              aria-label={t("managerAuth.managerPin")}
            >
              {pinDigits.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    pinRefs.current[index] = el;
                  }}
                  type="password"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={1}
                  value={digit}
                  aria-label={`${t("managerAuth.pinDigit")} ${index + 1}`}
                  onChange={(e) => setDigitAt(index, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Backspace" && !pinDigits[index] && index > 0) {
                      e.preventDefault();
                      clearPinFrom(index - 1);
                      pinRefs.current[index - 1]?.focus();
                    }
                  }}
                  onPaste={(e) => {
                    e.preventDefault();
                    const pasted = e.clipboardData
                      .getData("text")
                      .replace(/\D/g, "")
                      .slice(0, STUB_MANAGER_PIN_LENGTH);
                    if (!pasted) return;
                    setPinError(null);
                    setPinDigits((prev) => {
                      const next = [...prev];
                      for (let i = 0; i < STUB_MANAGER_PIN_LENGTH; i++) {
                        next[i] = pasted[i] ?? "";
                      }
                      return next;
                    });
                    const focusAt = Math.min(
                      pasted.length,
                      STUB_MANAGER_PIN_LENGTH - 1,
                    );
                    pinRefs.current[focusAt]?.focus();
                  }}
                  className="size-11 rounded-md border border-border bg-surface text-center text-lg font-bold text-foreground tabular-nums shadow-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
                />
              ))}
            </div>
            {pinError ? (
              <p className="mt-1.5 text-center text-xs text-destructive" role="alert">
                {pinError}
              </p>
            ) : (
              <p className="mt-1.5 text-center text-[11px] text-muted">
                {t("managerAuth.stubPinHint")}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor={authorizerId}
              className="text-sm font-semibold text-foreground"
            >
              {t("managerAuth.authorizedBy")}
            </label>
            <select
              id={authorizerId}
              value={authorizerOptionId}
              onChange={(e) => setAuthorizerOptionId(e.target.value)}
              className="mt-2 w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <option value="">{t("managerAuth.selectManager")}</option>
              {STUB_AUTHORIZER_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {authorizerLabel(opt)}
                </option>
              ))}
            </select>
          </div>

          <p className="flex items-start gap-2 text-xs text-muted">
            <ShieldCheck
              className="mt-0.5 size-3.5 shrink-0 text-primary"
              strokeWidth={2}
              aria-hidden
            />
            <span>{t("managerAuth.auditNote")}</span>
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border bg-shell/40 px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground hover:bg-shell focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {t("footer.cancel")}
          </button>
          <button
            type="button"
            onClick={authorize}
            disabled={!canAuthorize}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {t("managerAuth.authorizeOverride")}
            <kbd className="rounded border border-white/30 bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold">
              Enter
            </kbd>
          </button>
        </div>
      </div>
    </div>
  );
}
