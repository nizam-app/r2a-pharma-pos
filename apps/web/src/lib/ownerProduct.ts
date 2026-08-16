import { apiRequest } from "./api";

export type ProductUnitType = "PIECE" | "STRIP" | "BOX";

export type ProductLotStatus = "fefo" | "active" | "expired" | "empty";

export type InventoryEventType = "RECEIVE" | "ADJUST" | "SALE";

export type OwnerProductUnit = {
  unitType: ProductUnitType;
  factorToBase: number;
  label: string | null;
  isPrimary: boolean;
  cost: number;
  sell: number;
  stripsEquivalent: number | null;
};

export type OwnerProductBatch = {
  id: string;
  batchNumber: string;
  expiryDate: string;
  quantityOnHand: number;
  costPerBase: number;
  sellPerBase: number;
  stockValue: number;
  fefoRank: number | null;
  status: ProductLotStatus;
};

export type OwnerProductEvent = {
  id: string;
  type: InventoryEventType;
  quantityBaseChange: number;
  note: string | null;
  createdAt: string;
  batchNumber: string | null;
  receiptNo: string | null;
  actorName: string | null;
};

export type OwnerProductDetail = {
  id: string;
  name: string;
  genericName: string | null;
  manufacturer: string | null;
  strength: string | null;
  form: string | null;
  sku: string | null;
  barcode: string | null;
  description?: string | null;
  category?: string | null;
  requiresPrescription?: boolean;
  coldChain: boolean;
  storageNotes?: string | null;
  reorderLevel?: number | null;
  isActive: boolean;
  primaryUnit: ProductUnitType;
  kpis: {
    currentStock: number;
    stockCostValue: number;
    retailStockValue: number;
    averageMarginPct: number | null;
    activeBatchCount: number;
    nearestExpiry: string | null;
  };
  fefo: {
    batchId: string;
    batchNumber: string;
    quantityOnHand: number;
    expiryDate: string;
  } | null;
  conversion: {
    totalBase: number;
    boxes: number;
    strips: number;
    remainderPcs: number;
    stripFactor: number | null;
    boxFactor: number | null;
    stripsPerBox: number | null;
  };
  units: OwnerProductUnit[];
  batches: OwnerProductBatch[];
  events: OwnerProductEvent[];
};

export type ProductUnitInput = {
  unitType: ProductUnitType;
  factorToBase: number;
  label?: string;
};

export type CreateProductPayload = {
  name: string;
  genericName?: string;
  manufacturer?: string;
  strength?: string;
  form?: string;
  sku?: string;
  barcode?: string;
  description?: string;
  category?: string;
  requiresPrescription?: boolean;
  coldChain?: boolean;
  storageNotes?: string;
  reorderLevel?: number;
  units: ProductUnitInput[];
};

export type CreatedProduct = {
  id: string;
  name: string;
  genericName?: string | null;
  manufacturer?: string | null;
  sku?: string | null;
  barcode?: string | null;
};

export type ReceiveStockPayload = {
  productId: string;
  storeId?: string;
  batchNumber: string;
  expiryDate: string;
  quantityOnHand: number;
  costPerBase: number;
  sellPerBase: number;
};

export type ReceivedBatch = ReceiveStockPayload & {
  id: string;
  storeId: string;
  createdAt: string;
  updatedAt: string;
};

/** Live OWNER product page — one round-trip, includes cost/margin/events. */
export async function fetchOwnerProduct(
  productId: string,
): Promise<OwnerProductDetail> {
  return apiRequest<OwnerProductDetail>(
    `/api/v1/owner/products/${encodeURIComponent(productId)}`,
  );
}

/** Create new catalog product (Batch L). Initial stock is always 0. */
export async function createOwnerProduct(
  input: CreateProductPayload,
): Promise<CreatedProduct> {
  return apiRequest<CreatedProduct>("/api/v1/products", {
    method: "POST",
    body: input,
  });
}

/** Online-only Owner receive flow. The server records the RECEIVE event. */
export async function receiveOwnerStock(
  input: ReceiveStockPayload,
): Promise<ReceivedBatch> {
  return apiRequest<ReceivedBatch>("/api/v1/batches", {
    method: "POST",
    body: input,
  });
}

