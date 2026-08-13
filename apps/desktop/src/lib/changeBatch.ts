/**
 * Change Batch (edit flow) helpers — Batch N.
 * Status labels match Change Batch - Edit Flow / Manual FEFO Override mocks.
 */

import type { PosBatchRow } from "@/lib/batchSelect";
import { defaultBatchFocusIndex } from "@/lib/batchSelect";
import type { PackagingUnitType } from "@/lib/qtyPackaging";

/** Draft packaging from Edit Sale Item when opening Change Batch. */
export type ChangeBatchDraft = {
  unitType: PackagingUnitType;
  unitQty: number;
  factorToBase: number;
  quantityBase: number;
};

export type ChangeBatchStatusKind =
  | "current_fefo"
  | "auth_required"
  | "can_fulfill"
  | "expired"
  | "current";

export function defaultChangeBatchFocusIndex(
  rows: PosBatchRow[],
  currentBatchId: string,
): number {
  const cur = rows.findIndex((r) => r.batchId === currentBatchId);
  if (cur >= 0) return cur;
  return defaultBatchFocusIndex(rows);
}

/**
 * Row status for the Change Batch table.
 * CURRENT - FEFO stays on the FEFO/current lot even while another row is focused.
 * Focused later sellable lot → CAN FULFILL ITEM; other later lots → AUTH REQUIRED.
 */
export function changeBatchStatusKind(
  row: PosBatchRow,
  opts: {
    currentBatchId: string;
    focusedBatchId: string | null;
    requiredPcs: number;
  },
): ChangeBatchStatusKind {
  if (row.status === "expired" || !row.sellable) return "expired";

  const isCurrent = row.batchId === opts.currentBatchId;
  if (isCurrent && row.status === "fefo") return "current_fefo";
  if (isCurrent) return "current";

  const isFocused = row.batchId === opts.focusedBatchId;
  if (isFocused && row.quantityOnHand >= opts.requiredPcs) {
    return "can_fulfill";
  }
  return "auth_required";
}

export function changeBatchStatusLabel(kind: ChangeBatchStatusKind): string {
  switch (kind) {
    case "current_fefo":
      return "CURRENT - FEFO";
    case "current":
      return "CURRENT";
    case "can_fulfill":
      return "CAN FULFILL ITEM";
    case "auth_required":
      return "AUTH REQUIRED";
    case "expired":
      return "EXPIRED";
  }
}

/** True when focused sellable lot is not FEFO → Manual FEFO Override + Request Authorization. */
export function needsFefoOverride(row: PosBatchRow | null | undefined): boolean {
  if (!row || !row.sellable) return false;
  return row.status !== "fefo";
}
