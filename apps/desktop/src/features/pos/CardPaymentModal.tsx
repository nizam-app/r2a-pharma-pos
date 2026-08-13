import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  AlertCircle,
  Ban,
  CreditCard,
  Loader2,
  Nfc,
  X,
} from "lucide-react";
import { useLocale } from "@/i18n";
import {
  formatCustomerPhone,
  type SaleCustomer,
} from "@/lib/customerSearch";
import { formatTaka } from "@/lib/format";
import {
  runCardCancelStub,
  runCardTerminalStub,
  type CardPaymentPhase,
} from "@/lib/cardPaymentStub";

export type CardPaymentModalProps = {
  amountDue: number;
  /** Null = walk-in — hide points (name row still shows Walk-in). */
  customer: SaleCustomer | null;
  /** True while parent runs CARD ingest after stub approval. */
  submitting?: boolean;
  /** Parent Hold (F6) aborts in-flight stub — do not ingest. */
  abortSignal?: AbortSignal;
  onBackToMethods: () => void;
  onClose: () => void;
  /**
   * Stub approved — parent ingests CARD + navigates to Sale Completed.
   * Resolves after ingest attempt; modal stays open on failure.
   */
  onApproved: () => void | Promise<void>;
};

/**
 * Card Payment stub (Batch AB + AC).
 * States: Not Started → Processing → Declined | Cancelling → Declined | Completing → Sale Completed.
 * Success → onApproved (ingest CARD). Terminal-assisted only — TODO real SDK.
 * ←→ navigate · Tab never a POS navigator. Chrome = Search Results - Napa.
 */
