/**
 * Milestone 6 Batch D smoke — ingest extensions + InventoryEvent.
 *
 * Usage (server must already be running):
 *   npm run smoke:m6d -w @r2a/server
 *
 * Live API: loyalty + FEFO persist; old payload still 201; RECEIVE/ADJUST events;
 * idempotent replay does not double-apply loyalty or SALE events.
 * Does not start GET /sales (Batch E).
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { prisma } from "@r2a/database";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
dotenv.config({ path: path.join(repoRoot, ".env") });

const BASE = (process.env.BASE_URL || "http://localhost:8787").replace(
  /\/$/,
  "",
);
const API = `${BASE}/api/v1`;

const SEED = {
  ownerEmail: process.env.SEED_OWNER_EMAIL || "owner@demo.local",
  cashierEmail: process.env.SEED_CASHIER_EMAIL || "cashier@demo.local",
  password: process.env.SEED_OWNER_PASSWORD || "ChangeMe123!",
  tenantSlug: "demo-pharmacy",
};

type Result = { name: string; ok: boolean; detail: string };
const results: Result[] = [];

function pass(name: string, detail = ""): void {
  results.push({ name, ok: true, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name: string, detail = ""): void {
  results.push({ name, ok: false, detail });
  console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function req(
  pathname: string,
  opts: { method?: string; body?: unknown; token?: string } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await fetch(`${API}${pathname}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed as Record<string, unknown> };
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function receiptOk(v: unknown): boolean {
  return typeof v === "string" && /^TXN-\d{6}-\d{4}(-[A-Z0-9]+)?$/.test(v);
}

async function main(): Promise<void> {
  console.log(`M6D smoke → ${API}\n`);

  const health = await req("/health");
  const healthData = asRecord(health.body.data);
  if (health.status === 200 && healthData?.ok === true) {
    pass("1. Health envelope");
  } else {
    fail("1. Health envelope", JSON.stringify(health.body));
    return finish();
  }

  const ownerLogin = await req("/auth/login", {
    method: "POST",
    body: {
      email: SEED.ownerEmail,
      password: SEED.password,
      tenantSlug: SEED.tenantSlug,
    },
  });
  const ownerData = asRecord(ownerLogin.body.data);
  const ownerUser = asRecord(ownerData?.user);
  const ownerToken =
    typeof ownerData?.accessToken === "string" ? ownerData.accessToken : null;
  const storeId =
    typeof ownerUser?.storeId === "string" ? ownerUser.storeId : null;
  if (ownerLogin.status === 200 && ownerToken && storeId) {
    pass("2a. Owner login", SEED.ownerEmail);
  } else {
    fail("2a. Owner login", JSON.stringify(ownerLogin.body));
    return finish();
  }

  const cashierLogin = await req("/auth/login", {
    method: "POST",
    body: {
      email: SEED.cashierEmail,
      password: SEED.password,
      tenantSlug: SEED.tenantSlug,
    },
  });
  const cashierData = asRecord(cashierLogin.body.data);
  const cashierToken =
    typeof cashierData?.accessToken === "string"
      ? cashierData.accessToken
      : null;
  if (cashierLogin.status === 200 && cashierToken) {
    pass("2b. Cashier login", SEED.cashierEmail);
  } else {
    fail("2b. Cashier login", JSON.stringify(cashierLogin.body));
    return finish();
  }

  const search = await req("/products?q=Napa&limit=5", { token: ownerToken });
  const products = Array.isArray(search.body.data) ? search.body.data : [];
  const product = asRecord(products[0]);
  const productId = typeof product?.id === "string" ? product.id : null;
  if (productId) {
    pass("2c. Seed Napa product", productId);
  } else {
    fail("2c. Seed Napa product", JSON.stringify(search.body));
    return finish();
  }

  const batches = await req(
    `/batches?productId=${productId}&storeId=${storeId}&limit=20`,
    { token: ownerToken },
  );
  const batchRows = Array.isArray(batches.body.data) ? batches.body.data : [];
  const inStock = batchRows
    .map(asRecord)
    .filter(
      (b): b is Record<string, unknown> =>
        Boolean(b) && typeof b.quantityOnHand === "number" && b.quantityOnHand >= 2,
    );
  const sellBatch = inStock[0] ?? asRecord(batchRows[0]);
  const batchId = typeof sellBatch?.id === "string" ? sellBatch.id : null;
  const costPerBase =
    typeof sellBatch?.costPerBase === "number" ? sellBatch.costPerBase : null;
  const unitPrice =
    typeof sellBatch?.sellPerBase === "number" ? sellBatch.sellPerBase : 1.2;
  if (batchId && costPerBase != null) {
    pass("2d. In-stock batch + cost", `cost=${costPerBase}`);
  } else {
    fail("2d. In-stock batch + cost", JSON.stringify(batches.body));
    return finish();
  }

  const stamp = Date.now();
  const createdCust = await req("/customers", {
    method: "POST",
    token: ownerToken,
    body: {
      name: "M6D Smoke Customer",
      phone: `019${String(stamp).slice(-8)}`,
    },
  });
  const cust = asRecord(createdCust.body.data);
  const customerId = typeof cust?.id === "string" ? cust.id : null;
  if (createdCust.status === 201 && customerId) {
    pass("3a. Smoke customer created", customerId);
  } else {
    fail("3a. Smoke customer created", JSON.stringify(createdCust.body));
    return finish();
  }

  const loyaltyEventId = `m6d-loyalty-${stamp}`;
  const loyaltyIngest = await req("/sales/ingest", {
    method: "POST",
    token: ownerToken,
    body: {
      eventId: loyaltyEventId,
      storeId,
      customerId,
      subtotal: unitPrice,
      discount: 0,
      total: unitPrice,
      loyaltyUsed: 0,
      loyaltyEarned: 1,
      items: [
        {
          productId,
          batchId,
          unitType: "PIECE",
          unitQty: 1,
          quantityBase: 1,
          unitPrice,
          lineTotal: unitPrice,
          fefoOverride: true,
          fefoAuthorizedByName: "Smoke Manager",
        },
      ],
      payments: [{ method: "CASH", amount: unitPrice }],
    },
  });
  const loyaltySale = asRecord(loyaltyIngest.body.data);
  const loyaltyItems = Array.isArray(loyaltySale?.items)
    ? loyaltySale.items.map(asRecord)
    : [];
  const loyaltyLine = loyaltyItems[0];
  const saleId = typeof loyaltySale?.id === "string" ? loyaltySale.id : null;
  if (
    loyaltyIngest.status === 201 &&
    receiptOk(loyaltySale?.receiptNo) &&
    loyaltySale?.loyaltyPrevious === 0 &&
    loyaltySale?.loyaltyUsed === 0 &&
    loyaltySale?.loyaltyEarned === 1 &&
    loyaltyLine?.fefoOverride === true &&
    loyaltyLine?.fefoAuthorizedByName === "Smoke Manager" &&
    loyaltyLine?.costPerBaseAtSale === costPerBase
  ) {
    pass(
      "3b. Ingest loyalty + FEFO + cost + receiptNo",
      String(loyaltySale?.receiptNo),
    );
  } else {
    fail(
      "3b. Ingest loyalty + FEFO + cost + receiptNo",
      JSON.stringify(loyaltyIngest.body),
    );
  }

  const custAfter = await req(`/customers/${customerId}`, { token: ownerToken });
  const custAfterData = asRecord(custAfter.body.data);
  if (custAfter.status === 200 && custAfterData?.loyaltyPoints === 1) {
    pass("3c. Customer loyaltyPoints applied", "0 → 1");
  } else {
    fail("3c. Customer loyaltyPoints applied", JSON.stringify(custAfter.body));
  }

  if (saleId) {
    const saleEvents = await prisma.inventoryEvent.findMany({
      where: { saleId, type: "SALE" },
    });
    if (
      saleEvents.length === 1 &&
      saleEvents[0]?.quantityBaseChange === -1
    ) {
      pass("3d. SALE InventoryEvent written", saleId);
    } else {
      fail(
        "3d. SALE InventoryEvent written",
        `count=${saleEvents.length} delta=${saleEvents[0]?.quantityBaseChange}`,
      );
    }
  } else {
    fail("3d. SALE InventoryEvent written", "no saleId");
  }

  const replay = await req("/sales/ingest", {
    method: "POST",
    token: ownerToken,
    body: {
      eventId: loyaltyEventId,
      storeId,
      customerId,
      subtotal: unitPrice,
      discount: 0,
      total: unitPrice,
      loyaltyUsed: 0,
      loyaltyEarned: 1,
      items: [
        {
          productId,
          batchId,
          unitType: "PIECE",
          unitQty: 1,
          quantityBase: 1,
          unitPrice,
          lineTotal: unitPrice,
          fefoOverride: true,
          fefoAuthorizedByName: "Smoke Manager",
        },
      ],
      payments: [{ method: "CASH", amount: unitPrice }],
    },
  });
  const replayMeta = asRecord(replay.body.meta);
  const custReplay = await req(`/customers/${customerId}`, { token: ownerToken });
  const custReplayData = asRecord(custReplay.body.data);
  const saleEventsReplay = saleId
    ? await prisma.inventoryEvent.findMany({
        where: { saleId, type: "SALE" },
      })
    : [];
  if (
    replay.status === 200 &&
    replayMeta?.idempotent === true &&
    custReplayData?.loyaltyPoints === 1 &&
    saleEventsReplay.length === 1
  ) {
    pass("4. Idempotent replay does not double-apply");
  } else {
    fail(
      "4. Idempotent replay does not double-apply",
      JSON.stringify({
        status: replay.status,
        meta: replay.body.meta,
        points: custReplayData?.loyaltyPoints,
        events: saleEventsReplay.length,
      }),
    );
  }

  const oldEventId = `m6d-old-${stamp}`;
  const oldIngest = await req("/sales/ingest", {
    method: "POST",
    token: ownerToken,
    body: {
      eventId: oldEventId,
      storeId,
      subtotal: unitPrice,
      discount: 0,
      total: unitPrice,
      items: [
        {
          productId,
          unitType: "PIECE",
          unitQty: 1,
          quantityBase: 1,
          unitPrice,
          lineTotal: unitPrice,
        },
      ],
      payments: [{ method: "CASH", amount: unitPrice }],
    },
  });
  const oldSale = asRecord(oldIngest.body.data);
  const oldLine = Array.isArray(oldSale?.items)
    ? asRecord(oldSale.items[0])
    : null;
  if (
    (oldIngest.status === 201 || oldIngest.status === 200) &&
    receiptOk(oldSale?.receiptNo) &&
    oldSale?.loyaltyPrevious === 0 &&
    oldSale?.loyaltyUsed === 0 &&
    oldSale?.loyaltyEarned === 0 &&
    oldLine?.fefoOverride === false
  ) {
    pass("5. Old payload without loyalty/FEFO still succeeds", String(oldSale?.receiptNo));
  } else {
    fail("5. Old payload without loyalty/FEFO still succeeds", JSON.stringify(oldIngest.body));
  }

  const lotNo = `M6D-${stamp}`;
  const receive = await req("/batches", {
    method: "POST",
    token: ownerToken,
    body: {
      productId,
      storeId,
      batchNumber: lotNo,
      expiryDate: "2028-12-31",
      quantityOnHand: 7,
      costPerBase: 0.5,
      sellPerBase: 1.2,
    },
  });
  const received = asRecord(receive.body.data);
  const receivedId = typeof received?.id === "string" ? received.id : null;
  if (receive.status === 201 && receivedId) {
    const recvEvents = await prisma.inventoryEvent.findMany({
      where: { batchId: receivedId, type: "RECEIVE" },
    });
    if (
      recvEvents.length === 1 &&
      recvEvents[0]?.quantityBaseChange === 7 &&
      recvEvents[0]?.actorUserId
    ) {
      pass("6a. POST /batches writes RECEIVE event", lotNo);
    } else {
      fail(
        "6a. POST /batches writes RECEIVE event",
        `count=${recvEvents.length} delta=${recvEvents[0]?.quantityBaseChange}`,
      );
    }
  } else {
    fail("6a. POST /batches writes RECEIVE event", JSON.stringify(receive.body));
  }

  if (receivedId) {
    const adjust = await req(`/batches/${receivedId}`, {
      method: "PATCH",
      token: ownerToken,
      body: { quantityOnHand: 10 },
    });
    const adjEvents = await prisma.inventoryEvent.findMany({
      where: { batchId: receivedId, type: "ADJUST" },
    });
    if (
      adjust.status === 200 &&
      adjEvents.length === 1 &&
      adjEvents[0]?.quantityBaseChange === 3
    ) {
      pass("6b. PATCH qty writes ADJUST delta", "+3");
    } else {
      fail(
        "6b. PATCH qty writes ADJUST delta",
        JSON.stringify({
          status: adjust.status,
          count: adjEvents.length,
          delta: adjEvents[0]?.quantityBaseChange,
        }),
      );
    }
  } else {
    fail("6b. PATCH qty writes ADJUST delta", "no received batch");
  }

  const cashierEventId = `m6d-cashier-${stamp}`;
  const cashierIngest = await req("/sales/ingest", {
    method: "POST",
    token: cashierToken,
    body: {
      eventId: cashierEventId,
      storeId,
      subtotal: unitPrice,
      discount: 0,
      total: unitPrice,
      items: [
        {
          productId,
          unitType: "PIECE",
          unitQty: 1,
          quantityBase: 1,
          unitPrice,
          lineTotal: unitPrice,
        },
      ],
      payments: [{ method: "CASH", amount: unitPrice }],
    },
  });
  const cashierSale = asRecord(cashierIngest.body.data);
  const cashierLine = Array.isArray(cashierSale?.items)
    ? asRecord(cashierSale.items[0])
    : null;
  if (
    (cashierIngest.status === 201 || cashierIngest.status === 200) &&
    receiptOk(cashierSale?.receiptNo) &&
    cashierLine &&
    !Object.prototype.hasOwnProperty.call(cashierLine, "costPerBaseAtSale")
  ) {
    pass("7. Cashier ingest omits costPerBaseAtSale");
  } else {
    fail("7. Cashier ingest omits costPerBaseAtSale", JSON.stringify(cashierIngest.body));
  }

  const syncEventId = `m6d-sync-${stamp}`;
  const syncIngest = await req("/sync/ingest", {
    method: "POST",
    token: ownerToken,
    body: {
      events: [
        {
          event_id: syncEventId,
          entity_type: "sale",
          action: "create",
          payload: {
            eventId: syncEventId,
            storeId,
            subtotal: unitPrice,
            discount: 0,
            total: unitPrice,
            items: [
              {
                productId,
                unitType: "PIECE",
                unitQty: 1,
                quantityBase: 1,
                unitPrice,
                lineTotal: unitPrice,
              },
            ],
            payments: [{ method: "CASH", amount: unitPrice }],
          },
        },
      ],
    },
  });
  const syncData = asRecord(syncIngest.body.data);
  const syncResults = Array.isArray(syncData?.results) ? syncData.results : [];
  const syncRow = asRecord(syncResults[0]);
  const syncSale = asRecord(syncRow?.sale);
  if (
    syncIngest.status === 200 &&
    syncRow?.status === "accepted" &&
    receiptOk(syncSale?.receiptNo)
  ) {
    pass("8. /sync/ingest old payload still accepted", String(syncSale?.receiptNo));
  } else {
    fail("8. /sync/ingest old payload still accepted", JSON.stringify(syncIngest.body));
  }

  await finish();
}

async function finish(): Promise<void> {
  try {
    await prisma.$disconnect();
  } catch {
    // ignore
  }
  const failed = results.filter((r) => !r.ok);
  console.log("\n--- Summary ---");
  console.log(`Passed: ${results.filter((r) => r.ok).length}/${results.length}`);
  if (failed.length) {
    console.log("Failed:");
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
    process.exitCode = 1;
  } else {
    console.log("All checklist items passed.");
  }
}

main().catch(async (err) => {
  console.error(err);
  try {
    await prisma.$disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
