import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  Ban,
  Check,
  Loader2,
  Smartphone,
  X,
} from "lucide-react";
import { useLocale, type MessageKey } from "@/i18n";
import {
  formatCustomerPhone,
  type SaleCustomer,
} from "@/lib/customerSearch";
import { formatTaka } from "@/lib/format";
import {
  getMfsProvider,
  isValidBdMobile,
  MFS_PROVIDERS,
  normalizeBdMobile,
  runMfsCollectStub,
  type MfsPaymentPhase,
  type MfsProviderId,
} from "@/lib/mfsPaymentStub";

function fill(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? "");
}

function mfsProviderDescKey(id: MfsProviderId): MessageKey {
  if (id === "BKASH") return "mfs.descBkash";
  if (id === "NAGAD") return "mfs.descNagad";
  return "mfs.descRocket";
}

/** Confirmed collect draft → parent ingests MFS + Sale Completed. */
export type MfsSettlementDraft = {
  providerId: MfsProviderId;
  providerLabel: string;
  payerMobile: string;
  /** Optional merchant / customer Trx ID reference. */
  trxId: string | null;
  amountPaid: number;
};

export type MfsPaymentModalProps = {
  amountDue: number;
  /** Null = walk-in — hide points; mobile prefill empty. */
  customer: SaleCustomer | null;
  /** True while parent runs MFS ingest after stub collect. */
  submitting?: boolean;
  /** Parent Hold (F6) aborts in-flight stub — do not ingest. */
  abortSignal?: AbortSignal;
  onBackToMethods: () => void;
  onClose: () => void;
  /**
   * Stub collected — parent ingests MFS + navigates to Sale Completed.
   * Resolves after ingest attempt; modal stays open on failure.
   */
  onCollected: (draft: MfsSettlementDraft) => void | Promise<void>;
};

/**
 * MFS Payment (Batch AD).
 * Shared: Provider Select (bKash / Nagad / Rocket).
 * Invented: Confirm / Collect, Processing, Fail (parallel Card Declined quality).
 * Success → onCollected (ingest MFS). ←→ nav · Tab never a POS navigator.
 * TODO(real MFS APIs) · TODO(replace invented confirm/result when Figma shared).
 */
