/** Shared types for local catalog cache + outbound queue (Batch E + M4 A). */

export type CachedProductUnit = {
  id: string;
  productId: string;
  unitType: string;
  factorToBase: number;
  label: string | null;
};

export type CachedProduct = {
  id: string;
  name: string;
  genericName: string | null;
  manufacturer: string | null;
  strength: string | null;
  form: string | null;
  sku: string | null;
  barcode: string | null;
  isActive: boolean;
  cachedAt: string;
  units: CachedProductUnit[];
};

export type CachedBatch = {
  id: string;
  productId: string;
  storeId: string;
  batchNumber: string;
  expiryDate: string;
  quantityOnHand: number;
  sellPerBase: number;
  cachedAt: string;
};

export type CatalogCachePayload = {
  products: CachedProduct[];
  batches: CachedBatch[];
};

export type EnqueueSyncEventInput = {
  id: string;
  entityType: string;
  action: string;
  payload: Record<string, unknown>;
};

/** Parsed outbound_sync_queue row (UI + worker). */
export type SyncQueueRow = {
  id: string;
  entityType: string;
  action: string;
  payload: Record<string, unknown>;
  synced: number;
  createdAt: string;
  attemptCount: number;
  lastError: string | null;
  lastAttemptAt: string | null;
  dead: number;
};

export type LocalDbBackend = {
  readonly kind: "tauri" | "memory";
  migrate(): Promise<void>;
  getDbPath(): Promise<string>;
  searchCachedProducts(q?: string, limit?: number): Promise<CachedProduct[]>;
  listCachedBatches(productId?: string): Promise<CachedBatch[]>;
  replaceCatalogCache(payload: CatalogCachePayload): Promise<void>;
  enqueueSyncEvent(input: EnqueueSyncEventInput): Promise<void>;
  countUnsynced(): Promise<number>;
  listSyncQueue(): Promise<SyncQueueRow[]>;
  listSyncPending(limit?: number): Promise<SyncQueueRow[]>;
  markSyncSynced(id: string): Promise<void>;
  markSyncAttempt(id: string, lastError: string): Promise<void>;
  markSyncDead(id: string, lastError: string): Promise<void>;
  retrySyncEvent(id: string): Promise<void>;
  countSyncDead(): Promise<number>;
  applyCachedStockDelta(batchId: string, quantityChange: number): Promise<void>;
};
