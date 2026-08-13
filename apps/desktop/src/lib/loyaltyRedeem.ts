/**
 * Loyalty redeem helpers (Batch S) + stub OTP verify.
 *
 * Locked rates (Slice 2):
 * - Redeem: 1 point = ৳1.00
 * - Eligibility: available points ≥ 50
 * - Cap: min(availablePoints, floor(saleTotalTaka))
 *
 * TODO(real integration):
 * - Send OTP via SMS/WhatsApp (n8n later)
 * - Server-side OTP verify + rate limit
 * - Persist earn/redeem on sale ingest (authoritative cloud mutation)
 * Do not ship this permissive OTP stub to pilot.
 */

/** Minimum points required before redeem UI offers redemption. */
export const LOYALTY_REDEEM_ELIGIBILITY_MIN = 50;

/** Stub OTP length — mock shows 6 boxes; any complete 6 digits accepted. */
export const STUB_LOYALTY_OTP_LENGTH = 6;

/** Cosmetic resend countdown seconds (no real send). */
export const LOYALTY_OTP_RESEND_SECONDS = 30;

/** Applied redeem after stub OTP verify — Batch T consumes for zero-pay complete. */
export type AppliedLoyaltyRedeem = {
  points: number;
  /** Taka discount (1:1 with points at locked rate). */
  taka: number;
  verifiedAt: string;
};

export type LoyaltyRedeemPreview = {
  availablePoints: number;
  saleTotalTaka: number;
  eligible: boolean;
  /** Points usable on this sale (capped). */
  usablePoints: number;
  usableTaka: number;
  remainingAfter: number;
  availableLoyaltyValueTaka: number;
};

/**
 * Preview redeem amounts for the Redeem Loyalty modal.
 * Sale total should be merchandise total before loyalty (subtotal − discount).
 */
export function previewLoyaltyRedeem(
  availablePoints: number,
  saleTotalTaka: number,
): LoyaltyRedeemPreview {
  const points = Math.max(0, Math.trunc(availablePoints));
  const sale = Math.max(0, saleTotalTaka);
  const eligible = points >= LOYALTY_REDEEM_ELIGIBILITY_MIN && sale > 0;
  const usablePoints = eligible
    ? Math.min(points, Math.floor(sale))
    : 0;
  return {
    availablePoints: points,
    saleTotalTaka: sale,
    eligible,
    usablePoints,
    usableTaka: usablePoints,
    remainingAfter: Math.max(0, points - usablePoints),
    availableLoyaltyValueTaka: points,
  };
}

export function isLoyaltyRedeemEligible(availablePoints: number): boolean {
  return Math.max(0, Math.trunc(availablePoints)) >= LOYALTY_REDEEM_ELIGIBILITY_MIN;
}

export function isStubLoyaltyOtpComplete(digits: string): boolean {
  return new RegExp(`^\\d{${STUB_LOYALTY_OTP_LENGTH}}$`).test(digits);
}

/**
 * Stub rule (Batch S): any complete 6-digit OTP is accepted.
 * Real rule later: server-verified SMS/WhatsApp OTP.
 */
export function acceptStubLoyaltyOtp(digits: string): boolean {
  return isStubLoyaltyOtpComplete(digits);
}

/** Mask phone for OTP banner — e.g. `01712 ••• 678`. */
export function maskCustomerPhoneForOtp(
  phone: string | null | undefined,
): string {
  if (!phone) return "•••• ••• •••";
  const digits = phone.replace(/\D/g, "");
  if (digits.length >= 8) {
    return `${digits.slice(0, 5)} ••• ${digits.slice(-3)}`;
  }
  if (digits.length >= 4) {
    return `${digits.slice(0, 2)} ••• ${digits.slice(-2)}`;
  }
  return "•••• ••• •••";
}

export function formatOtpResendCountdown(seconds: number): string {
  const s = Math.max(0, Math.trunc(seconds));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}
