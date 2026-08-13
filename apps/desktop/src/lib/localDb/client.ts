/**
 * Local DB client ops (Batch E catalog + M4 A queue).
 * Separated from index to avoid circular imports with catalogPull.
 */

import { createMemoryBackend } from "./memoryBackend";
import { isTauriRuntime } from "./runtime";
import { createTauriBackend } from "./tauriBackend";
import type {
  CachedBatch,
  CachedProduct,
  CatalogCachePayload,
  EnqueueSyncEventInput,
  LocalDbBackend,
  SyncQueueRow,
} from "./types";

let backend: LocalDbBackend | null = null;
let readyPromise: Promise<LocalDbBackend> | null = null;

function pickBackend(): LocalDbBackend {
  return isTauriRuntime() ? createTauriBackend() : createMemoryBackend();
}

/** Open/migrate local DB once per session. */
export async function ensureLocalDb(): Promise<LocalDbBackend> {
  if (backend) return backend;
  if (!readyPromise) {
    readyPromise = (async () => {
      const b = pickBackend();
      await b.migrate();
      backend = b;
      return b;
    })();
  }
  return readyPromise;
}

export async function getLocalDbKind(): Promise<"tauri" | "memory"> {
  const b = await ensureLocalDb();
  return b.kind;
}

export async function getLocalDbPath(): Promise<string> {
  const b = await ensureLocalDb();
  return b.getDbPath();
}

export async function searchCachedProducts(
  q?: string,
  limit?: number,
): Promise<CachedProduct[]> {
  const b = await ensureLocalDb();
  return b.searchCachedProducts(q, limit);
}

export async function listCachedBatches(
  productId?: string,
): Promise<CachedBatch[]> {
  const b = await ensureLocalDb();
  return b.listCachedBatches(productId);
}

export async function replaceCatalogCache(
  payload: CatalogCachePayload,
): Promise<void> {
  const b = await ensureLocalDb();
  return b.replaceCatalogCache(payload);
}

export async function enqueueSyncEvent(
  input: EnqueueSyncEventInput,
): Promise<void> {
  const b = await ensureLocalDb();
  return b.enqueueSyncEvent(input);
}

export async function countUnsynced(): Promise<number> {
  const b = await ensureLocalDb();
  return b.countUnsynced();
}

export async function listSyncQueue(): Promise<SyncQueueRow[]> {
  const b = await ensureLocalDb();
  return b.listSyncQueue();
}

export async function listSyncPending(limit?: number): Promise<SyncQueueRow[]> {
  const b = await ensureLocalDb();
  return b.listSyncPending(limit);
}

export async function markSyncSynced(id: string): Promise<void> {
  const b = await ensureLocalDb();
  return b.markSyncSynced(id);
}

export async function markSyncAttempt(
  id: string,
  lastError: string,
): Promise<void> {
  const b = await ensureLocalDb();
  return b.markSyncAttempt(id, lastError);
}

export async function markSyncDead(id: string, lastError: string): Promise<void> {
  const b = await ensureLocalDb();
  return b.markSyncDead(id, lastError);
}

export async function retrySyncEvent(id: string): Promise<void> {
  const b = await ensureLocalDb();
  return b.retrySyncEvent(id);
}

export async function countSyncDead(): Promise<number> {
  const b = await ensureLocalDb();
  return b.countSyncDead();
}

export async function applyCachedStockDelta(
  batchId: string,
  quantityChange: number,
): Promise<void> {
  const b = await ensureLocalDb();
  return b.applyCachedStockDelta(batchId, quantityChange);
}

/** Dev/test helper — reset singleton (does not wipe storage). */
export function __resetLocalDbForTests(): void {
  backend = null;
  readyPromise = null;
}
