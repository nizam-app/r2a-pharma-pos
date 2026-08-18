import type {
  BatchAdjustmentInput,
  BatchCorrectionInput,
  BatchLifecycleInput,
  InventoryAdjustmentReason,
} from "@r2a/shared-types";
import { apiRequest } from "./api";
import type { BatchLifecycleStatus, BatchReturnStatus } from "./ownerProduct";

export type BatchRevisionAction =
  | "METADATA_CORRECTION"
  | "PRICE_CORRECTION"
  | "VOID"
  | "RETIRE";

export type OwnerBatchProduct = {
  id: string;
  name: string;
  genericName: string | null;
  strength: string | null;
  manufacturer: string | null;
  sku: string | null;
};

export type OwnerBatchAdjustment = {
  id: string;
  eventId: string | null;
  quantityBaseChange: number;
  quantityAfter: number | null;
  reasonCode: string | null;
  note: string | null;
  actorUserId: string | null;
  actorName: string | null;
  createdAt: string;
};

export type BatchSnapshot = {
  batchNumber?: unknown;
  expiryDate?: unknown;
  quantityOnHand?: unknown;
  costPerBase?: unknown;
  sellPerBase?: unknown;
  supplierName?: unknown;
  returnStatus?: unknown;
  status?: unknown;
  version?: unknown;
  [key: string]: unknown;
};

export type OwnerBatchRevision = {
  id: string;
  operationId: string;
  action: BatchRevisionAction;
  reason: string;
  before: BatchSnapshot;
  after: BatchSnapshot;
  actorUserId: string;
  actorName: string;
  createdAt: string;
};

export type OwnerBatchDetail = {
  id: string;
  tenantId: string;
  storeId: string;
  productId: string;
  product: OwnerBatchProduct;
  batchNumber: string;
  expiryDate: string;
  quantityOnHand: number;
  costPerBase: number;
  sellPerBase: number;
  supplierName: string | null;
  returnStatus: BatchReturnStatus;
  status: BatchLifecycleStatus;
  version: number;
  saleReferenceCount: number;
  canVoid: boolean;
  createdAt: string;
  updatedAt: string;
  adjustments: OwnerBatchAdjustment[];
  revisions: OwnerBatchRevision[];
};

export type BatchMutationBatch = {
  id: string;
  productId: string;
  storeId: string;
  batchNumber: string;
  expiryDate: string;
  quantityOnHand: number;
  costPerBase: number;
  sellPerBase: number;
  supplierName: string | null;
  returnStatus: BatchReturnStatus;
  status: BatchLifecycleStatus;
  version: number;
};

export type BatchCorrectionResult = {
  batch: BatchMutationBatch;
  revision: BatchMutationRevision;
};

export type BatchAdjustmentResult = {
  batch: BatchMutationBatch;
  event: BatchMutationEvent;
};

export type BatchLifecycleResult = BatchCorrectionResult & {
  event: BatchMutationEvent;
};

export type BatchMutationRevision = Omit<OwnerBatchRevision, "actorName"> & {
  actorName?: string;
};

export type BatchMutationEvent = Omit<OwnerBatchAdjustment, "actorName"> & {
  actorName?: string | null;
};

export type { InventoryAdjustmentReason };

export function fetchOwnerBatch(batchId: string): Promise<OwnerBatchDetail> {
  return apiRequest<OwnerBatchDetail>(
    `/api/v1/owner/batches/${encodeURIComponent(batchId)}`,
  );
}

export function correctOwnerBatch(
  batchId: string,
  input: BatchCorrectionInput,
): Promise<BatchCorrectionResult> {
  return apiRequest<BatchCorrectionResult>(
    `/api/v1/batches/${encodeURIComponent(batchId)}/corrections`,
    { method: "POST", body: input },
  );
}

export function adjustOwnerBatch(
  batchId: string,
  input: BatchAdjustmentInput,
): Promise<BatchAdjustmentResult> {
  return apiRequest<BatchAdjustmentResult>(
    `/api/v1/batches/${encodeURIComponent(batchId)}/adjustments`,
    { method: "POST", body: input },
  );
}

export function voidOwnerBatch(
  batchId: string,
  input: BatchLifecycleInput,
): Promise<BatchLifecycleResult> {
  return apiRequest<BatchLifecycleResult>(
    `/api/v1/batches/${encodeURIComponent(batchId)}/void`,
    { method: "POST", body: input },
  );
}

export function retireOwnerBatch(
  batchId: string,
  input: BatchLifecycleInput,
): Promise<BatchLifecycleResult> {
  return apiRequest<BatchLifecycleResult>(
    `/api/v1/batches/${encodeURIComponent(batchId)}/retire`,
    { method: "POST", body: input },
  );
}
