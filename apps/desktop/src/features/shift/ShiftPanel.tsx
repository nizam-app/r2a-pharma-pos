import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Clock3, X } from "lucide-react";
import { useAuth } from "@/features/auth";
import { ConfirmDialog } from "@/features/pos";
import { useLocale } from "@/i18n";
import { useConnectivity } from "@/features/shell";
import {
  formatShiftDuration,
  formatShiftOpenedAt,
  shiftStore,
  type ActiveShift,
} from "@/lib/shiftStore";

export type ShiftPanelProps = {
  onClose: () => void;
  /** Fired after open/close so Counter Ready can refresh. */
  onShiftChanged?: () => void;
};

/**
 * Shift — Open / Close (M6 Batch AY — cloud shift).
 * Open: opening float required → POST /shifts.
 * Close: counted cash required → POST /shifts/active/close.
 * Online required for both. Cached for offline sale ingest shiftId.
 * ←/→ CTAs · Esc close · no Tab · no Baki.
 */
export function ShiftPanel({ onClose, onShiftChanged }: ShiftPanelProps) {
  const { t } = useLocale();
  const { user, cashierLabel } = useAuth();
  const { isOnline } = useConnectivity();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const openBtnRef = useRef<HTMLButtonElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const floatInputRef = useRef<HTMLInputElement>(null);
  const countedInputRef = useRef<HTMLInputElement>(null);

  const [shift, setShift] = useState<ActiveShift | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Open form state */
  const [floatValue, setFloatValue] = useState("");
  /** Close form state */
  const [countedValue, setCountedValue] = useState("");
  /** Close result */
  const [closeResult, setCloseResult] = useState<{
    variance: number;
    status: string;
  } | null>(null);

  const reload = useCallback(() => {
    if (!user?.tenantId) {
      setShift(null);
      return;
    }
    setShift(shiftStore.get(user.tenantId, user.storeId ?? null));
  }, [user?.tenantId, user?.storeId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (confirmClose || confirmOpen) return;
    panelRef.current?.focus();
    queueMicrotask(() => {
      if (shift) closeBtnRef.current?.focus();
      else floatInputRef.current?.focus();
    });
  }, [shift, confirmClose, confirmOpen]);

  // Tick duration while panel is open and a shift is active.
  useEffect(() => {
    if (!shift || confirmClose) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [shift, confirmClose]);

  const notifyChanged = useCallback(() => {
    onShiftChanged?.();
  }, [onShiftChanged]);

  const onOpenShift = useCallback(async () => {
    if (!user?.tenantId) return;
    if (!isOnline) {
      setError(t("shift.openingOnlineRequired"));
      return;
    }
    const float = parseFloat(floatValue);
    if (!Number.isFinite(float) || float < 0) return;
    setLoading(true);
    setError(null);
    try {
      const next = await shiftStore.open(user.tenantId, user.storeId ?? null, {
        openedByName: cashierLabel || user.name || user.email || "Cashier",
        openedByUserId: user.id,
        openingFloat: float,
      });
      setShift(next);
      setConfirmOpen(false);
      setFloatValue("");
      notifyChanged();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : t("shift.openFailed");
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [user, cashierLabel, floatValue, notifyChanged, t, isOnline]);

  const onConfirmCloseShift = useCallback(async () => {
    if (!user?.tenantId) return;
    if (!isOnline) {
      setError(t("shift.closingOnlineRequired"));
      return;
    }
    const counted = parseFloat(countedValue);
    if (!Number.isFinite(counted) || counted < 0) return;
    setLoading(true);
    setError(null);
    try {
      const result = await shiftStore.close(
        user.tenantId,
        user.storeId ?? null,
        counted,
      );
      setShift(null);
      setConfirmClose(false);
      setCloseResult(result);
      setCountedValue("");
      notifyChanged();
      // Auto-clear close result after 4 seconds
      setTimeout(() => setCloseResult(null), 4000);
      queueMicrotask(() => panelRef.current?.focus());
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : t("shift.closeFailed");
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [user, countedValue, notifyChanged, t, isOnline]);

  const focusCta = (delta: number) => {
    const buttons = [openBtnRef.current, closeBtnRef.current].filter(
      (el): el is HTMLButtonElement => el != null,
    );
    if (buttons.length === 0) return;
    const active = document.activeElement;
    let idx = buttons.indexOf(active as HTMLButtonElement);
    if (idx < 0) idx = 0;
    const next = (idx + delta + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };

  const onKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
    if (confirmClose || confirmOpen) {
      // ConfirmDialog owns Esc / ←→ / Enter.
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      event.stopPropagation();
      focusCta(event.key === "ArrowRight" ? 1 : -1);
      return;
    }

    if (event.key === "Enter") {
      const active = document.activeElement;
      if (active === openBtnRef.current || active === closeBtnRef.current) {
        // Native button click handles it.
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (shift) setConfirmClose(true);
      else if (floatValue) setConfirmOpen(true);
    }
  };

  const openedLabel = shift ? formatShiftOpenedAt(shift.openedAt) : "";
  const durationLabel = shift
    ? formatShiftDuration(shift.openedAt, nowMs)
    : "";
  const floatNum = parseFloat(floatValue);
  const floatValid = Number.isFinite(floatNum) && floatNum >= 0;
  const countedNum = parseFloat(countedValue);
  const countedValid = Number.isFinite(countedNum) && countedNum >= 0;

  return (
    <div
      ref={panelRef}
      className="absolute inset-0 z-40 flex flex-col bg-surface"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      onKeyDownCapture={onKeyDownCapture}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Clock3
            className="size-5 shrink-0 text-primary"
            strokeWidth={1.75}
            aria-hidden
          />
          <div className="min-w-0">
            <h2
              id={titleId}
              className="truncate text-sm font-semibold text-foreground"
            >
              {t("shift.title")}
            </h2>
            <p className="truncate text-xs text-muted">{t("shift.subtitle")}</p>
          </div>
        </div>
        <button
          type="button"
          className="inline-flex size-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-shell hover:text-foreground"
          aria-label={t("shift.closePanel")}
          onClick={onClose}
        >
          <X className="size-4" strokeWidth={1.75} aria-hidden />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-md rounded-lg border border-border bg-shell/40 px-5 py-6 text-center shadow-sm">
          <Clock3
            className="mx-auto size-12 text-border"
            strokeWidth={1.25}
            aria-hidden
          />

          {closeResult ? (
            <>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-connected">
                {closeResult.status === "CLOSED"
                  ? t("shift.closeShiftBalanced")
                  : t("shift.closeShiftFlagged").replace(
                      "{variance}",
                      String(Math.abs(closeResult.variance)),
                    )}
              </p>
            </>
          ) : shift ? (
            <>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-connected">
                {t("shift.statusOpen")}
              </p>
              <h3 className="mt-2 text-lg font-semibold text-foreground">
                {t("shift.activeHeading")}
              </h3>
              <dl className="mt-5 space-y-2 text-left text-sm">
                <div className="flex items-baseline justify-between gap-3 border-b border-border/70 pb-2">
                  <dt className="text-muted">{t("shift.shiftNo")}</dt>
                  <dd className="font-mono text-xs font-medium text-foreground">
                    {shift.shiftNo}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 border-b border-border/70 pb-2">
                  <dt className="text-muted">{t("shift.openedAt")}</dt>
                  <dd className="font-mono text-xs font-medium text-foreground">
                    {openedLabel}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 border-b border-border/70 pb-2">
                  <dt className="text-muted">{t("shift.openedBy")}</dt>
                  <dd className="truncate font-medium text-foreground">
                    {shift.openedByName}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 border-b border-border/70 pb-2">
                  <dt className="text-muted">{t("shift.openingFloat")}</dt>
                  <dd className="font-medium tabular-nums text-foreground">
                    ৳{shift.openingFloat.toLocaleString()}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted">{t("shift.duration")}</dt>
                  <dd className="font-medium tabular-nums text-foreground">
                    {durationLabel}
                  </dd>
                </div>
              </dl>
              {error && (
                <p className="mt-3 text-xs text-destructive">{error}</p>
              )}
              <div className="mt-6 flex flex-col gap-3">
                <div>
                  <label
                    htmlFor="counted-cash"
                    className="mb-1 block text-left text-xs font-medium text-muted"
                  >
                    {t("shift.countedCash")}
                  </label>
                  <input
                    ref={countedInputRef}
                    id="counted-cash"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    placeholder={t("shift.countedCashPlaceholder")}
                    value={countedValue}
                    onChange={(e) => {
                      setCountedValue(e.target.value);
                      setError(null);
                    }}
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <button
                  ref={closeBtnRef}
                  type="button"
                  disabled={!countedValid || loading}
                  className="inline-flex items-center justify-center rounded-md border border-destructive/40 bg-surface px-5 py-2.5 text-sm font-semibold text-destructive shadow-sm transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => setConfirmClose(true)}
                >
                  {loading ? "…" : t("shift.closeShift")}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">
                {t("shift.statusClosed")}
              </p>
              <h3 className="mt-2 text-lg font-semibold text-foreground">
                {t("shift.closedHeading")}
              </h3>
              <p className="mt-2 text-sm text-muted">{t("shift.closedHint")}</p>
              {error && (
                <p className="mt-3 text-xs text-destructive">{error}</p>
              )}
              <div className="mt-6 flex flex-col gap-3">
                <div>
                  <label
                    htmlFor="opening-float"
                    className="mb-1 block text-left text-xs font-medium text-muted"
                  >
                    {t("shift.openingFloat")}
                  </label>
                  <input
                    ref={floatInputRef}
                    id="opening-float"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    placeholder={t("shift.openingFloatPlaceholder")}
                    value={floatValue}
                    onChange={(e) => {
                      setFloatValue(e.target.value);
                      setError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && floatValid && !loading) {
                        e.preventDefault();
                        setConfirmOpen(true);
                      }
                    }}
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <button
                  ref={openBtnRef}
                  type="button"
                  disabled={!floatValid || loading}
                  className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => setConfirmOpen(true)}
                >
                  {loading ? "…" : t("shift.openShift")}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <footer className="shrink-0 border-t border-border bg-shell/40 px-4 py-2 text-[11px] text-muted">
        {t("shift.footer")}
      </footer>

      {confirmOpen ? (
        <ConfirmDialog
          title={t("shift.openShiftConfirmTitle")}
          description={t("shift.openShiftConfirmBody")}
          confirmLabel={t("shift.openShift")}
          cancelLabel={t("shift.keepOpen")}
          onConfirm={onOpenShift}
          onCancel={() => {
            setConfirmOpen(false);
            queueMicrotask(() => openBtnRef.current?.focus());
          }}
        />
      ) : null}

      {confirmClose ? (
        <ConfirmDialog
          title={t("shift.closeConfirmTitle")}
          description={t("shift.closeConfirmBody")}
          warning={t("shift.closeConfirmWarn")}
          confirmLabel={t("shift.closeShift")}
          cancelLabel={t("shift.keepOpen")}
          destructive
          onConfirm={onConfirmCloseShift}
          onCancel={() => {
            setConfirmClose(false);
            queueMicrotask(() => closeBtnRef.current?.focus());
          }}
        />
      ) : null}
    </div>
  );
}
