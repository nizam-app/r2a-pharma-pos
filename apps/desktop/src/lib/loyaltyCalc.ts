/**
 * Shared loyalty calculator (Batch T) — redeem + earn on every completed sale.
 * Reuse for Cash/Card/MFS tender in Slice 3 (same rules).
 *
 * Locked rates (Slice 2):
 * - Redeem: 1 point = ৳1.00
 * - Eligibility: available points ≥ 50 (redeem UI gate)
 * - Cap: min(availablePoints, floor(saleTotalTaka))
 * - Earn: 1 pt per ৳100 merchandise after discounts
 *   → floor(netPayableBeforeLoyaltyRedeem / 100)
 * - Full loyalty cover (amount due ৳0): earned = 0
 *
 * Cloud ingest (M6 Batch D) snapshots `loyaltyUsed` / `loyaltyEarned`.
 * This helper remains the POS session calculator.
 */

import {
  LOYALTY_REDEEM_ELIGIBILITY_MIN,
  previewLoyaltyRedeem,
  type AppliedLoyaltyRedeem,
} from "@/lib/loyaltyRedeem";

export { LOYALTY_REDEEM_ELIGIBILITY_MIN, previewLoyaltyRedeem };

/** Earn rate: 1 loyalty point per this many taka of merchandise. */
export const LOYALTY_EARN_TAKA_PER_POINT = 100;

export type LoyaltySettlementInput = {
  /** Customer points before this sale's redeem. */
  previousBalance: number;
  /** Points redeemed on this sale (0 if none). */
  redeemedPoints: number;
  /**
   * Merchandise net before loyalty redeem (subtotal − cart discount).
   * Used for earn base when amount due &gt; 0.
   */
  netPayableBeforeLoyaltyRedeem: number;
  /** Amount still due after loyalty (৳). Full cover → earned = 0. */
  amountDue: number;
};

export type LoyaltySettlement = {
  previousBalance: number;
  earned: number;
  used: number;
  currentBalance: number;
  /** True when amount due is ৳0 after redeem. */
  fullyCoveredByLoyalty: boolean;
};

/**
 * Calculate loyalty redeem + earn for Sale Completed (and later tender).
 */
export function calculateLoyaltySettlement(
  input: LoyaltySettlementInput,
): LoyaltySettlement {
  const previousBalance = Math.max(0, Math.trunc(input.previousBalance));
  const used = Math.max(0, Math.trunc(input.redeemedPoints));
  const merchandise = Math.max(0, input.netPayableBeforeLoyaltyRedeem);
  const amountDue = Math.max(0, input.amountDue);
  const fullyCoveredByLoyalty = amountDue <= 0 && used > 0;

  // Full loyalty cover → earn 0 (Sale Completed mock). Otherwise floor(merchandise/100).
  const earned = fullyCoveredByLoyalty
    ? 0
    : Math.floor(merchandise / LOYALTY_EARN_TAKA_PER_POINT);

  const currentBalance = Math.max(0, previousBalance - used + earned);

  return {
    previousBalance,
    earned,
    used,
    currentBalance,
    fullyCoveredByLoyalty,
  };
}

/** Build settlement from cart + applied redeem (Batch T zero-pay path). */
export function settleLoyaltyForSale(args: {
  previousBalance: number;
  applied: AppliedLoyaltyRedeem | null;
  cartSubtotal: number;
  cartDiscount?: number;
}): LoyaltySettlement {
  const cartDiscount = Math.max(0, args.cartDiscount ?? 0);
  const netBeforeLoyalty = Math.max(0, args.cartSubtotal - cartDiscount);
  const redeemedPoints = args.applied?.points ?? 0;
  const loyaltyTaka = args.applied?.taka ?? 0;
  const amountDue = Math.max(0, netBeforeLoyalty - loyaltyTaka);

  return calculateLoyaltySettlement({
    previousBalance: args.previousBalance,
    redeemedPoints,
    netPayableBeforeLoyaltyRedeem: netBeforeLoyalty,
    amountDue,
  });
}
