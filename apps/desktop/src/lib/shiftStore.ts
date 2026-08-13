/**
 * Local cashier shift window (M3 Batch AL).
 *
 * Choice: webview `localStorage` (same family as pharmacyHeader / transactionLog).
 * Key: pharmasync.shift.<tenantId>.<storeId|none>
 *
 * Open/close is terminal-local only. Counter Ready “Active Shift” reads this.
 * Soft gate: New Sale [F2] requires an open shift (App.startNewSale); badge stays
 * about connectivity (not tied to shift).
 * TODO(cloud): invent shift open/close API only when authorized — none in Slice 5.
 */

export type ActiveShift = {
  /** ISO timestamp when the shift was opened. */
  openedAt: string;
  /** Display name of cashier/owner who opened (runtime name — not translated). */
  openedByName: string;
  /** Optional user id for audit (not shown unless useful). */
  openedByUserId?: string;
};

const PREFIX = "pharmasync.shift";

function storageKey(tenantId: string, storeId: string | null): string {
  const storePart = storeId?.trim() || "none";
  return `${PREFIX}.${tenantId}.${storePart}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function parseActive(raw: string | null): ActiveShift | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (!o || typeof o !== "object") return null;
    const openedAt = typeof o.openedAt === "string" ? o.openedAt.trim() : "";
    const openedByName =
      typeof o.openedByName === "string" ? o.openedByName.trim() : "";
    if (!openedAt || Number.isNaN(new Date(openedAt).getTime())) return null;
    if (!openedByName) return null;
    const openedByUserId =
      typeof o.openedByUserId === "string" && o.openedByUserId.trim()
        ? o.openedByUserId.trim()
        : undefined;
    return { openedAt, openedByName, openedByUserId };
  } catch {
    return null;
  }
}

/** HH:MM · YYYY-MM-DD — Latin digits only. */
export function formatShiftOpenedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())} · ${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Compact clock for Counter Ready card (HH:MM). */
export function formatShiftClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Elapsed since open — e.g. "2h 15m" (Latin digits). */
export function formatShiftDuration(
  openedAtIso: string,
  nowMs: number = Date.now(),
): string {
  const opened = new Date(openedAtIso).getTime();
  if (Number.isNaN(opened)) return "—";
  const elapsedMin = Math.max(0, Math.floor((nowMs - opened) / 60_000));
  const hours = Math.floor(elapsedMin / 60);
  const minutes = elapsedMin % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

export const shiftStore = {
  get(tenantId: string, storeId: string | null): ActiveShift | null {
    if (!tenantId) return null;
    try {
      return parseActive(localStorage.getItem(storageKey(tenantId, storeId)));
    } catch {
      return null;
    }
  },

  open(
    tenantId: string,
    storeId: string | null,
    args: { openedByName: string; openedByUserId?: string },
  ): ActiveShift | null {
    if (!tenantId) return null;
    const name = args.openedByName.trim();
    if (!name) return null;
    const shift: ActiveShift = {
      openedAt: new Date().toISOString(),
      openedByName: name,
      openedByUserId: args.openedByUserId?.trim() || undefined,
    };
    try {
      localStorage.setItem(storageKey(tenantId, storeId), JSON.stringify(shift));
    } catch {
      /* ignore quota / private mode */
    }
    return shift;
  },

  close(tenantId: string, storeId: string | null): void {
    if (!tenantId) return;
    try {
      localStorage.removeItem(storageKey(tenantId, storeId));
    } catch {
      /* ignore */
    }
  },
};
