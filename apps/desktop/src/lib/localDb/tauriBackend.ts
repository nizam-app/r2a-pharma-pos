/** Tauri IPC backend → rusqlite pos_local.db */

import { invoke } from "@tauri-apps/api/core";
import type {
  CachedBatch,
  CachedProduct,
  CatalogCachePayload,
  EnqueueSyncEventInput,
  LocalDbBackend,
  SyncQueueRow,
} from "./types";

export function createTauriBackend(): LocalDbBackend {
  return {
    kind: "tauri",

    async migrate() {
      await invoke("db_migrate");
    },

    async getDbPath() {
      return invoke<string>("get_local_db_path");
    },

    async searchCachedProducts(q?: string, limit = 20) {
      return invoke<CachedProduct[]>("search_cached_products", {
        q: q ?? null,
        limit,
      });
    },

    async listCachedBatches(productId?: string) {
      return invoke<CachedBatch[]>("list_cached_batches", {
        productId: productId ?? null,
      });
    },

    async replaceCatalogCache(payload: CatalogCachePayload) {
      await invoke("replace_catalog_cache", { payload });
    },

    async enqueueSyncEvent(input: EnqueueSyncEventInput) {
      await invoke("enqueue_sync_event", {
        input: {
          id: input.id,
          entityType: input.entityType,
          action: input.action,
          payload: input.payload,
        },
      });
    },

    async countUnsynced() {
      const n = await invoke<number>("count_unsynced");
      return Number(n);
    },

    async listSyncQueue() {
      return invoke<SyncQueueRow[]>("list_sync_queue");
    },

    async listSyncPending(limit?: number) {
      return invoke<SyncQueueRow[]>("list_sync_pending", {
        limit: limit ?? null,
      });
    },

    async markSyncSynced(id: string) {
      await invoke("mark_sync_synced", { id });
    },

    async markSyncAttempt(id: string, lastError: string) {
      await invoke("mark_sync_attempt", { id, lastError });
    },

    async markSyncDead(id: string, lastError: string) {
      await invoke("mark_sync_dead", { id, lastError });
    },

    async retrySyncEvent(id: string) {
      await invoke("retry_sync_event", { id });
    },

    async countSyncDead() {
      const n = await invoke<number>("count_sync_dead");
      return Number(n);
    },

    async applyCachedStockDelta(batchId: string, quantityChange: number) {
      await invoke("apply_cached_stock_delta", { batchId, quantityChange });
    },
  };
}
