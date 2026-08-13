/**
 * Quantity & Packaging helpers (Batch J).
 * Units from ProductUnit / local cache; stock in base PIECE.
 */

import { apiRequest } from "@/lib/api";
import { searchCachedProducts } from "@/lib/localDb/client";
import type { CachedProductUnit } from "@/lib/localDb/types";

export type PackagingUnitType = "PIECE" | "STRIP" | "BOX";

export type PackagingUnitOption = {
  unitType: PackagingUnitType;
  factorToBase: number;
  /** e.g. "Piece" or "Strip (10 pcs)" */
  title: string;
  /** Lowercase unit noun for price lines */
  unitNoun: string;
  /** Price for one of this unit (= sellPerBase × factor) */
  unitPrice: number;
  /** False when batch cannot supply even 1 unit */
  enabled: boolean;
  /** Max whole units from batch qty */
  maxQty: number;
};

const UNIT_ORDER: PackagingUnitType[] = ["PIECE", "STRIP", "BOX"];

const UNIT_NOUN: Record<PackagingUnitType, string> = {
  PIECE: "piece",
  STRIP: "strip",
  BOX: "box",
};

type ApiProductUnit = {
  id?: unknown;
  unitType?: unknown;
  factorToBase?: unknown;
  label?: unknown;
};

type ApiProduct = {
  id?: unknown;
  units?: unknown;
};

