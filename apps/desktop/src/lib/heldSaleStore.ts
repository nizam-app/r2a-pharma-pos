/**
 * Local held / parked sales (M3 Batch AM).
 *
 * Soft hold only: snapshots cart lines + customer + loyalty for this terminal.
 * Does NOT reserve stock. Resume re-validates qty/expiry (`heldSaleRecheck`).
 * Hold F6 + Held list UI: Batch AN (`HeldSalesPanel`).
 * FEFO override metadata travels on each `CartLine.fefoOverride` (no separate field).
 *
 * Choice: webview `localStorage` (same family as shift / transactionLog).
 * Key: pharmasync.heldSales.<tenantId>.<storeId|none>
 * Cap: 3 held snapshots. A 4th add is refused (no overwrite).
 *
 * Machine-local only — not shared across terminals.
 * Snapshot does not include cash-received / card / MFS tender drafts.
 * TODO(cloud): no cloud hold / multi-terminal shared holds until authorized.
 * Do not invent a hold API in this slice.
 */

import type { CartLine, CartLineFefoOverride } from "@/features/pos/cartTypes";
import type { PackagingUnitType } from "@/lib/qtyPackaging";
import type { SaleCustomer } from "@/lib/customerSearch";
import type { AppliedLoyaltyRedeem } from "@/lib/loyaltyRedeem";

export const MAX_HELD_SALES = 3;

const PREFIX = "pharmasync.heldSales";

export type HeldSaleSnapshot = {
  id: string;
  /** ISO timestamp when the sale was parked. */
  heldAt: string;
  /** List label — customer name, first product, or held-at clock (not translated). */
  label: string;
  lines: CartLine[];
  customer: SaleCustomer | null;
  loyalty: AppliedLoyaltyRedeem | null;
};

export type HeldSaleInput = {
  lines: CartLine[];
  customer: SaleCustomer | null;
  loyalty: AppliedLoyaltyRedeem | null;
  /** Optional; defaults via `defaultHeldSaleLabel`. */
  label?: string;
};

export type HeldSaleAddFailReason =
  | "empty_tenant"
  | "empty_lines"
  | "at_capacity"
  | "storage";

export type HeldSaleAddResult =
  | { ok: true; snapshot: HeldSaleSnapshot }
  | { ok: false; reason: HeldSaleAddFailReason };

function storageKey(tenantId: string, storeId: string | null): string {
  const storePart = storeId?.trim() || "none";
  return `${PREFIX}.${tenantId}.${storePart}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `hold-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function strOrNull(v: unknown): string | null {
  if (v == null || v === "") return null;
  return typeof v === "string" ? v : String(v);
}

function isPackagingUnitType(v: unknown): v is PackagingUnitType {
  return v === "PIECE" || v === "STRIP" || v === "BOX";
}

function parseFefoOverride(v: unknown): CartLineFefoOverride | null | undefined {
  if (v == null) return undefined;
  if (typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const authorizedById = str(o.authorizedById).trim();
  const authorizedByName = str(o.authorizedByName).trim();
  const authorizedAt = str(o.authorizedAt).trim();
  if (!authorizedById || !authorizedByName || !authorizedAt) return null;
  return {
    authorizedById,
    authorizedByName,
    authorizedAt,
    fefoBatchId: strOrNull(o.fefoBatchId),
    fefoBatchNumber: strOrNull(o.fefoBatchNumber),
    fefoExpiryDate: strOrNull(o.fefoExpiryDate),
  };
}

function parseCartLine(v: unknown): CartLine | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const id = str(o.id).trim();
  const productId = str(o.productId).trim();
  const productName = str(o.productName).trim();
  const batchId = str(o.batchId).trim();
  const batchNumber = str(o.batchNumber).trim();
  if (!id || !productId || !productName || !batchId || !batchNumber) return null;
  if (!isPackagingUnitType(o.unitType)) return null;
  const unitQty = num(o.unitQty);
  const quantityBase = num(o.quantityBase);
  if (unitQty <= 0 || quantityBase <= 0) return null;

  const fefoOverride = parseFefoOverride(o.fefoOverride);

  return {
    id,
    productId,
    productName,
    genericName: strOrNull(o.genericName),
    manufacturer: strOrNull(o.manufacturer),
    strength: strOrNull(o.strength),
    form: strOrNull(o.form),
    batchId,
    batchNumber,
    expiryDate: str(o.expiryDate),
    batchQtyOnHand: num(o.batchQtyOnHand),
    unitType: o.unitType,
    unitQty,
    unitPrice: num(o.unitPrice),
    lineTotal: num(o.lineTotal),
    quantityBase,
    factorToBase: num(o.factorToBase, 1),
    maxUnitQty: num(o.maxUnitQty),
    sellPerBase: num(o.sellPerBase),
    fefo: Boolean(o.fefo),
    ...(fefoOverride !== undefined ? { fefoOverride } : {}),
  };
}

function parseCustomer(v: unknown): SaleCustomer | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const customerId = str(o.customerId).trim();
  const name = str(o.name).trim();
  if (!customerId || !name) return null;
  return {
    customerId,
    name,
    phone: strOrNull(o.phone),
    loyaltyPoints: Math.max(0, Math.trunc(num(o.loyaltyPoints))),
  };
}

