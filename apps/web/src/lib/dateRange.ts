import { utcTodayStart, utcYmd } from "./format";

export type SalesDatePreset =
  | "today"
  | "yesterday"
  | "last7"
  | "thisMonth"
  | "custom";

export const SALES_DATE_PRESETS: readonly SalesDatePreset[] = [
  "today",
  "yesterday",
  "last7",
  "thisMonth",
  "custom",
] as const;

export function rangeForSalesPreset(
  preset: SalesDatePreset,
  customFrom?: string,
  customTo?: string,
): { from: string; to: string } {
  const today = utcTodayStart();
  if (preset === "today") {
    const ymd = utcYmd(today);
    return { from: ymd, to: ymd };
  }
  if (preset === "yesterday") {
    const y = new Date(today);
    y.setUTCDate(y.getUTCDate() - 1);
    const ymd = utcYmd(y);
    return { from: ymd, to: ymd };
  }
  if (preset === "thisMonth") {
    const from = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
    );
    return { from: utcYmd(from), to: utcYmd(today) };
  }
  if (preset === "custom") {
    const from = customFrom?.trim() || utcYmd(addUtcDays(today, -6));
    const to = customTo?.trim() || utcYmd(today);
    return from <= to ? { from, to } : { from: to, to: from };
  }
  const from = addUtcDays(today, -6);
  return { from: utcYmd(from), to: utcYmd(today) };
}

function addUtcDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + n);
  return next;
}