export function CardPaymentModal({
  amountDue,
  customer,
  submitting = false,
  abortSignal,
  onBackToMethods,
  onClose,
  onApproved,
}: CardPaymentModalProps) {
  const { t } = useLocale();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [phase, setPhase] = useState<CardPaymentPhase>("not_started");

  const isBusy =
    phase === "processing" ||
    phase === "cancelling" ||
    phase === "completing" ||
    submitting;
  const isDeclined = phase === "declined";
  const isCompleting = phase === "completing" || submitting;

  useEffect(() => {
    dialogRef.current?.focus();
    queueMicrotask(() => primaryRef.current?.focus());
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!abortSignal) return;
    const onAbort = () => {
      abortRef.current?.abort();
    };
    if (abortSignal.aborted) {
      onAbort();
      return;
    }
    abortSignal.addEventListener("abort", onAbort);
    return () => abortSignal.removeEventListener("abort", onAbort);
  }, [abortSignal]);

  const focusCtaRelative = (delta: number) => {
    const buttons = [
      backRef.current,
      cancelRef.current,
      primaryRef.current,
    ].filter((b): b is HTMLButtonElement => b != null && !b.disabled);
    if (buttons.length === 0) return;
    const active = document.activeElement;
    let idx = buttons.indexOf(active as HTMLButtonElement);
    if (idx < 0) idx = delta > 0 ? -1 : 0;
    const next = (idx + delta + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };

  const startPayment = useCallback(async () => {
    if (phase !== "not_started" && phase !== "declined") return;

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setPhase("processing");

    try {
      const result = await runCardTerminalStub({ signal: ac.signal });
      if (ac.signal.aborted || abortSignal?.aborted) return;
      if (result === "approved") {
        setPhase("completing");
        try {
          await onApproved();
          // Success → parent closes modal. Ingest failure throws → retry Start.
        } catch {
          setPhase("not_started");
          queueMicrotask(() => primaryRef.current?.focus());
        }
        return;
      }
      setPhase("declined");
      queueMicrotask(() => primaryRef.current?.focus());
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setPhase("declined");
      queueMicrotask(() => primaryRef.current?.focus());
    } finally {
      if (abortRef.current === ac) abortRef.current = null;
    }
  }, [phase, onApproved, abortSignal]);

  const cancelPayment = useCallback(async () => {
    if (phase !== "processing") return;

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setPhase("cancelling");

    try {
      await runCardCancelStub({ signal: ac.signal });
      if (ac.signal.aborted || abortSignal?.aborted) return;
      setPhase("declined");
      queueMicrotask(() => primaryRef.current?.focus());
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setPhase("declined");
      queueMicrotask(() => primaryRef.current?.focus());
    } finally {
      if (abortRef.current === ac) abortRef.current = null;
    }
  }, [phase, abortSignal]);

  const retryPayment = useCallback(() => {
    if (phase !== "declined") return;
    setPhase("not_started");
    queueMicrotask(() => primaryRef.current?.focus());
  }, [phase]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      if (isBusy) return;
      event.preventDefault();
      event.stopPropagation();
      onBackToMethods();
      return;
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      if (isBusy && phase === "cancelling") return;
      event.preventDefault();
      event.stopPropagation();
      focusCtaRelative(event.key === "ArrowLeft" ? -1 : 1);
      return;
    }

    if (event.key === "Enter") {
      if (
        activeIsButtonInDialog(dialogRef.current) &&
        !(document.activeElement as HTMLButtonElement | null)?.disabled
      ) {
        // Native button activation.
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (phase === "not_started") {
        void startPayment();
        return;
      }
      if (phase === "declined") {
        retryPayment();
      }
    }
  };

  const phoneLabel = customer ? formatCustomerPhone(customer.phone) : null;
  const amountLabel = formatTaka(amountDue);

  const headerTitle = isDeclined
    ? t("card.notCompleted")
    : t("card.title");

  const shortcutHint =
    phase === "not_started"
      ? { enter: t("card.startHint"), esc: t("card.methodsHint") }
      : phase === "declined"
        ? { enter: t("card.retryHint"), esc: t("card.methodsHint") }
        : phase === "processing"
          ? { enter: t("card.activateFocused"), esc: null }
          : { enter: null, esc: null };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[1px]"
      role="presentation"
      onMouseDown={(e) => {
        if (isBusy) return;
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={isBusy}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="flex w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-xl outline-none"
      >
        <div className="relative border-b border-border px-5 py-4">
          <button
            type="button"
            disabled={isBusy}
            onClick={onClose}
            className="absolute top-3.5 right-4 rounded-md p-1 text-muted hover:bg-shell hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label={t("pos.close")}
          >
            <X className="size-5" strokeWidth={1.75} />
          </button>
          <div className="flex items-start justify-between gap-3 pr-10">
            <div className="flex min-w-0 items-start gap-2.5">
              {isDeclined ? (
                <span
                  className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive"
                  aria-hidden
                >
                  <AlertCircle className="size-4" strokeWidth={2} />
                </span>
              ) : null}
              <h2
                id={titleId}
                className="text-xl font-bold tracking-tight text-foreground"
              >
                {headerTitle}
              </h2>
            </div>
            <span className="shrink-0 rounded-md border border-border bg-shell px-2 py-1 text-[10px] font-bold tracking-wide text-muted uppercase">
              {t("card.terminalAssisted")}
            </span>
          </div>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-3.5 py-3">
              <p className="text-[10px] font-bold tracking-wide text-muted uppercase">
                {t("payment.amountDue")}
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-primary">
                {amountLabel}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-shell/60 px-3.5 py-3">
              <p className="text-[10px] font-bold tracking-wide text-muted uppercase">
                {t("card.customer")}
              </p>
              {customer ? (
                <div className="mt-1 min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">
                    {customer.name}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {phoneLabel ? (
                      <span className="tabular-nums">{phoneLabel}</span>
                    ) : null}
                    {phoneLabel ? (
                      <span className="mx-1.5" aria-hidden>
                        ·
                      </span>
                    ) : null}
                    <span className="font-semibold tabular-nums text-primary">
                      {customer.loyaltyPoints} {t("payment.pts")}
                    </span>
                  </p>
                </div>
              ) : (
                <p className="mt-1 text-sm font-semibold text-muted">
                  {t("cart.walkInCustomer")}
                </p>
              )}
            </div>
          </div>

          <div
            className={[
              "flex flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-8 text-center",
              isDeclined
                ? "border-destructive/35 bg-destructive/5"
                : "border-border bg-canvas",
            ].join(" ")}
          >
            {phase === "not_started" ? (
              <>
                <span
                  className="inline-flex size-14 items-center justify-center rounded-xl bg-shell text-muted"
                  aria-hidden
                >
                  <Nfc className="size-7" strokeWidth={1.5} />
                </span>
                <div>
                  <p className="text-lg font-bold text-foreground">
                    {t("card.notStarted")}
                  </p>
                  <p className="mt-1.5 max-w-sm text-sm text-muted">
                    {t("card.notStartedBodyPrefix")} {amountLabel}{" "}
                    {t("card.notStartedBodySuffix")}
                  </p>
                </div>
              </>
            ) : null}

            {phase === "processing" ? (
              <>
                <span
                  className="inline-flex size-14 items-center justify-center rounded-xl bg-shell text-muted"
                  aria-hidden
                >
                  <Nfc className="size-7" strokeWidth={1.5} />
                </span>
                <Loader2
                  className="size-7 animate-spin text-primary"
                  strokeWidth={2}
                  aria-hidden
                />
                <div>
                  <p className="text-lg font-bold text-foreground">
                    {t("card.processing")}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-primary">
                    {t("card.waitingTerminal")}
                  </p>
                  <p className="mt-1.5 max-w-sm text-sm text-muted">
                    {amountLabel} {t("card.processingBodyPrefix")}
                  </p>
                </div>
              </>
            ) : null}

            {isCompleting ? (
              <>
                <span
                  className="inline-flex size-14 items-center justify-center rounded-xl bg-primary/10 text-primary"
                  aria-hidden
                >
                  <CreditCard className="size-7" strokeWidth={1.5} />
                </span>
                <Loader2
                  className="size-7 animate-spin text-primary"
                  strokeWidth={2}
                  aria-hidden
                />
                <div>
                  <p className="text-lg font-bold text-foreground">
                    {t("card.approved")}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-primary">
                    {t("card.completingSale")}
                  </p>
                  <p className="mt-1.5 max-w-sm text-sm text-muted">
                    {t("card.completingBody")}
                  </p>
                </div>
              </>
            ) : null}

            {phase === "cancelling" ? (
              <>
                <span
                  className="inline-flex size-14 items-center justify-center rounded-xl bg-shell text-muted"
                  aria-hidden
                >
                  <CreditCard className="size-7" strokeWidth={1.5} />
                </span>
                <div>
                  <p className="inline-flex items-center gap-2 text-lg font-bold text-foreground">
                    {t("card.cancelling")}
                    <Loader2
                      className="size-5 animate-spin text-primary"
                      strokeWidth={2}
                      aria-hidden
                    />
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-primary">
                    {t("card.waitingTerminal")}
                  </p>
                  <p className="mt-1.5 max-w-sm text-sm text-muted">
                    {t("card.cancellingBody")}
                  </p>
                </div>
              </>
            ) : null}

            {phase === "declined" ? (
              <>
                <span
                  className="inline-flex size-14 items-center justify-center rounded-xl bg-destructive/10 text-destructive"
                  aria-hidden
                >
                  <Ban className="size-7" strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-lg font-bold text-destructive">
                    {t("card.declined")}
                  </p>
                  <p className="mt-1.5 max-w-sm text-sm text-muted">
                    {t("card.noPaymentRecorded")}
                  </p>
                </div>
              </>
            ) : null}
          </div>

          {phase === "processing" ? (
            <div className="flex flex-nowrap items-stretch justify-between gap-3">
              <button
                ref={backRef}
                type="button"
                disabled
                onClick={onBackToMethods}
                className="inline-flex h-11 shrink-0 items-center justify-center rounded-md border border-foreground/80 bg-surface px-5 text-sm font-semibold text-nowrap whitespace-nowrap text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("card.backToMethods")}
              </button>
              <button
                ref={cancelRef}
                type="button"
                onClick={() => {
                  void cancelPayment();
                }}
                className="inline-flex h-11 shrink-0 items-center justify-center rounded-md border border-destructive/40 bg-destructive/5 px-5 text-sm font-semibold text-nowrap whitespace-nowrap text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/30"
              >
                {t("card.cancel")}
              </button>
              <button
                ref={primaryRef}
                type="button"
                disabled
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-primary/70 px-5 text-sm font-bold text-nowrap whitespace-nowrap text-primary-foreground opacity-80"
              >
                <Loader2 className="size-4 shrink-0 animate-spin" strokeWidth={2} />
                {t("card.processingEllipsis")}
              </button>
            </div>
          ) : isCompleting ? (
            <div className="flex flex-nowrap items-stretch justify-between gap-3">
              <button
                ref={backRef}
                type="button"
                disabled
                onClick={onBackToMethods}
                className="inline-flex h-11 shrink-0 items-center justify-center rounded-md border border-foreground/80 bg-surface px-5 text-sm font-semibold text-nowrap whitespace-nowrap text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("card.backToMethods")}
              </button>
              <button
                ref={primaryRef}
                type="button"
                disabled
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-bold text-nowrap whitespace-nowrap text-primary-foreground opacity-90"
              >
                <Loader2 className="size-4 shrink-0 animate-spin" strokeWidth={2} />
                {t("card.completingSale")}
              </button>
            </div>
          ) : phase === "cancelling" ? (
            <div className="flex flex-nowrap items-stretch justify-between gap-3">
              <button
                ref={backRef}
                type="button"
                disabled
                onClick={onBackToMethods}
                className="inline-flex h-11 shrink-0 items-center justify-center rounded-md border border-foreground/80 bg-surface px-5 text-sm font-semibold text-nowrap whitespace-nowrap text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("card.backToMethods")}
              </button>
              <button
                ref={primaryRef}
                type="button"
                disabled
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-bold text-nowrap whitespace-nowrap text-primary-foreground opacity-90"
              >
                <Loader2 className="size-4 shrink-0 animate-spin" strokeWidth={2} />
                {t("card.cancellingEllipsis")}
              </button>
            </div>
          ) : (
            <div className="flex flex-nowrap items-stretch justify-between gap-3">
              <button
                ref={backRef}
                type="button"
                onClick={onBackToMethods}
                className="inline-flex h-11 shrink-0 items-center justify-center rounded-md border border-foreground/80 bg-surface px-5 text-sm font-semibold text-nowrap whitespace-nowrap text-foreground hover:bg-shell focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                {t("card.backToMethods")}
              </button>
              {phase === "not_started" ? (
                <button
                  ref={primaryRef}
                  type="button"
                  onClick={() => {
                    void startPayment();
                  }}
                  className="inline-flex h-11 shrink-0 items-center justify-center rounded-md bg-primary px-5 text-sm font-bold text-nowrap whitespace-nowrap text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  {t("card.start")}
                </button>
              ) : (
                <button
                  ref={primaryRef}
                  type="button"
                  onClick={retryPayment}
                  className="inline-flex h-11 shrink-0 items-center justify-center rounded-md bg-primary px-5 text-sm font-bold text-nowrap whitespace-nowrap text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  {t("card.retry")}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-border bg-shell px-5 py-2.5 text-xs text-muted">
          {shortcutHint.enter ? (
            <>
              <span>
                <kbd className="font-medium text-foreground">[Enter]</kbd>{" "}
                {shortcutHint.enter}
              </span>
              <span
                className="text-sm font-semibold text-foreground/55"
                aria-hidden
              >
                ›
              </span>
            </>
          ) : null}
          {shortcutHint.esc ? (
            <>
              <span>
                <kbd className="font-medium text-foreground">[Esc]</kbd>{" "}
                {shortcutHint.esc}
              </span>
              <span
                className="text-sm font-semibold text-foreground/55"
                aria-hidden
              >
                ›
              </span>
            </>
          ) : null}
          <span>
            <kbd className="font-medium text-foreground">[←→]</kbd>{" "}{t("card.navigate")}
          </span>
        </div>
      </div>
    </div>
  );
}

function activeIsButtonInDialog(dialog: HTMLDivElement | null): boolean {
  const active = document.activeElement;
  return (
    active instanceof HTMLButtonElement &&
    dialog != null &&
    dialog.contains(active)
  );
}
