/**
 * M4 Batch A smoke — memory backend (Vite path), same isolation as smoke:m3e.
 * Run: npm run smoke:m4a -w @r2a/desktop
 *
 * Verifies: idempotent enqueue, FIFO pending, dead vs pending counts,
 * retry, mark synced, stock delta + clamp.
 * Does not hit cloud API, Tauri IPC, or /sync/ingest.
 */

import { createMemoryBackend } from "../src/lib/localDb/memoryBackend";

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

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  installMemoryStorage();
  const db = createMemoryBackend();
  await db.migrate();
  const now = new Date().toISOString();

  await db.replaceCatalogCache({
    products: [
      {
        id: "p1",
        name: "Napa 500mg",
        genericName: "Paracetamol",
        manufacturer: "Beximco Pharmaceuticals",
        strength: "500 mg",
        form: "Tablet",
        sku: "NAPA-500",
        barcode: "8901001",
        isActive: true,
        cachedAt: now,
        units: [
          {
            id: "u1",
            productId: "p1",
            unitType: "PIECE",
            factorToBase: 1,
            label: null,
          },
        ],
      },
    ],
    batches: [
      {
        id: "b-stock",
        productId: "p1",
        storeId: "s1",
        batchNumber: "LOT-100",
        expiryDate: "2027-01-01",
        quantityOnHand: 100,
        sellPerBase: 1.5,
        cachedAt: now,
      },
      {
        id: "b-clamp",
        productId: "p1",
        storeId: "s1",
        batchNumber: "LOT-2",
        expiryDate: "2027-06-01",
        quantityOnHand: 2,
        sellPerBase: 1.5,
        cachedAt: now,
      },
    ],
  });

  await db.enqueueSyncEvent({
    id: "sale-a",
    entityType: "sale",
    action: "create",
    payload: { eventId: "sale-a", total: 12 },
  });
  await db.enqueueSyncEvent({
    id: "sale-a",
    entityType: "sale",
    action: "create",
    payload: { eventId: "sale-a", total: 99 },
  });
  await db.enqueueSyncEvent({
    id: "sale-b",
    entityType: "sale",
    action: "create",
    payload: { eventId: "sale-b", total: 24 },
  });

  let pending = await db.countUnsynced();
  assert(pending === 2, `expected pending=2 after enqueue, got ${pending}`);

  const fifo = await db.listSyncPending();
  assert(fifo.length === 2, `expected FIFO length 2, got ${fifo.length}`);
  assert(
    fifo[0]?.id === "sale-a" && fifo[1]?.id === "sale-b",
    `expected FIFO [sale-a, sale-b], got ${fifo.map((r) => r.id).join(",")}`,
  );
  assert(
    fifo[0]?.payload.eventId === "sale-a" && fifo[0]?.payload.total === 12,
    `duplicate enqueue must not overwrite payload: ${JSON.stringify(fifo[0]?.payload)}`,
  );

  const listed = await db.listSyncQueue();
  assert(listed.length === 2, `expected UI list 2, got ${listed.length}`);

  await db.markSyncDead("sale-a", "poison 4xx");
  pending = await db.countUnsynced();
  const dead = await db.countSyncDead();
  assert(pending === 1, `expected pending=1 after dead, got ${pending}`);
  assert(dead === 1, `expected dead=1, got ${dead}`);

  const afterDeadPending = await db.listSyncPending();
  assert(
    afterDeadPending.length === 1 && afterDeadPending[0]?.id === "sale-b",
    `pending FIFO after dead should be [sale-b], got ${afterDeadPending.map((r) => r.id).join(",")}`,
  );

  const uiAfterDead = await db.listSyncQueue();
  assert(uiAfterDead.length === 2, `UI list should keep dead+pending, got ${uiAfterDead.length}`);
  assert(
    uiAfterDead[0]?.id === "sale-a" && uiAfterDead[0]?.dead === 1,
    `failed rows first: ${uiAfterDead.map((r) => `${r.id}:${r.dead}`).join(",")}`,
  );
  assert(
    uiAfterDead[0]?.lastError === "poison 4xx",
    `lastError missing: ${uiAfterDead[0]?.lastError}`,
  );

  await db.retrySyncEvent("sale-a");
  pending = await db.countUnsynced();
  assert(pending === 2, `expected pending=2 after retry, got ${pending}`);
  assert((await db.countSyncDead()) === 0, "dead should be 0 after retry");

  const retried = (await db.listSyncQueue()).find((r) => r.id === "sale-a");
  assert(retried?.dead === 0, "retry must clear dead");
  assert(retried?.attemptCount === 0, "retry must reset attempt_count");
  assert(retried?.lastError === null, "retry must clear last_error");

  await db.markSyncSynced("sale-a");
  await db.markSyncSynced("sale-b");
  pending = await db.countUnsynced();
  assert(pending === 0, `expected pending=0 after synced, got ${pending}`);
  assert(
    (await db.listSyncQueue()).length === 0,
    "synced rows must leave the UI list",
  );

  await db.applyCachedStockDelta("b-stock", -3);
  await db.applyCachedStockDelta("b-clamp", -5);
  const batches = await db.listCachedBatches("p1");
  const stock = batches.find((b) => b.id === "b-stock");
  const clamp = batches.find((b) => b.id === "b-clamp");
  assert(stock?.quantityOnHand === 97, `expected stock 97, got ${stock?.quantityOnHand}`);
  assert(clamp?.quantityOnHand === 0, `expected clamp 0, got ${clamp?.quantityOnHand}`);

  await db.markSyncAttempt("missing-id", "noop");
  assert((await db.countUnsynced()) === 0, "missing-id attempt must not create rows");

  console.log("smoke-m4a PASS", {
    kind: db.kind,
    path: await db.getDbPath(),
    pending,
    deadAfterRetry: await db.countSyncDead(),
    stockQty: stock?.quantityOnHand,
    clampQty: clamp?.quantityOnHand,
  });
}

main().catch((err) => {
  console.error("smoke-m4a FAIL", err);
  process.exit(1);
});
