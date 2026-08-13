/**
 * Browser / Vite-only fallback for Batch E / M4 A when not running under Tauri.
 * Persists to localStorage so queue + cache survive refresh during browser smoke.
 * Production path is Tauri rusqlite → pos_local.db.
 */

import type {
  CachedBatch,
  CachedProduct,
  CatalogCachePayload,
  EnqueueSyncEventInput,
  LocalDbBackend,
  SyncQueueRow,
} from "./types";

const STORAGE_KEY = "r2a.pos_local.v1";

type StoredQueueRow = {
  id: string;
  entityType: string;
  action: string;
  payload: string;
  synced: number;
  createdAt: string;
  attemptCount: number;
  lastError: string | null;
  lastAttemptAt: string | null;
  dead: number;
};

type Store = {
  products: CachedProduct[];
  batches: CachedBatch[];
  queue: StoredQueueRow[];
};

function emptyStore(): Store {
  return { products: [], batches: [], queue: [] };
}

function normalizeQueueRow(raw: unknown): StoredQueueRow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || !r.id) return null;
  return {
    id: r.id,
    entityType: typeof r.entityType === "string" ? r.entityType : "",
    action: typeof r.action === "string" ? r.action : "",
    payload: typeof r.payload === "string" ? r.payload : "{}",
    synced: typeof r.synced === "number" ? r.synced : 0,
    createdAt:
      typeof r.createdAt === "string" ? r.createdAt : new Date().toISOString(),
    attemptCount: typeof r.attemptCount === "number" ? r.attemptCount : 0,
    lastError: typeof r.lastError === "string" ? r.lastError : null,
    lastAttemptAt: typeof r.lastAttemptAt === "string" ? r.lastAttemptAt : null,
    dead: typeof r.dead === "number" ? r.dead : 0,
  };
}

function parsePayload(raw: string): Record<string, unknown> {
  try {
    const v: unknown = JSON.parse(raw);
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return v as Record<string, unknown>;
    }
    return { value: v };
  } catch {
    return { raw };
  }
}

function toSyncQueueRow(r: StoredQueueRow): SyncQueueRow {
  return {
    id: r.id,
    entityType: r.entityType,
    action: r.action,
    payload: parsePayload(r.payload),
    synced: r.synced,
    createdAt: r.createdAt,
    attemptCount: r.attemptCount,
    lastError: r.lastError,
    lastAttemptAt: r.lastAttemptAt,
    dead: r.dead,
  };
}

function load(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Store;
    return {
      products: Array.isArray(parsed.products) ? parsed.products : [],
      batches: Array.isArray(parsed.batches) ? parsed.batches : [],
      queue: Array.isArray(parsed.queue)
        ? parsed.queue
            .map(normalizeQueueRow)
            .filter((r): r is StoredQueueRow => r !== null)
        : [],
    };
  } catch {
    return emptyStore();
  }
}

function save(store: Store): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function nextCreatedAt(store: Store): string {
  const now = new Date().toISOString();
  const last = store.queue[store.queue.length - 1];
  if (last && last.createdAt >= now) {
    const bumped = Date.parse(last.createdAt);
    if (Number.isFinite(bumped)) {
      return new Date(bumped + 1).toISOString();
    }
  }
  return now;
}

function findQueue(store: Store, id: string): StoredQueueRow | undefined {
  return store.queue.find((r) => r.id === id);
}

function matchesQuery(p: CachedProduct, q: string): boolean {
  const n = q.toLowerCase();
  return (
    p.name.toLowerCase().includes(n) ||
    (p.genericName?.toLowerCase().includes(n) ?? false) ||
    (p.manufacturer?.toLowerCase().includes(n) ?? false) ||
    (p.strength?.toLowerCase().includes(n) ?? false) ||
    (p.form?.toLowerCase().includes(n) ?? false) ||
    (p.sku?.toLowerCase().includes(n) ?? false) ||
    (p.barcode?.toLowerCase().includes(n) ?? false)
  );
}

