/** Format amounts in Bangladeshi Taka. Latin digits only. Never dollar or lira signs. */
export function formatTaka(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  const whole = Number.isInteger(rounded);
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(rounded);
  return `৳${formatted}`;
}

/** Counts and percents — Latin digits, en-US grouping. */
export function formatCount(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
    Math.round(n),
  );
}

export function formatPct(n: number): string {
  const abs = Math.abs(n);
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: Number.isInteger(abs) ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(abs);
  return formatted;
}

/** 12-hour clock with Latin digits (UI locale does not change digits). */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/** Latin-digit date + time, e.g. 16 Aug 2026, 2:42 PM. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const date = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
  return `${date}, ${formatTime(iso)}`;
}

/** Compact sales-table datetime, e.g. Aug 14, 2:42 PM. Latin digits. */
export function formatSalesDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const nowYear = new Date().getFullYear();
  const date = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(d.getFullYear() !== nowYear ? { year: "numeric" } : {}),
  }).format(d);
  return `${date}, ${formatTime(iso)}`;
}

/** Detail header date, e.g. Aug 14, 2026. Latin digits. Pair with `at` + formatTime. */
export function formatDetailDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

/** Compact expiry, e.g. Oct 2026. Latin digits. UTC date. */
export function formatExpiryShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

/** Batch expiry as MM/YYYY. Latin digits. */
export function formatExpiryMonthYear(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${month}/${d.getUTCFullYear()}`;
}

/** UTC date-only value (e.g. PO expected delivery), e.g. 20 Aug 2026. */
export function formatUtcDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

/** Initials from a person name (customer / cashier). */
export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0];
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : parts[0]?.[1];
  const letters = `${first ?? ""}${last ?? ""}`.toUpperCase();
  return letters || "?";
}

export function utcYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function utcTodayStart(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

/** Chart Y-axis ticks — Latin digits, k suffix when >= 1000. */
export function formatAxisK(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    const s = Number.isInteger(k)
      ? String(k)
      : new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(k);
    return `${s}k`;
  }
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

/** Nice upper bound for chart scale. */
export function niceMax(n: number): number {
  if (n <= 0) return 1000;
  const pad = n * 1.15;
  const mag = 10 ** Math.floor(Math.log10(pad));
  const norm = pad / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return nice * mag;
}
