import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { CheckCircle2, RefreshCw, ShieldCheck, X } from "lucide-react";
import { useLocale } from "@/i18n";
import type { SaleCustomer } from "@/lib/customerSearch";
import { formatTaka } from "@/lib/format";
import {
  LOYALTY_OTP_RESEND_SECONDS,
  STUB_LOYALTY_OTP_LENGTH,
  acceptStubLoyaltyOtp,
  formatOtpResendCountdown,
  isStubLoyaltyOtpComplete,
  maskCustomerPhoneForOtp,
  type AppliedLoyaltyRedeem,
} from "@/lib/loyaltyRedeem";

export type VerifyLoyaltyOtpModalProps = {
  customer: SaleCustomer;
  redeemPoints: number;
  saleTotalTaka: number;
  /** Back to Redeem Loyalty modal. */
  onCancelRedemption: () => void;
  onClose: () => void;
  /** Stub OTP accepted — App applies loyalty for Batch T. */
  onVerified: (applied: AppliedLoyaltyRedeem) => void;
};

/**
 * Verify Loyalty Redemption OTP (Batch S).
 * Stub: any 6-digit OTP succeeds. Resend timer is cosmetic only.
 *
 * TODO(real integration): send SMS/WhatsApp OTP, server verify, rate limit.
 */