export function createMemoryBackend(): LocalDbBackend {
  return {
    kind: "memory",

    async migrate() {
      const store = load();
      save(store);
    },

    async getDbPath() {
      return `memory:${STORAGE_KEY}`;
    },

    async searchCachedProducts(q?: string, limit = 20) {
      const store = load();
      const capped = Math.min(Math.max(limit, 1), 100);
      let items = store.products.filter((p) => p.isActive);
      const needle = q?.trim();
      if (needle) {
        items = items.filter((p) => matchesQuery(p, needle));
      }
      return items
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, capped);
    },

    async listCachedBatches(productId?: string) {
      const store = load();
      let items = store.batches;
      if (productId) {
        items = items.filter((b) => b.productId === productId);
      }
      return items
        .slice()
        .sort(
          (a, b) =>
            a.expiryDate.localeCompare(b.expiryDate) ||
            a.id.localeCompare(b.id),
        );
    },

    async replaceCatalogCache(payload: CatalogCachePayload) {
      const store = load();
      store.products = payload.products.map((p) => ({
        ...p,
        manufacturer: p.manufacturer ?? null,
        strength: p.strength ?? null,
        form: p.form ?? null,
        units: p.units ?? [],
      }));
      store.batches = payload.batches;
      save(store);
    },

    async enqueueSyncEvent(input: EnqueueSyncEventInput) {
      const store = load();
      if (store.queue.some((r) => r.id === input.id)) {
        return;
      }
      store.queue.push({
        id: input.id,
        entityType: input.entityType,
        action: input.action,
        payload: JSON.stringify(input.payload),
        synced: 0,
        createdAt: nextCreatedAt(store),
        attemptCount: 0,
        lastError: null,
        lastAttemptAt: null,
        dead: 0,
      });
      save(store);
    },

    async countUnsynced() {
      return load().queue.filter((r) => r.synced === 0 && r.dead === 0).length;
    },

    async listSyncQueue() {
      return load()
        .queue.filter((r) => r.synced === 0 || r.dead === 1)
        .slice()
        .sort(
          (a, b) =>
            b.dead - a.dead ||
            a.createdAt.localeCompare(b.createdAt) ||
            a.id.localeCompare(b.id),
        )
        .map(toSyncQueueRow);
    },

    async listSyncPending(limit = 10) {
      const capped = Math.min(Math.max(limit, 1), 100);
      return load()
        .queue.filter((r) => r.synced === 0 && r.dead === 0)
        .slice()
        .sort(
          (a, b) =>
            a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
        )
        .slice(0, capped)
        .map(toSyncQueueRow);
    },

    async markSyncSynced(id: string) {
      const store = load();
      const row = findQueue(store, id);
      if (!row) return;
      row.synced = 1;
      save(store);
    },

    async markSyncAttempt(id: string, lastError: string) {
      const store = load();
      const row = findQueue(store, id);
      if (!row) return;
      row.attemptCount += 1;
      row.lastError = lastError;
      row.lastAttemptAt = new Date().toISOString();
      save(store);
    },

    async markSyncDead(id: string, lastError: string) {
      const store = load();
      const row = findQueue(store, id);
      if (!row) return;
      row.dead = 1;
      row.lastError = lastError;
      row.lastAttemptAt = new Date().toISOString();
      save(store);
    },

    async retrySyncEvent(id: string) {
      const store = load();
      const row = findQueue(store, id);
      if (!row) return;
      row.dead = 0;
      row.attemptCount = 0;
      row.lastError = null;
      row.lastAttemptAt = null;
      save(store);
    },

    async countSyncDead() {
      return load().queue.filter((r) => r.dead === 1).length;
    },

    async applyCachedStockDelta(batchId: string, quantityChange: number) {
      const store = load();
      const batch = store.batches.find((b) => b.id === batchId);
      if (!batch) return;
      batch.quantityOnHand = Math.max(0, batch.quantityOnHand + quantityChange);
      save(store);
    },
  };
}
