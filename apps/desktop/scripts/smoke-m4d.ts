/**
 * M4 Batch D smoke — source guards + memory flush worker.
 * Run: npm run smoke:m4d -w @r2a/desktop
 *
 * Verifies: 15s interval, pause when forced, POST /api/v1/sync/ingest,
 * max 8 transient attempts, FIFO accepted/duplicate/rejected, head-only
 * 5xx attempt, backoff, 401 does not dead-letter, no Baki.
 * Live reconnect is the user walkthrough (does not require cloud here).
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ApiError } from "../src/lib/api";
import {
  __resetLocalDbForTests,
  countSyncDead,
  countUnsynced,
  enqueueSyncEvent,
  ensureLocalDb,
  listSyncPending,
} from "../src/lib/localDb/client";
import {
  SYNC_FLUSH_BATCH_SIZE,
  SYNC_FLUSH_INTERVAL_MS,
  SYNC_MAX_TRANSIENT_ATTEMPTS,
  flushSyncQueue,
  isSyncRowInBackoff,
  selectReadyPrefix,
  shouldPauseSyncWorker,
  syncBackoffMs,
  type SyncIngestPostBody,
} from "../src/lib/syncWorker";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "..", "src");

function readSrc(rel: string): string {
  return readFileSync(join(SRC, rel), "utf8");
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function installMemoryStorage(): void {
  const store = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => {
      store.set(k, String(v));
    },
    removeItem: (k) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  };
}

async function resetDb(): Promise<void> {
  __resetLocalDbForTests();
  globalThis.localStorage.clear();
  await ensureLocalDb();
}

async function enqueueSale(id: string): Promise<void> {
  await enqueueSyncEvent({
    id,
    entityType: "sale",
    action: "create",
    payload: { eventId: id, storeId: "s1", total: 12, items: [], payments: [] },
  });
}

function acceptedFor(ids: string[]) {
  return async (body: SyncIngestPostBody) => ({
    results: body.events.map((e) => ({
      eventId: e.event_id,
      status: ids.includes(e.event_id) ? ("accepted" as const) : ("rejected" as const),
    })),
  });
}

function checkSource(): void {
  const worker = readSrc("lib/syncWorker.ts");
  const localDb = readSrc("features/shell/LocalDbProvider.tsx");
  const connectivity = readSrc("features/shell/ConnectivityProvider.tsx");
  const badge = readSrc("features/shell/ConnectivityBadge.tsx");
  const app = readSrc("App.tsx");
  const m3ap = readFileSync(join(__dirname, "smoke-m3ap.ts"), "utf8");

  assert(
    worker.includes("15_000") || worker.includes("15000"),
    "worker interval must be 15000ms",
  );
  assert(
    SYNC_FLUSH_INTERVAL_MS === 15_000,
    `SYNC_FLUSH_INTERVAL_MS must be 15000, got ${SYNC_FLUSH_INTERVAL_MS}`,
  );
  assert(
    SYNC_FLUSH_BATCH_SIZE === 10,
    `batch size must be 10, got ${SYNC_FLUSH_BATCH_SIZE}`,
  );
  assert(
    SYNC_MAX_TRANSIENT_ATTEMPTS === 8,
    `max transient attempts must be 8, got ${SYNC_MAX_TRANSIENT_ATTEMPTS}`,
  );
  assert(
    worker.includes('"/api/v1/sync/ingest"'),
    "worker must POST /api/v1/sync/ingest",
  );
  assert(
    worker.includes("import type") &&
      !/import\s*\{[^}]*syncActionSchema/.test(worker) &&
      !/import\s*\{[^}]*syncEntityTypeSchema/.test(worker),
    "worker must not value-import CJS Zod from @r2a/shared-types (Vite named-export crash)",
  );
  assert(
    worker.includes("shouldPauseSyncWorker") &&
      worker.includes("forcedOffline") &&
      worker.includes('mode !== "online"'),
    "worker must pause when forced or not online",
  );
  assert(
    worker.includes("SYNC_MAX_TRANSIENT_ATTEMPTS") &&
      (worker.includes(">= SYNC_MAX_TRANSIENT_ATTEMPTS") ||
        worker.includes("=== SYNC_MAX_TRANSIENT_ATTEMPTS")),
    "8th transient attempt must dead-letter",
  );
  assert(!/Baki/i.test(worker), "worker must not mention Baki");
  assert(
    localDb.includes("flushSyncQueue") &&
      localDb.includes("shouldPauseSyncWorker") &&
      localDb.includes("SYNC_FLUSH_INTERVAL_MS") &&
      localDb.includes("bindFlushNowHelper"),
    "LocalDbProvider must start the 15s worker and bind __r2aFlushSyncNow",
  );
  assert(
    localDb.includes("setFlushSyncing") && localDb.includes("setSyncError"),
    "worker must wire badge syncing + syncError",
  );
  assert(
    connectivity.includes("setFlushSyncing") &&
      connectivity.includes("flushSyncing") &&
      connectivity.includes("probeSyncing"),
    "ConnectivityProvider must keep probe Syncing… separate from flush",
  );
  assert(
    badge.includes("pendingSuffix") &&
      badge.includes("connectivity.forced") &&
      badge.includes("connectivity.pending"),
    "Forced/checking badge must show pending count (Latin digits)",
  );
  assert(
    !/["'`]\/api\/v1\/sync\/ingest["'`]/.test(app),
    "App.tsx must not POST /sync/ingest",
  );
  assert(
    m3ap.includes("worker owns flush") || m3ap.includes("syncWorker"),
    "smoke-m3ap must allow worker-owned /sync/ingest",
  );
  assert(
    worker.includes("__r2aFlushSyncNow") ||
      localDb.includes("bindFlushNowHelper"),
    "dev helper __r2aFlushSyncNow",
  );
}

async function checkWorker(): Promise<void> {
  installMemoryStorage();

  assert(shouldPauseSyncWorker({ forcedOffline: true, mode: "online" }), "pause when forced");
  assert(
    shouldPauseSyncWorker({ forcedOffline: false, mode: "offline" }),
    "pause when offline",
  );
  assert(
    shouldPauseSyncWorker({ forcedOffline: false, mode: "checking" }),
    "pause while checking",
  );
  assert(
    !shouldPauseSyncWorker({ forcedOffline: false, mode: "online" }),
    "run when online and not forced",
  );

  assert(syncBackoffMs(0) === 0, "no backoff before first attempt");
  assert(syncBackoffMs(1) === 15_000, "attempt 1 backoff 15s");
  assert(syncBackoffMs(2) === 30_000, "attempt 2 backoff 30s");
  assert(syncBackoffMs(8) === 240_000, "backoff cap 240s");

  const now = Date.now();
  const hol = selectReadyPrefix(
    [
      {
        id: "a",
        entityType: "sale",
        action: "create",
        payload: {},
        synced: 0,
        createdAt: "t1",
        attemptCount: 1,
        lastError: "x",
        lastAttemptAt: new Date(now).toISOString(),
        dead: 0,
      },
      {
        id: "b",
        entityType: "sale",
        action: "create",
        payload: {},
        synced: 0,
        createdAt: "t2",
        attemptCount: 0,
        lastError: null,
        lastAttemptAt: null,
        dead: 0,
      },
    ],
    now,
  );
  assert(hol.length === 0, "head-of-line backoff must not skip to later rows");

  await resetDb();
  await enqueueSale("sale-a");
  await enqueueSale("sale-b");
  let posts = 0;
  const ok = await flushSyncQueue({
    postIngest: async (body) => {
      posts += 1;
      assert(body.events.length === 2, "batch posts FIFO prefix");
      assert(body.events[0]?.event_id === "sale-a", "FIFO head first");
      assert(body.events[0]?.entity_type === "sale", "entity_type sale");
      assert(body.events[0]?.action === "create", "action create");
      assert(body.events[0]?.payload.eventId === "sale-a", "payload camelCase");
      return acceptedFor(["sale-a", "sale-b"])(body);
    },
  });
  assert(posts === 1, "one POST per tick");
  assert(ok.accepted === 2 && ok.pendingCount === 0, "accepted marks synced");
  assert((await countUnsynced()) === 0, "pending 0 after accept");

  await resetDb();
  await enqueueSale("dup-1");
  const dup = await flushSyncQueue({
    postIngest: async (body) => ({
      results: body.events.map((e) => ({
        eventId: e.event_id,
        status: "duplicate" as const,
      })),
    }),
  });
  assert(dup.duplicate === 1 && dup.pendingCount === 0, "duplicate marks synced");

  await resetDb();
  await enqueueSale("poison");
  await enqueueSale("ok-later");
  const mixed = await flushSyncQueue({
    postIngest: async (body) => ({
      results: body.events.map((e) =>
        e.event_id === "poison"
          ? {
              eventId: e.event_id,
              status: "rejected" as const,
              message: "bad totals",
            }
          : { eventId: e.event_id, status: "accepted" as const },
      ),
    }),
  });
  assert(mixed.rejected === 1 && mixed.accepted === 1, "rejected + later accepted");
  assert((await countUnsynced()) === 0, "accepted row synced");
  assert((await countSyncDead()) === 1, "poison dead-lettered");

  await resetDb();
  await enqueueSale("head");
  await enqueueSale("tail");
  posts = 0;
  const boom = await flushSyncQueue({
    postIngest: async () => {
      posts += 1;
      throw new ApiError("Server error", 503);
    },
  });
  assert(posts === 1, "5xx still one POST");
  assert(boom.lastTickFailed === true, "5xx lastTickFailed");
  assert((await countUnsynced()) === 2, "5xx must not drop tail");
  assert((await countSyncDead()) === 0, "5xx must not dead-letter on first fail");
  const after5xx = await listSyncPending();
  assert(after5xx[0]?.id === "head", "head still pending");
  assert(after5xx[0]?.attemptCount === 1, "head attempt_count=1");
  assert(after5xx[1]?.attemptCount === 0, "tail not marked attempted");

  const immediately = await flushSyncQueue({
    postIngest: async () => {
      throw new Error("should not POST during backoff");
    },
  });
  assert(immediately.skipped === "backoff", "backoff skips tick");
  assert((await listSyncPending())[0]?.attemptCount === 1, "backoff does not increment");
  assert(
    isSyncRowInBackoff((await listSyncPending())[0]!),
    "head in backoff after attempt",
  );

  await resetDb();
  await enqueueSale("auth-row");
  const auth = await flushSyncQueue({
    postIngest: async () => {
      throw new ApiError("Unauthorized", 401);
    },
  });
  assert(auth.authFailed === true && auth.lastTickFailed === true, "401 sets syncError path");
  assert((await countSyncDead()) === 0, "401 must not dead-letter");
  assert((await countUnsynced()) === 1, "401 row stays pending");
  assert((await listSyncPending())[0]?.attemptCount === 0, "401 must not increment attempts");

  await resetDb();
  await enqueueSale("give-up");
  for (let i = 0; i < SYNC_MAX_TRANSIENT_ATTEMPTS; i += 1) {
    const farFuture = Date.now() + (i + 1) * 300_000;
    const tick = await flushSyncQueue({
      nowMs: () => farFuture,
      postIngest: async () => {
        throw new ApiError("Server error", 503);
      },
    });
    if (i < SYNC_MAX_TRANSIENT_ATTEMPTS - 1) {
      assert(tick.deadCount === 0, `attempt ${i + 1} must stay pending`);
    }
  }
  assert((await countSyncDead()) === 1, "8th transient attempt dead-letters");
  assert((await countUnsynced()) === 0, "dead is not pending");
}

async function main() {
  checkSource();
  await checkWorker();
  console.log("smoke-m4d PASS", {
    intervalMs: SYNC_FLUSH_INTERVAL_MS,
    batchSize: SYNC_FLUSH_BATCH_SIZE,
    maxAttempts: SYNC_MAX_TRANSIENT_ATTEMPTS,
    pauseWhenForced: true,
    ingestPath: "/api/v1/sync/ingest",
  });
}

main().catch((err) => {
  console.error("smoke-m4d FAIL", err);
  process.exit(1);
});
