import type { PackagingUnitType } from "@/lib/qtyPackaging";

/**
 * FEFO override metadata on a cart line (Batch P).
 * TODO(real integration): map onto sale-line / ingest FEFO override flag + audit API.
 */
export type CartLineFefoOverride = {
  authorizedById: string;
  authorizedByName: string;
  authorizedAt: string;
  /** FEFO lot that was bypassed (for audit / later ingest). */
  fefoBatchId: string | null;
  fefoBatchNumber: string | null;
  fefoExpiryDate: string | null;
};

/** Local cart line for active New Sale (Batch J / K / M / P). */
export type CartLine = {
  id: string;
  productId: string;
  productName: string;
  genericName: string | null;
  manufacturer: string | null;
  strength: string | null;
  form: string | null;
  batchId: string;
  batchNumber: string;
  expiryDate: string;
  /** Batch on-hand snapshot (PIECE) when line was last confirmed — not reserved in DB. */
  batchQtyOnHand: number;
  unitType: PackagingUnitType;
  unitQty: number;
  /** Price charged per selected packaging unit */
  unitPrice: number;
  lineTotal: number;
  /** Qty in base PIECE units */
  quantityBase: number;
  /** PIECE conversion for this packaging unit */
  factorToBase: number;
  /** Max whole units allowed from stock at add/edit time */
  maxUnitQty: number;
  sellPerBase: number;
  fefo: boolean;
  /** Present when a non-FEFO batch was manager-authorized for this line. */
  fefoOverride?: CartLineFefoOverride | null;
};