function str(v: unknown): string {
  return v == null ? "" : String(v);
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function asUnitType(raw: string): PackagingUnitType | null {
  const u = raw.toUpperCase();
  if (u === "PIECE" || u === "STRIP" || u === "BOX") return u;
  return null;
}

function labelOrNull(v: unknown): string | null {
  if (v == null || v === "") return null;
  return String(v);
}

function mapUnit(raw: ApiProductUnit | CachedProductUnit): CachedProductUnit | null {
  const id = "id" in raw ? str(raw.id) : "";
  const unitType = str(raw.unitType);
  const factorToBase = Math.max(1, Math.trunc(num(raw.factorToBase, 1)));
  if (!unitType) return null;
  return {
    id: id || `${unitType}-${factorToBase}`,
    productId: "productId" in raw ? str(raw.productId) : "",
    unitType,
    factorToBase,
    label: "label" in raw ? labelOrNull(raw.label) : null,
  };
}

async function fetchOnlineUnits(productId: string): Promise<CachedProductUnit[]> {
  const raw = await apiRequest<ApiProduct>(
    `/api/v1/products/${encodeURIComponent(productId)}`,
  );
  const unitsRaw = Array.isArray(raw?.units) ? (raw.units as ApiProductUnit[]) : [];
  return unitsRaw
    .map((u) => mapUnit(u))
    .filter((u): u is CachedProductUnit => u != null);
}

async function fetchCachedUnits(
  productId: string,
  nameHint?: string,
): Promise<CachedProductUnit[]> {
  const needle = nameHint?.trim() || "";
  // Prefer name hint so we are not capped out of a large catalog; fall back to full scan.
  const primary = await searchCachedProducts(needle || undefined, 50);
  let hit = primary.find((p) => p.id === productId);
  if (!hit && needle) {
    const all = await searchCachedProducts(undefined, 100);
    hit = all.find((p) => p.id === productId);
  }
  return hit?.units ?? [];
}

/** Load ProductUnit rows online (GET product) or from local catalog cache. */
export async function loadProductUnits(
  productId: string,
  opts: { online: boolean; nameHint?: string },
): Promise<CachedProductUnit[]> {
  if (opts.online) {
    try {
      const units = await fetchOnlineUnits(productId);
      if (units.length > 0) return units;
    } catch {
      // Fall through to cache.
    }
  }
  return fetchCachedUnits(productId, opts.nameHint);
}

function unitTitle(unitType: PackagingUnitType, factorToBase: number): string {
  if (unitType === "PIECE") return "Piece";
  if (unitType === "STRIP") return `Strip (${factorToBase} pcs)`;
  return `Box (${factorToBase} pcs)`;
}

/**
 * Build selectable packaging cards for the modal.
 * Always surfaces PIECE / STRIP / BOX when present on the product.
 */
export function buildPackagingOptions(
  units: CachedProductUnit[],
  quantityOnHand: number,
  sellPerBase: number,
): PackagingUnitOption[] {
  const byType = new Map<PackagingUnitType, CachedProductUnit>();
  for (const u of units) {
    const t = asUnitType(u.unitType);
    if (!t) continue;
    const prev = byType.get(t);
    if (!prev || u.factorToBase < prev.factorToBase) {
      byType.set(t, u);
    }
  }

  // Ensure PIECE exists for sellability even if API omitted it.
  if (!byType.has("PIECE")) {
    byType.set("PIECE", {
      id: "synthetic-piece",
      productId: "",
      unitType: "PIECE",
      factorToBase: 1,
      label: null,
    });
  }

  const qty = Math.max(0, Math.trunc(quantityOnHand));
  const price = Math.max(0, sellPerBase);

  return UNIT_ORDER.filter((t) => byType.has(t)).map((unitType) => {
    const u = byType.get(unitType)!;
    const factorToBase = Math.max(1, u.factorToBase);
    const maxQty = Math.floor(qty / factorToBase);
    return {
      unitType,
      factorToBase,
      title: unitTitle(unitType, factorToBase),
      unitNoun: UNIT_NOUN[unitType],
      unitPrice: price * factorToBase,
      enabled: maxQty >= 1,
      maxQty,
    };
  });
}

/** Default focus: Strip when sellable, else first enabled card. */
export function defaultPackagingUnit(
  options: PackagingUnitOption[],
): PackagingUnitType {
  const strip = options.find((o) => o.unitType === "STRIP" && o.enabled);
  if (strip) return "STRIP";
  const first = options.find((o) => o.enabled);
  return first?.unitType ?? "PIECE";
}

/**
 * Human stock line e.g. "Available: 1 Strip + 4 pieces."
 * Prefers strip remainder (matches shared Quantity & Packaging mock).
 * English-only helper for screens not yet localized (Edit Sale Item).
 */
export function formatAvailableBreakdown(
  quantityOnHand: number,
  options: PackagingUnitOption[],
): string {
  const parts = stockBreakdown(quantityOnHand, options);
  if (parts.kind === "strips_plus_pieces") {
    const stripWord = parts.strips === 1 ? "Strip" : "Strips";
    return `Available: ${parts.strips} ${stripWord} + ${parts.pieces} pieces.`;
  }
  if (parts.kind === "strips_only") {
    const stripWord = parts.strips === 1 ? "Strip" : "Strips";
    return `Available: ${parts.strips} ${stripWord}.`;
  }
  return `Available: ${parts.pieces} piece${parts.pieces === 1 ? "" : "s"}.`;
}

/** Semantic stock breakdown — format with locale at the React display boundary. */
export type StockBreakdown =
  | { kind: "strips_plus_pieces"; strips: number; pieces: number }
  | { kind: "strips_only"; strips: number }
  | { kind: "pieces_only"; pieces: number };

export function stockBreakdown(
  quantityOnHand: number,
  options: PackagingUnitOption[],
): StockBreakdown {
  const qty = Math.max(0, Math.trunc(quantityOnHand));
  const strip = options.find((o) => o.unitType === "STRIP");
  if (strip && strip.factorToBase > 1) {
    const strips = Math.floor(qty / strip.factorToBase);
    const rem = qty % strip.factorToBase;
    if (strips > 0 && rem > 0) {
      return { kind: "strips_plus_pieces", strips, pieces: rem };
    }
    if (strips > 0) {
      return { kind: "strips_only", strips };
    }
  }
  return { kind: "pieces_only", pieces: qty };
}

export function lineTotal(unitPrice: number, unitQty: number): number {
  return Math.max(0, unitPrice) * Math.max(0, Math.trunc(unitQty));
}

export function quantityBase(
  factorToBase: number,
  unitQty: number,
): number {
  return Math.max(1, factorToBase) * Math.max(0, Math.trunc(unitQty));
}

/**
 * Stock pool for editing a cart line: batch snapshot minus other cart lines
 * on the same batch. Snapshot is not reserved in DB, so this line’s current
 * allocation remains inside the pool (matches Edit Sale Item availability note).
 */
export function availablePcsForEditLine(
  batchQtyOnHand: number,
  otherSameBatchQuantityBase: number,
): number {
  const onHand = Math.max(0, Math.trunc(batchQtyOnHand));
  const others = Math.max(0, Math.trunc(otherSameBatchQuantityBase));
  return Math.max(0, onHand - others);
}

/** Unit row title for Edit Sale Item radios (Piece / Strip / Box). */
export function packagingUnitLabel(unitType: PackagingUnitType): string {
  if (unitType === "PIECE") return "Piece";
  if (unitType === "STRIP") return "Strip";
  return "Box";
}