export function MfsPaymentModal({
  amountDue,
  customer,
  submitting = false,
  abortSignal,
  onBackToMethods,
  onClose,
  onCollected,
}: MfsPaymentModalProps) {
  const { t } = useLocale();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const providerRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const backRef = useRef<HTMLButtonElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const mobileRef = useRef<HTMLInputElement>(null);
  const trxRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [phase, setPhase] = useState<MfsPaymentPhase>("provider_select");
  const [selectedProvider, setSelectedProvider] =
    useState<MfsProviderId>("BKASH");
  const [payerMobile, setPayerMobile] = useState(() =>
    normalizeBdMobile(customer?.phone ?? ""),
  );
  const [trxId, setTrxId] = useState("");

  const provider = getMfsProvider(selectedProvider);
  const mobileDigits = normalizeBdMobile(payerMobile);
  const mobileOk = isValidBdMobile(mobileDigits);
  const trxTrimmed = trxId.trim();

  const isBusy =
    phase === "processing" || phase === "completing" || submitting;
  const isFailed = phase === "failed";
  const isCompleting = phase === "completing" || submitting;
  const canConfirm = mobileOk && !isBusy;

  useEffect(() => {
    dialogRef.current?.focus();
    queueMicrotask(() => providerRefs.current[0]?.focus());
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

  const focusProvider = (index: number) => {
    const clamped = (index + MFS_PROVIDERS.length) % MFS_PROVIDERS.length;
    const next = MFS_PROVIDERS[clamped];
    if (!next) return;
    setSelectedProvider(next.id);
    providerRefs.current[clamped]?.focus();
  };

  const focusCtaRelative = (delta: number) => {
    const buttons = [backRef.current, primaryRef.current].filter(
      (b): b is HTMLButtonElement => b != null && !b.disabled,
    );
    if (buttons.length === 0) return;
    const active = document.activeElement;
    let idx = buttons.indexOf(active as HTMLButtonElement);
    if (idx < 0) idx = delta > 0 ? -1 : 0;
    const next = (idx + delta + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };

  const goConfirm = useCallback(() => {
    if (phase !== "provider_select") return;
    setPhase("confirm");
    queueMicrotask(() => {
      mobileRef.current?.focus();
      mobileRef.current?.select();
    });
  }, [phase]);

  const backToProviders = useCallback(() => {
    if (isBusy) return;
    setPhase("provider_select");
    queueMicrotask(() => {
      const idx = MFS_PROVIDERS.findIndex((p) => p.id === selectedProvider);
      providerRefs.current[idx < 0 ? 0 : idx]?.focus();
    });
  }, [isBusy, selectedProvider]);

  const confirmCollect = useCallback(async () => {
    if (phase !== "confirm" && phase !== "failed") return;
    if (!isValidBdMobile(normalizeBdMobile(payerMobile))) {
      queueMicrotask(() => mobileRef.current?.focus());
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setPhase("processing");

    try {
      const result = await runMfsCollectStub({ signal: ac.signal });
      if (ac.signal.aborted || abortSignal?.aborted) return;
      if (result === "collected") {
        setPhase("completing");
        const draft: MfsSettlementDraft = {
          providerId: selectedProvider,
          providerLabel: getMfsProvider(selectedProvider).label,
          payerMobile: normalizeBdMobile(payerMobile),
          trxId: trxId.trim() || null,
          amountPaid: amountDue,
        };
        try {
          await onCollected(draft);
          // Success → parent closes modal. Ingest failure → reset to confirm.
        } catch {
          setPhase("confirm");
          queueMicrotask(() => primaryRef.current?.focus());
        }
        return;
      }
      setPhase("failed");
      queueMicrotask(() => primaryRef.current?.focus());
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setPhase("failed");
      queueMicrotask(() => primaryRef.current?.focus());
    } finally {
      if (abortRef.current === ac) abortRef.current = null;
    }
  }, [
    phase,
    payerMobile,
    selectedProvider,
    trxId,
    amountDue,
    onCollected,
    abortSignal,
  ]);

  const retryCollect = useCallback(() => {
    if (phase !== "failed") return;
    setPhase("confirm");
    queueMicrotask(() => {
      mobileRef.current?.focus();
      mobileRef.current?.select();
    });
  }, [phase]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      if (isBusy) return;
      event.preventDefault();
      event.stopPropagation();
      if (phase === "provider_select") {
        onBackToMethods();
        return;
      }
      if (phase === "confirm" || phase === "failed") {
        backToProviders();
      }
      return;
    }

    if (phase === "provider_select") {
      const active = document.activeElement;
      const providerIdx = providerRefs.current.findIndex((el) => el === active);
      const onProvider = providerIdx >= 0;
      const onFooter =
        active === backRef.current || active === primaryRef.current;

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        event.stopPropagation();
        const delta = event.key === "ArrowLeft" ? -1 : 1;
        if (onFooter) {
          focusCtaRelative(delta);
          return;
        }
        const from = onProvider
          ? providerIdx
          : MFS_PROVIDERS.findIndex((p) => p.id === selectedProvider);
        focusProvider((from < 0 ? 0 : from) + delta);
        return;
      }

      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        event.stopPropagation();
        if (onFooter && event.key === "ArrowUp") {
          const from = MFS_PROVIDERS.findIndex(
            (p) => p.id === selectedProvider,
          );
          focusProvider(from < 0 ? 0 : from);
          return;
        }
        if (onProvider && event.key === "ArrowDown") {
          primaryRef.current?.focus();
        }
        return;
      }

      if (event.key === "Enter") {
        if (
          active instanceof HTMLButtonElement &&
          dialogRef.current?.contains(active)
        ) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        goConfirm();
      }
      return;
    }

    if (phase === "confirm") {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        const active = document.activeElement;
        if (
          active === mobileRef.current ||
          active === trxRef.current
        ) {
          // Allow caret move in inputs.
          return;
        }
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
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        if (canConfirm) void confirmCollect();
      }
      return;
    }

    if (phase === "failed") {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
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
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        retryCollect();
      }
    }
  };

  const phoneLabel = customer ? formatCustomerPhone(customer.phone) : null;
  const amountLabel = formatTaka(amountDue);
  const mobileDisplay = formatCustomerPhone(mobileDigits) || payerMobile;
  /** Brand strip after Continue — matches example color visibility. */
  const brandHeader = phase !== "provider_select";

  const headerTitle = isFailed
    ? fill(t("mfs.titleNotCompleted"), { provider: provider.label })
    : phase === "confirm"
      ? fill(t("mfs.titleConfirm"), { provider: provider.label })
      : phase === "processing" || isCompleting
        ? fill(t("mfs.titlePayment"), { provider: provider.label })
        : t("mfs.titleSelect");

  const shortcutHint =
    phase === "provider_select"
      ? { enter: t("mfs.continueHint"), esc: t("mfs.methodsHint") }
      : phase === "confirm"
        ? { enter: t("mfs.confirmHint"), esc: t("mfs.providersHint") }
        : phase === "failed"
          ? { enter: t("mfs.retryHint"), esc: t("mfs.providersHint") }
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
        <div
          className={[
            "relative px-5 py-4",
            brandHeader
              ? `${provider.accent.header} text-white`
              : "border-b border-border",
          ].join(" ")}
        >
          <button
            type="button"
            disabled={isBusy}
            onClick={onClose}
            className={[
              "absolute top-3.5 right-4 rounded-md p-1 focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60",
              brandHeader
                ? "text-white/85 hover:bg-white/15 hover:text-white focus-visible:ring-white/50"
                : "text-muted hover:bg-shell hover:text-foreground focus-visible:ring-primary/40",
            ].join(" ")}
            aria-label={t("pos.close")}
          >
            <X className="size-5" strokeWidth={1.75} />
          </button>
          <div className="flex items-start justify-between gap-3 pr-10">
            <div className="flex min-w-0 items-start gap-2.5">
              {brandHeader ? (
                <span
                  className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/20 text-white"
                  aria-hidden
                >
                  <Smartphone className="size-4" strokeWidth={2} />
                </span>
              ) : null}
              <div className="min-w-0">
                <h2
                  id={titleId}
                  className={[
                    "text-xl font-bold tracking-tight",
                    brandHeader ? "text-white" : "text-foreground",
                  ].join(" ")}
                >
                  {headerTitle}
                </h2>
                {brandHeader ? (
                  <p className="mt-0.5 text-xs font-medium text-white/85">
                    {isFailed
                      ? t("mfs.subtitleNotRecorded")
                      : phase === "confirm"
                        ? t("mfs.subtitleEnterMobile")
                        : isCompleting
                          ? t("mfs.subtitleSaving")
                          : t("mfs.subtitleWaiting")}
                  </p>
                ) : null}
              </div>
            </div>
            {!brandHeader ? (
              <span className="shrink-0 rounded-md border border-border bg-shell px-2 py-1 text-[10px] font-bold tracking-wide text-muted uppercase">
                {t("mfs.desktopInvented")}
              </span>
            ) : (
              <span className="shrink-0 rounded-md border border-white/30 bg-white/15 px-2 py-1 text-[10px] font-bold tracking-wide text-white uppercase">
                {provider.label}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div
              className={[
                "rounded-lg border px-3.5 py-3",
                provider.accent.amountBorder,
                provider.accent.amountBg,
              ].join(" ")}
            >
              <p className="text-[10px] font-bold tracking-wide text-muted uppercase">
                {t("payment.amountDue")}
              </p>
              <p
                className={[
                  "mt-1 text-2xl font-bold tabular-nums",
                  provider.accent.amountText,
                ].join(" ")}
              >
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

          {phase === "provider_select" ? (
            <div
              className="grid gap-3 sm:grid-cols-3"
              role="listbox"
              aria-label={t("mfs.providersAria")}
            >
              {MFS_PROVIDERS.map((p, index) => {
                const isSelected = selectedProvider === p.id;
                return (
                  <button
                    key={p.id}
                    ref={(el) => {
                      providerRefs.current[index] = el;
                    }}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => setSelectedProvider(p.id)}
                    onFocus={() => setSelectedProvider(p.id)}
                    className={[
                      "flex flex-col items-center gap-2 rounded-xl border-2 px-3 py-6 text-center transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                      isSelected
                        ? `${p.accent.border} ${p.accent.bg} shadow-sm`
                        : "border-border bg-surface hover:border-primary/40 hover:bg-shell/60",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "inline-flex size-12 items-center justify-center rounded-full",
                        isSelected ? p.accent.iconBg : "bg-shell text-muted",
                      ].join(" ")}
                      aria-hidden
                    >
                      <Smartphone className="size-6" strokeWidth={1.75} />
                    </span>
                    <span
                      className={[
                        "text-base font-bold",
                        isSelected ? p.accent.text : "text-foreground",
                      ].join(" ")}
                    >
                      {p.label}
                    </span>
                    <span className="text-xs text-muted">{t(mfsProviderDescKey(p.id))}</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {phase === "confirm" ? (
            <div
              className={[
                "space-y-3 rounded-xl border px-4 py-4",
                provider.accent.border,
                provider.accent.bg,
              ].join(" ")}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-muted">{t("mfs.provider")}</p>
                <span
                  className={[
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold",
                    provider.accent.border,
                    provider.accent.bg,
                    provider.accent.text,
                  ].join(" ")}
                >
                  <Smartphone className="size-3.5" strokeWidth={2} aria-hidden />
                  {provider.label}
                </span>
              </div>

              <label className="block">
                <span className="text-[10px] font-bold tracking-wide text-muted uppercase">
                  {t("mfs.payerMobile")}
                </span>
                <input
                  ref={mobileRef}
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  value={payerMobile}
                  onChange={(e) =>
                    setPayerMobile(normalizeBdMobile(e.target.value))
                  }
                  placeholder="01XXXXXXXXX"
                  className={[
                    "mt-1 w-full rounded-md border bg-surface px-3 py-2.5 text-sm font-semibold tabular-nums text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    mobileOk || payerMobile.length === 0
                      ? "border-border"
                      : "border-destructive/50",
                  ].join(" ")}
                  aria-invalid={payerMobile.length > 0 && !mobileOk}
                />
                <span className="mt-1 block text-xs text-muted">
                  {mobileOk
                    ? fill(t("mfs.willCollect"), {
                      amount: amountLabel,
                      provider: provider.label,
                      mobile: mobileDisplay,
                    })
                    : t("mfs.mobileHint")}
                </span>
              </label>

              <label className="block">
                <span className="text-[10px] font-bold tracking-wide text-muted uppercase">
                  {t("mfs.trxLabel")}{" "}
                  <span className="font-medium normal-case text-muted">
                    {t("mfs.trxOptional")}
                  </span>
                </span>
                <input
                  ref={trxRef}
                  type="text"
                  value={trxId}
                  onChange={(e) => setTrxId(e.target.value.slice(0, 40))}
                  placeholder={t("mfs.trxPlaceholder")}
                  className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                />
              </label>

              <p className="rounded-md border border-border bg-shell/70 px-3 py-2 text-xs text-muted">
                {fill(t("mfs.inventedNote"), { provider: provider.label })}
              </p>
            </div>
          ) : null}

          {phase === "processing" || isCompleting || isFailed ? (
            <div
              className={[
                "flex flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-8 text-center",
                isFailed
                  ? "border-destructive/35 bg-destructive/5"
                  : `${provider.accent.border} ${provider.accent.bg}`,
              ].join(" ")}
            >
              {phase === "processing" ? (
                <>
                  <span
                    className={[
                      "inline-flex size-14 items-center justify-center rounded-xl",
                      provider.accent.iconBg,
                    ].join(" ")}
                    aria-hidden
                  >
                    <Smartphone className="size-7" strokeWidth={1.5} />
                  </span>
                  <Loader2
                    className={[
                      "size-7 animate-spin",
                      provider.accent.spinner,
                    ].join(" ")}
                    strokeWidth={2}
                    aria-hidden
                  />
                  <div>
                    <p className="text-lg font-bold text-foreground">
                      {t("mfs.processing")}
                    </p>
                    <p
                      className={[
                        "mt-0.5 text-sm font-semibold",
                        provider.accent.text,
                      ].join(" ")}
                    >
                      {fill(t("mfs.waitingFor"), { provider: provider.label })}
                    </p>
                    <p className="mt-1.5 max-w-sm text-sm text-muted">
                      {fill(t("mfs.confirming"), { amount: amountLabel })}{" "}
                      <span className="font-semibold tabular-nums text-foreground">
                        {mobileDisplay}
                      </span>
                      {trxTrimmed ? (
                        <>
                          {" "}
                          · {t("mfs.trxShort")}{" "}
                          <span className="font-semibold text-foreground">
                            {trxTrimmed}
                          </span>
                        </>
                      ) : null}
                      .
                    </p>
                  </div>
                </>
              ) : null}

              {isCompleting ? (
                <>
                  <span
                    className={[
                      "inline-flex size-14 items-center justify-center rounded-xl",
                      provider.accent.iconBg,
                    ].join(" ")}
                    aria-hidden
                  >
                    <Check className="size-7" strokeWidth={2} />
                  </span>
                  <Loader2
                    className={[
                      "size-7 animate-spin",
                      provider.accent.spinner,
                    ].join(" ")}
                    strokeWidth={2}
                    aria-hidden
                  />
                  <div>
                    <p className="text-lg font-bold text-foreground">
                      {provider.label} {t("mfs.collectedSuffix")}
                    </p>
                    <p
                      className={[
                        "mt-0.5 text-sm font-semibold",
                        provider.accent.text,
                      ].join(" ")}
                    >
                      {t("mfs.completingSale")}
                    </p>
                    <p className="mt-1.5 max-w-sm text-sm text-muted">
                      {t("mfs.completingBody")}
                    </p>
                  </div>
                </>
              ) : null}

              {isFailed ? (
                <>
                  <span
                    className="inline-flex size-14 items-center justify-center rounded-xl bg-destructive/10 text-destructive"
                    aria-hidden
                  >
                    <Ban className="size-7" strokeWidth={1.75} />
                  </span>
                  <div>
                    <p className="text-lg font-bold text-destructive">
                      {fill(t("mfs.couldNotConfirm"), {
                        provider: provider.label,
                      })}
                    </p>
                    <p className="mt-1.5 max-w-sm text-sm text-muted">
                      {t("mfs.failedBody")}
                    </p>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}

          {phase === "provider_select" ? (
            <div className="flex flex-nowrap items-stretch justify-between gap-3">
              <button
                ref={backRef}
                type="button"
                onClick={onBackToMethods}
                className="inline-flex h-11 shrink-0 items-center justify-center rounded-md border border-foreground/80 bg-surface px-5 text-sm font-semibold text-nowrap whitespace-nowrap text-foreground hover:bg-shell focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                {t("mfs.backToMethods")}
              </button>
              <button
                ref={primaryRef}
                type="button"
                onClick={goConfirm}
                className={[
                  "inline-flex h-11 shrink-0 items-center justify-center rounded-md px-5 text-sm font-bold text-nowrap whitespace-nowrap text-white focus-visible:outline-none focus-visible:ring-2",
                  provider.accent.primaryBtn,
                ].join(" ")}
              >
                {t("mfs.continue")}
              </button>
            </div>
          ) : null}

          {phase === "confirm" ? (
            <div className="flex flex-nowrap items-stretch justify-between gap-3">
              <button
                ref={backRef}
                type="button"
                onClick={backToProviders}
                className="inline-flex h-11 shrink-0 items-center justify-center rounded-md border border-foreground/80 bg-surface px-5 text-sm font-semibold text-nowrap whitespace-nowrap text-foreground hover:bg-shell focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                {t("mfs.backToProviders")}
              </button>
              <button
                ref={primaryRef}
                type="button"
                disabled={!canConfirm}
                onClick={() => {
                  void confirmCollect();
                }}
                className={[
                  "inline-flex h-11 shrink-0 items-center justify-center rounded-md px-5 text-sm font-bold text-nowrap whitespace-nowrap text-white focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
                  provider.accent.primaryBtn,
                ].join(" ")}
              >
                {fill(t("mfs.confirmCta"), { provider: provider.label })}
              </button>
            </div>
          ) : null}

          {phase === "processing" || isCompleting ? (
            <div className="flex flex-nowrap items-stretch justify-between gap-3">
              <button
                ref={backRef}
                type="button"
                disabled
                className="inline-flex h-11 shrink-0 items-center justify-center rounded-md border border-foreground/80 bg-surface px-5 text-sm font-semibold text-nowrap whitespace-nowrap text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("mfs.backToProviders")}
              </button>
              <button
                ref={primaryRef}
                type="button"
                disabled
                className={[
                  "inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md px-5 text-sm font-bold text-nowrap whitespace-nowrap text-white opacity-90",
                  provider.accent.primaryBtn,
                ].join(" ")}
              >
                <Loader2 className="size-4 shrink-0 animate-spin" strokeWidth={2} />
                {isCompleting
                  ? t("mfs.completingSale")
                  : t("mfs.processingEllipsis")}
              </button>
            </div>
          ) : null}

          {phase === "failed" ? (
            <div className="flex flex-nowrap items-stretch justify-between gap-3">
              <button
                ref={backRef}
                type="button"
                onClick={backToProviders}
                className="inline-flex h-11 shrink-0 items-center justify-center rounded-md border border-foreground/80 bg-surface px-5 text-sm font-semibold text-nowrap whitespace-nowrap text-foreground hover:bg-shell focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                {t("mfs.backToProviders")}
              </button>
              <button
                ref={primaryRef}
                type="button"
                onClick={retryCollect}
                className={[
                  "inline-flex h-11 shrink-0 items-center justify-center rounded-md px-5 text-sm font-bold text-nowrap whitespace-nowrap text-white focus-visible:outline-none focus-visible:ring-2",
                  provider.accent.primaryBtn,
                ].join(" ")}
              >
                {fill(t("mfs.retryCta"), { provider: provider.label })}
              </button>
            </div>
          ) : null}
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
            <kbd className="font-medium text-foreground">[←→]</kbd>{" "}
            {t("mfs.navigate")}
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