export function VerifyLoyaltyOtpModal({
  customer,
  redeemPoints,
  saleTotalTaka,
  onCancelRedemption,
  onClose,
  onVerified,
}: VerifyLoyaltyOtpModalProps) {
  const { t } = useLocale();
  const titleId = useId();
  const otpGroupId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const verifyRef = useRef<HTMLButtonElement>(null);

  const points = Math.max(0, Math.trunc(redeemPoints));
  const discountTaka = points;
  const pointsAfter = Math.max(0, customer.loyaltyPoints - points);
  const maskedPhone = maskCustomerPhoneForOtp(customer.phone);

  const [otpDigits, setOtpDigits] = useState<string[]>(() =>
    Array.from({ length: STUB_LOYALTY_OTP_LENGTH }, () => ""),
  );
  const [otpError, setOtpError] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(LOYALTY_OTP_RESEND_SECONDS);

  const otpValue = otpDigits.join("");
  const otpComplete = isStubLoyaltyOtpComplete(otpValue);
  const canResend = resendSeconds <= 0;

  useEffect(() => {
    dialogRef.current?.focus();
    queueMicrotask(() => otpRefs.current[0]?.focus());
  }, []);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const id = window.setInterval(() => {
      setResendSeconds((s) => Math.max(0, s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [resendSeconds]);

  const setDigitAt = useCallback((index: number, raw: string) => {
    const digit = raw.replace(/\D/g, "").slice(-1);
    setOtpError(false);
    setOtpDigits((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (digit && index < STUB_LOYALTY_OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  }, []);

  const clearOtpFrom = useCallback((index: number) => {
    setOtpDigits((prev) => {
      const next = [...prev];
      for (let i = index; i < STUB_LOYALTY_OTP_LENGTH; i++) next[i] = "";
      return next;
    });
  }, []);

  const verify = useCallback(() => {
    if (!acceptStubLoyaltyOtp(otpValue)) {
      setOtpError(true);
      otpRefs.current[0]?.focus();
      return;
    }
    // Stub accept — no server call. Never persist the OTP.
    onVerified({
      points,
      taka: discountTaka,
      verifiedAt: new Date().toISOString(),
    });
  }, [otpValue, onVerified, points, discountTaka]);

  const onResend = useCallback(() => {
    if (!canResend) return;
    // Cosmetic only — no real SMS/OTP send.
    setOtpDigits(Array.from({ length: STUB_LOYALTY_OTP_LENGTH }, () => ""));
    setOtpError(false);
    setResendSeconds(LOYALTY_OTP_RESEND_SECONDS);
    queueMicrotask(() => otpRefs.current[0]?.focus());
  }, [canResend]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onCancelRedemption();
      return;
    }

    if (
      event.key === "ArrowLeft" ||
      event.key === "ArrowUp" ||
      event.key === "ArrowRight" ||
      event.key === "ArrowDown"
    ) {
      const active = document.activeElement;
      const otpIndex = otpRefs.current.findIndex((el) => el === active);
      const back =
        event.key === "ArrowLeft" || event.key === "ArrowUp";

      // OTP boxes: ←→ move between digits.
      if (otpIndex >= 0) {
        event.preventDefault();
        event.stopPropagation();
        const next = Math.min(
          STUB_LOYALTY_OTP_LENGTH - 1,
          Math.max(0, otpIndex + (back ? -1 : 1)),
        );
        otpRefs.current[next]?.focus();
        return;
      }

      // Footer CTAs: ←→ switch Cancel / Verify.
      const buttons = [cancelRef.current, verifyRef.current].filter(
        (b): b is HTMLButtonElement => b != null && !b.disabled,
      );
      if (buttons.length >= 2) {
        event.preventDefault();
        event.stopPropagation();
        let idx = buttons.indexOf(active as HTMLButtonElement);
        if (idx < 0) idx = buttons.length - 1;
        const next = (idx + (back ? -1 : 1) + buttons.length) % buttons.length;
        buttons[next]?.focus();
      }
      return;
    }

    if (event.key === "Enter") {
      if (!otpComplete) return;
      event.preventDefault();
      event.stopPropagation();
      verify();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
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
        <div className="relative border-b border-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3.5 right-4 rounded-md p-1 text-muted hover:bg-shell hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label={t("pos.close")}
          >
            <X className="size-5" strokeWidth={1.75} />
          </button>
          <h2
            id={titleId}
            className="pr-8 text-xl font-bold tracking-tight text-foreground"
          >
            {t("otp.verifyTitle")}
          </h2>
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-connected">
            <CheckCircle2 className="size-4" strokeWidth={2} aria-hidden />
            {t("otp.codeSent")}
          </p>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm text-foreground">
            {t("otp.sentBodyPrefix")}{" "}
            <span className="font-bold tabular-nums">{maskedPhone}</span>
            {/* TODO(real integration): actually send OTP via SMS/WhatsApp. */}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border border-border bg-canvas px-3 py-2.5">
              <p className="text-[10px] font-bold tracking-wide text-muted uppercase">
                {t("otp.customer")}
              </p>
              <p className="mt-1 text-sm font-bold text-foreground">
                {customer.name}
              </p>
            </div>
            <div className="rounded-md border border-border bg-canvas px-3 py-2.5">
              <p className="text-[10px] font-bold tracking-wide text-muted uppercase">
                {t("otp.redeeming")}
              </p>
              <p className="mt-1 text-sm font-bold tabular-nums text-primary">
                {points} {t("loyalty.points")}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 divide-x divide-border rounded-md border border-border bg-canvas text-center text-sm">
            <div className="px-2 py-2.5">
              <p className="text-[10px] font-bold tracking-wide text-muted uppercase">
                {t("otp.loyaltyDiscount")}
              </p>
              <p className="mt-1 font-bold tabular-nums text-foreground">
                {formatTaka(discountTaka)}
              </p>
            </div>
            <div className="px-2 py-2.5">
              <p className="text-[10px] font-bold tracking-wide text-muted uppercase">
                {t("otp.pointsAfter")}
              </p>
              <p className="mt-1 font-bold tabular-nums text-foreground">
                {pointsAfter} {t("loyalty.points")}
              </p>
            </div>
            <div className="px-2 py-2.5">
              <p className="text-[10px] font-bold tracking-wide text-muted uppercase">
                {t("otp.currentSale")}
              </p>
              <p className="mt-1 font-bold tabular-nums text-foreground">
                {formatTaka(saleTotalTaka)}
              </p>
            </div>
          </div>

          <div>
            <div
              id={otpGroupId}
              className="flex items-center justify-center gap-2"
              role="group"
              aria-label={t("otp.groupAria")}
            >
              {otpDigits.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    otpRefs.current[index] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={1}
                  value={digit}
                  aria-label={`${t("otp.digitAria")} ${index + 1}`}
                  onChange={(e) => setDigitAt(index, e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Backspace" &&
                      !otpDigits[index] &&
                      index > 0
                    ) {
                      e.preventDefault();
                      clearOtpFrom(index - 1);
                      otpRefs.current[index - 1]?.focus();
                    }
                  }}
                  onPaste={(e) => {
                    e.preventDefault();
                    const pasted = e.clipboardData
                      .getData("text")
                      .replace(/\D/g, "")
                      .slice(0, STUB_LOYALTY_OTP_LENGTH);
                    if (!pasted) return;
                    setOtpError(false);
                    setOtpDigits((prev) => {
                      const next = [...prev];
                      for (let i = 0; i < STUB_LOYALTY_OTP_LENGTH; i++) {
                        next[i] = pasted[i] ?? "";
                      }
                      return next;
                    });
                    const focusAt = Math.min(
                      pasted.length,
                      STUB_LOYALTY_OTP_LENGTH - 1,
                    );
                    otpRefs.current[focusAt]?.focus();
                  }}
                  className="size-11 rounded-md border border-border bg-surface text-center text-lg font-bold text-foreground tabular-nums shadow-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
                />
              ))}
            </div>
            {otpError ? (
              <p
                className="mt-2 text-center text-xs text-destructive"
                role="alert"
              >
                {t("otp.enterDigits")}
              </p>
            ) : (
              <p className="mt-2 text-center text-[11px] text-muted">
                {t("otp.stubHint")}
              </p>
            )}

            <div className="mt-3 flex justify-center">
              {canResend ? (
                <button
                  type="button"
                  onClick={onResend}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <RefreshCw className="size-3.5" strokeWidth={2} aria-hidden />
                  {t("otp.resend")}
                </button>
              ) : (
                <p className="inline-flex items-center gap-1.5 text-sm text-muted">
                  <RefreshCw
                    className="size-3.5"
                    strokeWidth={2}
                    aria-hidden
                  />
                  {t("otp.resendIn")} {formatOtpResendCountdown(resendSeconds)}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3 border-t border-border px-5 py-4">
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold tracking-wide text-muted uppercase">
            <span>
              <kbd className="rounded bg-shell px-1.5 py-0.5 text-foreground">
                Enter
              </kbd>{" "}
              {t("otp.verify")}
            </span>
            <span>
              <kbd className="rounded bg-shell px-1.5 py-0.5 text-foreground">
                Esc
              </kbd>{" "}
              {t("footer.cancel")}
            </span>
            <span>
              <kbd className="rounded bg-shell px-1.5 py-0.5 text-foreground">
                ←→
              </kbd>{" "}
              {t("otp.navigate")}
            </span>
          </p>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-stretch">
            <button
              ref={cancelRef}
              type="button"
              onClick={onCancelRedemption}
              className="flex flex-1 items-center justify-center rounded-md border border-border bg-surface px-3 py-2.5 text-sm font-bold tracking-wide text-foreground uppercase hover:bg-shell focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {t("otp.cancelRedemption")}
            </button>
            <button
              ref={verifyRef}
              type="button"
              onClick={verify}
              disabled={!otpComplete}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-3 py-2.5 text-sm font-bold tracking-wide text-primary-foreground uppercase hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ShieldCheck className="size-4" strokeWidth={2} aria-hidden />
              {t("otp.verifyAndRedeem")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
