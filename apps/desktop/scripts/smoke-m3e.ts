/**
 * Batch E smoke — memory backend (Vite path).
 * Run: npx --yes tsx scripts/smoke-m3e.ts  (from apps/desktop)
 *
 * Verifies: migrate, replace cache, search "Napa", enqueue, count pending.
 * Does not hit cloud API or Tauri IPC.
 */

import { createMemoryBackend } from "../src/lib/localDb/memoryBackend";

async function main() {
  // Isolate from any browser localStorage key by using a unique backend instance.
  const db = createMemoryBackend();
  // Clear any prior smoke data in this Node process's storage stub:
  // memory backend uses localStorage — polyfill a minimal one for Node.
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
        id: "b1",
        productId: "p1",
        storeId: "s1",
        batchNumber: "LOT-1",
        expiryDate: "2027-01-01",
        quantityOnHand: 100,
        sellPerBase: 1.5,
        cachedAt: now,
      },
    ],
  });

  const hits = await db.searchCachedProducts("Napa", 20);
  if (hits.length < 1 || hits[0]?.name !== "Napa 500mg") {
    throw new Error(`search failed: ${JSON.stringify(hits)}`);
  }

  const batches = await db.listCachedBatches("p1");
  if (batches.length !== 1) {
    throw new Error(`batches failed: ${JSON.stringify(batches)}`);
  }

  await db.enqueueSyncEvent({
    id: "evt-smoke-1",
    entityType: "sale",
    action: "create",
    payload: { event_id: "evt-smoke-1" },
  });

  const pending = await db.countUnsynced();
  if (pending !== 1) {
    throw new Error(`expected pending=1, got ${pending}`);
  }

  console.log("smoke-m3e PASS", {
    kind: db.kind,
    path: await db.getDbPath(),
    searchHits: hits.length,
    batches: batches.length,
    pending,
  });
}

main().catch((err) => {
  console.error("smoke-m3e FAIL", err);
  process.exit(1);
});
