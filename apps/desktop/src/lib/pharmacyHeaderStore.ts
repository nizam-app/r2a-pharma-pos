/**
 * Pharmacy / receipt header persistence (M3 Batch AH).
 *
 * Choice: webview `localStorage` (same family as locale + tokens).
 * Key: pharmasync.pharmacyHeader.<tenantId>.<storeId|none>
 *
 * Store-scoped so multi-branch terminals keep separate headers.
 * Receipt Preview / print model resolve via `resolvePharmacyHeader` —
 * empty / missing fields fall back to stub constants in `receiptModel`.
 *
 * Not synced to cloud yet (TODO when tenant/store profile API exists).
 */

export type PharmacyHeader = {
  name: string;
  branch: string;
  address: string;
  phone: string;
};

const PREFIX = "pharmasync.pharmacyHeader";

function storageKey(tenantId: string, storeId: string | null): string {
  const storePart = storeId?.trim() || "none";
  return `${PREFIX}.${tenantId}.${storePart}`;
}

function normalizeField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseSaved(raw: string | null): PharmacyHeader | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (!o || typeof o !== "object") return null;
    return {
      name: normalizeField(o.name),
      branch: normalizeField(o.branch),
      address: normalizeField(o.address),
      phone: normalizeField(o.phone),
    };
  } catch {
    return null;
  }
}

export const pharmacyHeaderStore = {
  get(tenantId: string, storeId: string | null): PharmacyHeader | null {
    if (!tenantId) return null;
    try {
      return parseSaved(localStorage.getItem(storageKey(tenantId, storeId)));
    } catch {
      return null;
    }
  },

  set(tenantId: string, storeId: string | null, header: PharmacyHeader): void {
    if (!tenantId) return;
    try {
      const payload: PharmacyHeader = {
        name: header.name.trim(),
        branch: header.branch.trim(),
        address: header.address.trim(),
        phone: header.phone.trim(),
      };
      localStorage.setItem(
        storageKey(tenantId, storeId),
        JSON.stringify(payload),
      );
    } catch {
      /* ignore quota / private mode */
    }
  },
};
