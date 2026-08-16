/** Dummy CASH ৳0 row POS writes when loyalty fully covers the sale. */

export type TenderPayment = {
  method: string;
  amount: number;
};

export function isLoyaltyOnlyTender(args: {
  loyaltyUsed: number;
  payments: TenderPayment[];
}): boolean {
  if (!(args.loyaltyUsed > 0)) return false;
  if (args.payments.length === 0) return true;
  return !args.payments.some((p) => p.method !== "CASH" || p.amount > 0);
}
