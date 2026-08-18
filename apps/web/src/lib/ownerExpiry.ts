import { apiRequest } from "./api";

export type ExpiryBucket = "0_30" | "31_60" | "61_90" | "expired";

export type OwnerExpiryRow = {
  productId: string;
  productName: string;
  genericName: string | null;
  batchId: string;
  batchNumber: string;
  expiryDate: string;
  quantityOnHand: number;
  costValue: number;
  fefoRank: number;
  supplierName: string | null;
  returnStatus: "ELIGIBLE" | "NOT_ELIGIBLE" | "MANIFEST_PREPARED";
};

export type OwnerExpiryPayload = {
  bucket: ExpiryBucket | null;
  counts: Record<ExpiryBucket, number>;
  rows: OwnerExpiryRow[];
};

export async function fetchOwnerExpiry(): Promise<OwnerExpiryPayload> {
  return apiRequest<OwnerExpiryPayload>("/api/v1/owner/expiry");
}

export function expiryBucketForDate(iso: string, now = new Date()): ExpiryBucket | null {
  const expiry = new Date(iso);
  if (Number.isNaN(expiry.getTime())) return null;
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const expiryUtc = Date.UTC(
    expiry.getUTCFullYear(),
    expiry.getUTCMonth(),
    expiry.getUTCDate(),
  );
  const days = Math.round((expiryUtc - todayUtc) / 86_400_000);
  if (days < 0) return "expired";
  if (days <= 30) return "0_30";
  if (days <= 60) return "31_60";
  if (days <= 90) return "61_90";
  return null;
}

export function daysUntilExpiry(iso: string, now = new Date()): number | null {
  const expiry = new Date(iso);
  if (Number.isNaN(expiry.getTime())) return null;
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const expiryUtc = Date.UTC(
    expiry.getUTCFullYear(),
    expiry.getUTCMonth(),
    expiry.getUTCDate(),
  );
  return Math.round((expiryUtc - todayUtc) / 86_400_000);
}
