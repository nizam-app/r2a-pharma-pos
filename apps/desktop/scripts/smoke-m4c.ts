/**
 * M4 Batch C smoke — static/source + memory helper.
 * Run: npm run smoke:m4c -w @r2a/desktop
 *
 * Verifies: completeSaleOrQueue queues when offline/forced; does not ingest
 * in that branch; 4xx does not enqueue; 5xx/408 enqueue; stock delta applied;
 * App.tsx has no TODO(M4) online-required toasts on cash/card/MFS/zero-pay.
 * Does not start the 15s worker or POST /sync/ingest.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { SaleIngestInput } from "@r2a/shared-types";
import { ApiError } from "../src/lib/api";
import {
  __resetLocalDbForTests,
  countUnsynced,
  ensureLocalDb,
  listCachedBatches,
  listSyncPending,
  replaceCatalogCache,
} from "../src/lib/localDb/client";
import {
  completeSaleOrQueue,
  type IngestedSaleSummary,
} from "../src/lib/saleIngest";

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

function salePayload(
  eventId: string,
  batchId: string,
  qty = 3,
): SaleIngestInput {
  const lineTotal = 1.5 * qty;
  return {
    eventId,
    storeId: "s1",
    subtotal: lineTotal,
    discount: 0,
    total: lineTotal,
    items: [
      {
        productId: "p1",
        batchId,
        unitType: "PIECE",
        unitQty: qty,
        quantityBase: qty,
        unitPrice: 1.5,
        lineTotal,
      },
    ],
    payments: [{ method: "CASH", amount: lineTotal }],
  };
}

function ingestMustNotRun(): Promise<IngestedSaleSummary> {
  throw new Error("ingestSale must not run on queue path");
}

async function seedCatalog(qty = 100): Promise<void> {
  __resetLocalDbForTests();
  globalThis.localStorage.clear();
  await ensureLocalDb();
  const now = new Date().toISOString();
  await replaceCatalogCache({
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
        batchNumber: "NP23091",
        expiryDate: "2026-08-31",
        quantityOnHand: qty,
        sellPerBase: 1.5,
        cachedAt: now,
      },
    ],
  });
}

async function stockOf(batchId: string): Promise<number | undefined> {
  const batches = await listCachedBatches("p1");
  return batches.find((b) => b.id === batchId)?.quantityOnHand;
}

function checkSource(): void {
  const app = readSrc("App.tsx");
  const ingest = readSrc("lib/saleIngest.ts");
  const en = readSrc("i18n/locales/en.ts");
  const bn = readSrc("i18n/locales/bn-BD.ts");

  assert(!app.includes("TODO(M4)"), "App.tsx must not keep TODO(M4) complete blocks");
  assert(
    !app.includes("ops.onlineRequired"),
    "App.tsx must not toast online-required on complete paths",
  );
  assert(
    !app.includes("navigator.onLine"),
    "complete path must use connectivity isOnline + forcedOffline, not navigator.onLine",
  );
  assert(
    (app.match(/completeSaleOrQueue/g) ?? []).length >= 4,
    "cash / card / MFS / zero-pay must call completeSaleOrQueue",
  );
  assert(app.includes("isOnline"), "App must pass connectivity isOnline");
  assert(app.includes("forcedOffline"), "App must pass connectivity forcedOffline");
  assert(app.includes("setPendingCount"), "queued complete must refresh pending count");
  assert(app.includes('t("ops.saleQueued")'), "queued toast i18n");
  assert(!/["'`]\/api\/v1\/sync\/ingest["'`]/.test(app), "Batch C must not HTTP /sync/ingest");
  assert(
    !/["'`]\/api\/v1\/sync\/ingest["'`]/.test(ingest),
    "saleIngest must not HTTP /sync/ingest",
  );
  assert(
    ingest.includes("completeSaleOrQueue") &&
      ingest.includes("forcedOffline") &&
      ingest.includes("enqueueSyncEvent"),
    "completeSaleOrQueue must enqueue sale/create",
  );
  assert(
    ingest.includes("408") && ingest.includes("429"),
    "408/429 treated as transient",
  );
  assert(
    ingest.includes("applyCachedStockDelta") && ingest.includes("-item.quantityBase"),
    "queue path applies local stock delta",
  );
  assert(en.includes('"ops.saleQueued"'), "en ops.saleQueued");
  assert(bn.includes('"ops.saleQueued"'), "bn-BD ops.saleQueued");
  assert(
    !ingest.includes("15000") && !app.includes("setInterval(15000"),
    "Batch C must not start the 15s worker",
  );
}

async function checkHelper(): Promise<void> {
  installMemoryStorage();

  await seedCatalog(100);
  const offline = await completeSaleOrQueue(
    salePayload("evt-off", "b-stock", 3),
    { isOnline: false, forcedOffline: false },
    { ingestSale: ingestMustNotRun },
  );
  assert(offline.queued === true, "offline must queue");
  assert(offline.eventId === "evt-off", "queued summary uses payload eventId");
  assert((await countUnsynced()) === 1, "offline enqueue pending=1");
  assert((await stockOf("b-stock")) === 97, "offline stock 100-3=97");
  const pending = await listSyncPending();
  assert(pending[0]?.id === "evt-off", "queue id = eventId");
  assert(pending[0]?.entityType === "sale" && pending[0]?.action === "create", "sale/create");
  assert(pending[0]?.payload.eventId === "evt-off", "payload is ingest DTO");

  await seedCatalog(100);
  const forced = await completeSaleOrQueue(
    salePayload("evt-forced", "b-stock", 1),
    { isOnline: true, forcedOffline: true },
    { ingestSale: ingestMustNotRun },
  );
  assert(forced.queued === true, "Force Offline must queue even if isOnline");
  assert((await countUnsynced()) === 1, "forced enqueue pending=1");
  assert((await stockOf("b-stock")) === 99, "forced stock 100-1=99");

  await seedCatalog(100);
  let fourxx = false;
  try {
    await completeSaleOrQueue(
      salePayload("evt-409", "b-stock", 2),
      { isOnline: true, forcedOffline: false },
      {
        ingestSale: async () => {
          throw new ApiError("Insufficient stock", 409);
        },
      },
    );
  } catch (err) {
    fourxx = err instanceof ApiError && err.statusCode === 409;
  }
  assert(fourxx, "4xx must rethrow");
  assert((await countUnsynced()) === 0, "4xx must not enqueue");
  assert((await stockOf("b-stock")) === 100, "4xx must not apply stock delta");

  await seedCatalog(100);
  const fivexx = await completeSaleOrQueue(
    salePayload("evt-503", "b-stock", 3),
    { isOnline: true, forcedOffline: false },
    {
      ingestSale: async () => {
        throw new ApiError("Server error", 503);
      },
    },
  );
  assert(fivexx.queued === true, "5xx must enqueue");
  assert((await countUnsynced()) === 1, "5xx pending=1");
  assert((await stockOf("b-stock")) === 97, "5xx stock delta applied");

  await seedCatalog(100);
  const timeout = await completeSaleOrQueue(
    salePayload("evt-408", "b-stock", 1),
    { isOnline: true, forcedOffline: false },
    {
      ingestSale: async () => {
        throw new ApiError("Timeout", 408);
      },
    },
  );
  assert(timeout.queued === true, "408 must enqueue");

  await seedCatalog(100);
  let ingestCalls = 0;
  const online = await completeSaleOrQueue(
    salePayload("evt-ok", "b-stock", 3),
    { isOnline: true, forcedOffline: false },
    {
      ingestSale: async (payload) => {
        ingestCalls += 1;
        return {
          id: "cloud-1",
          eventId: payload.eventId,
          txnLabel: "TXN-CLOUD1",
          total: payload.total,
          subtotal: payload.subtotal,
          discount: payload.discount,
          idempotent: false,
        };
      },
    },
  );
  assert(online.queued === false, "healthy online must not queue");
  assert(ingestCalls === 1, "online path must call ingestSale once");
  assert((await countUnsynced()) === 0, "online success must not enqueue");
  assert((await stockOf("b-stock")) === 100, "online ingest must not local-delta stock");
}

async function main() {
  checkSource();
  await checkHelper();
  console.log("smoke-m4c PASS", {
    queuedOffline: true,
    queuedForced: true,
    fourxxNoQueue: true,
    fivexxQueue: true,
    onlineIngest: true,
  });
}

main().catch((err) => {
  console.error("smoke-m4c FAIL", err);
  process.exit(1);
});
