/**
 * Local DB façade (Batch E).
 * Tauri → pos_local.db; Vite browser → memory/localStorage fallback.
 */

export type {
  CachedBatch,
  CachedProduct,
  CachedProductUnit,
  CatalogCachePayload,
  EnqueueSyncEventInput,
  LocalDbBackend,
  SyncQueueRow,
} from "./types";
export { pullCatalogCache } from "./catalogPull";
export type { CachePullResult } from "./catalogPull";
export { isTauriRuntime } from "./runtime";
export {
  __resetLocalDbForTests,
  applyCachedStockDelta,
  countSyncDead,
  countUnsynced,
  enqueueSyncEvent,
  ensureLocalDb,
  getLocalDbKind,
  getLocalDbPath,
  listCachedBatches,
  listSyncPending,
  listSyncQueue,
  markSyncAttempt,
  markSyncDead,
  markSyncSynced,
  replaceCatalogCache,
  retrySyncEvent,
  searchCachedProducts,
} from "./client";
