/**
 * M5 Batch D — map outbound_sync_queue last_error to Sync Queue conflict copy.
 * Online ingest 4xx still stays on payment (saleIngest). This helper is display-only.
 */

/** Default for `__r2aMarkHeadSyncDead()` so the walkthrough shows conflict copy. */
export const QA_SYNC_CONFLICT_LAST_ERROR = "409 Insufficient stock";

/**
 * True when last_error looks like insufficient stock / 409 / conflict
 * (or equivalent sale-ingest messages). Case-insensitive.
 */
export function isSyncConflictLastError(
  lastError: string | null | undefined,
): boolean {
  const s = (lastError ?? "").trim().toLowerCase();
  if (!s) return false;
  return (
    s.includes("insufficient stock") ||
    s.includes("409") ||
    s.includes("conflict") ||
    s.includes("no in-stock fefo")
  );
}