function parseLoyalty(v: unknown): AppliedLoyaltyRedeem | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const verifiedAt = str(o.verifiedAt).trim();
  if (!verifiedAt) return null;
  return {
    points: Math.max(0, num(o.points)),
    taka: Math.max(0, num(o.taka)),
    verifiedAt,
  };
}

function parseSnapshot(raw: unknown): HeldSaleSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = str(o.id).trim();
  const heldAt = str(o.heldAt).trim();
  if (!id || !heldAt || Number.isNaN(new Date(heldAt).getTime())) return null;

  const lines = Array.isArray(o.lines)
    ? o.lines.map(parseCartLine).filter((l): l is CartLine => l != null)
    : [];
  if (lines.length === 0) return null;

  const customer = parseCustomer(o.customer);
  const label =
    str(o.label).trim() || defaultHeldSaleLabel(customer, lines) || formatHeldSaleAt(heldAt);

  return {
    id,
    heldAt,
    label,
    lines,
    customer,
    loyalty: parseLoyalty(o.loyalty),
  };
}

/** True when another hold slot is free (max 3). */
export function canAddHeldSale(existingCount: number): boolean {
  return existingCount < MAX_HELD_SALES;
}

/**
 * Default list label from runtime data (customer / product names — not i18n).
 * Time fallback uses Latin digits.
 */
export function defaultHeldSaleLabel(
  customer: SaleCustomer | null,
  lines: CartLine[],
  heldAtIso?: string,
): string {
  const name = customer?.name?.trim();
  if (name) return name;
  const first = lines[0]?.productName?.trim();
  if (first) return first;
  if (heldAtIso) return formatHeldSaleAt(heldAtIso);
  return "";
}

/** HH:MM · YYYY-MM-DD — Latin digits only. */
export function formatHeldSaleAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())} · ${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Build a snapshot in memory (does not persist). Null when there are no valid lines. */
export function buildHeldSaleSnapshot(
  input: HeldSaleInput,
  now: Date = new Date(),
): HeldSaleSnapshot | null {
  const lines = input.lines
    .map((line) => parseCartLine(line))
    .filter((l): l is CartLine => l != null);
  if (lines.length === 0) return null;
  const heldAt = now.toISOString();
  const label =
    (input.label ?? "").trim() ||
    defaultHeldSaleLabel(input.customer, lines, heldAt);
  return {
    id: newId(),
    heldAt,
    label,
    lines: cloneJson(lines),
    customer: input.customer ? cloneJson(input.customer) : null,
    loyalty: input.loyalty ? cloneJson(input.loyalty) : null,
  };
}

/** Parse a JSON array of snapshots (corrupt / partial entries dropped). */
export function parseHeldSaleList(raw: string | null): HeldSaleSnapshot[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(parseSnapshot)
      .filter((e): e is HeldSaleSnapshot => e != null)
      .slice(0, MAX_HELD_SALES);
  } catch {
    return [];
  }
}

function readList(tenantId: string, storeId: string | null): HeldSaleSnapshot[] {
  try {
    return parseHeldSaleList(localStorage.getItem(storageKey(tenantId, storeId)));
  } catch {
    return [];
  }
}

function writeList(
  tenantId: string,
  storeId: string | null,
  list: HeldSaleSnapshot[],
): boolean {
  try {
    localStorage.setItem(
      storageKey(tenantId, storeId),
      JSON.stringify(list.slice(0, MAX_HELD_SALES)),
    );
    return true;
  } catch {
    return false;
  }
}

export const heldSaleStore = {
  list(tenantId: string, storeId: string | null): HeldSaleSnapshot[] {
    if (!tenantId) return [];
    return readList(tenantId, storeId);
  },

  count(tenantId: string, storeId: string | null): number {
    return this.list(tenantId, storeId).length;
  },

  get(
    tenantId: string,
    storeId: string | null,
    id: string,
  ): HeldSaleSnapshot | null {
    const needle = id.trim();
    if (!needle) return null;
    return this.list(tenantId, storeId).find((e) => e.id === needle) ?? null;
  },

  /**
   * Park a sale. Newest first. Refuses a 4th hold (no overwrite).
   * Does not persist tender drafts — caller must omit cash/card/MFS state.
   */
  add(
    tenantId: string,
    storeId: string | null,
    input: HeldSaleInput,
  ): HeldSaleAddResult {
    if (!tenantId) return { ok: false, reason: "empty_tenant" };
    const snapshot = buildHeldSaleSnapshot(input);
    if (!snapshot) return { ok: false, reason: "empty_lines" };
    const existing = readList(tenantId, storeId);
    if (!canAddHeldSale(existing.length)) {
      return { ok: false, reason: "at_capacity" };
    }
    const next = [snapshot, ...existing.filter((e) => e.id !== snapshot.id)];
    if (!writeList(tenantId, storeId, next)) {
      return { ok: false, reason: "storage" };
    }
    return { ok: true, snapshot };
  },

  remove(tenantId: string, storeId: string | null, id: string): boolean {
    if (!tenantId) return false;
    const needle = id.trim();
    if (!needle) return false;
    const existing = readList(tenantId, storeId);
    const next = existing.filter((e) => e.id !== needle);
    if (next.length === existing.length) return false;
    return writeList(tenantId, storeId, next);
  },

  clear(tenantId: string, storeId: string | null): void {
    if (!tenantId) return;
    try {
      localStorage.removeItem(storageKey(tenantId, storeId));
    } catch {
      /* ignore quota / private mode */
    }
  },
};
