/** Format amounts in Bangladeshi Taka (never $ / ₺). */
export function formatTaka(amount: number): string {
  return `৳${amount.toFixed(2)}`;
}
