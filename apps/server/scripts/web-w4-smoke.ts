/** Owner Web Missing Features W4 live smoke - batch void/retire lifecycle. */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { prisma } from "@r2a/database";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
dotenv.config({ path: path.join(repoRoot, ".env") });

const BASE = (process.env.BASE_URL || "http://localhost:8787").replace(/\/$/, "");
const API = `${BASE}/api/v1`;
const password = process.env.SEED_OWNER_PASSWORD || "ChangeMe123!";
const tenantSlug = "demo-pharmacy";

type Result = { name: string; ok: boolean; detail: string };
const results: Result[] = [];

function pass(name: string, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`PASS  ${name}${detail ? ` - ${detail}` : ""}`);
}

function fail(name: string, detail = "") {
  results.push({ name, ok: false, detail });
  console.error(`FAIL  ${name}${detail ? ` - ${detail}` : ""}`);
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

async function req(
  pathname: string,
  options: { method?: string; token?: string; body?: unknown } = {},
) {
  const response = await fetch(`${API}${pathname}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const body = (await response.json()) as Record<string, unknown>;
  return { status: response.status, body };
}

async function login(email: string) {
  const response = await req("/auth/login", {
    method: "POST",
    body: { email, password, tenantSlug },
  });
  const data = record(response.body.data);
  const user = record(data?.user);
  return {
    token: typeof data?.accessToken === "string" ? data.accessToken : null,
    tenantId: typeof user?.tenantId === "string" ? user.tenantId : null,
    storeId: typeof user?.storeId === "string" ? user.storeId : null,
  };
}

function lifecycleData(response: { body: Record<string, unknown> }) {
  const data = record(response.body.data);
  return {
    batch: record(data?.batch),
    event: record(data?.event),
    revision: record(data?.revision),
    idempotent: record(response.body.meta)?.idempotent === true,
  };
}

function saleBody(
  eventId: string,
  storeId: string,
  productId: string,
  batchId: string,
) {
  return {
    eventId,
    storeId,
    subtotal: 2,
    discount: 0,
    total: 2,
    items: [
      {
        productId,
        batchId,
        unitType: "PIECE",
        unitQty: 1,
        quantityBase: 1,
        unitPrice: 2,
        lineTotal: 2,
      },
    ],
    payments: [{ method: "CASH", amount: 2 }],
  };
}

async function main() {
  console.log(`Web missing features W4 smoke -> ${API}\n`);
  const owner = await login(process.env.SEED_OWNER_EMAIL || "owner@demo.local");
  const manager = await login(process.env.SEED_MANAGER_EMAIL || "manager@demo.local");
  const cashier = await login(process.env.SEED_CASHIER_EMAIL || "cashier@demo.local");
  if (!owner.token || !owner.tenantId || !owner.storeId || !manager.token || !cashier.token) {
    throw new Error("Seed Owner/Manager/Cashier login failed");
  }
  pass("Seed role logins");

  const stamp = Date.now();
  const createProduct = await req("/products", {
    method: "POST",
    token: owner.token,
    body: {
      name: `W4 Test Product ${stamp}`,
      sku: `W4-SKU-${stamp}`,
      units: [{ unitType: "PIECE", factorToBase: 1 }],
    },
  });
  const productId = record(createProduct.body.data)?.id;
  if (createProduct.status !== 201 || typeof productId !== "string") {
    throw new Error(`Could not create W4 product: ${JSON.stringify(createProduct.body)}`);
  }

  async function createBatch(batchNumber: string, expiryDate: string, quantity: number) {
    const response = await req("/batches", {
      method: "POST",
      token: owner.token!,
      body: {
        productId,
        storeId: owner.storeId,
        batchNumber,
        expiryDate,
        quantityOnHand: quantity,
        costPerBase: 1,
        sellPerBase: 2,
      },
    });
    const id = record(response.body.data)?.id;
    if (response.status !== 201 || typeof id !== "string") {
      throw new Error(`Could not create W4 batch: ${JSON.stringify(response.body)}`);
    }
    return id;
  }

  const voidBatchId = await createBatch(`W4-VOID-${stamp}`, "2030-01-01", 7);
  const retireBatchId = await createBatch(`W4-RETIRE-${stamp}`, "2030-02-01", 10);
  pass("Two ACTIVE lifecycle test batches created");

  const initialFefo = await req(`/products/${productId}/fefo-batch`, {
    token: owner.token,
  });
  record(initialFefo.body.data)?.id === voidBatchId
    ? pass("Earlier ACTIVE batch is initial FEFO")
    : fail("Initial FEFO selection", JSON.stringify(initialFefo.body));

  const deniedBody = {
    operationId: `w4-denied-${stamp}`,
    expectedVersion: 0,
    reason: "Only an owner may change lifecycle",
  };
  const [managerVoid, cashierRetire] = await Promise.all([
    req(`/batches/${voidBatchId}/void`, {
      method: "POST",
      token: manager.token,
      body: deniedBody,
    }),
    req(`/batches/${retireBatchId}/retire`, {
      method: "POST",
      token: cashier.token,
      body: deniedBody,
    }),
  ]);
  managerVoid.status === 403 && cashierRetire.status === 403
    ? pass("Manager/Cashier lifecycle mutations rejected (403)")
    : fail("Lifecycle RBAC", `${managerVoid.status}/${cashierRetire.status}`);

  const hiddenLifecycle = await req(`/batches/missing-${stamp}/void`, {
    method: "POST",
    token: owner.token,
    body: {
      operationId: `w4-hidden-${stamp}`,
      expectedVersion: 0,
      reason: "Missing or cross-tenant batches stay hidden",
    },
  });
  hiddenLifecycle.status === 404
    ? pass("Missing/cross-tenant lifecycle target is hidden (404)")
    : fail("Lifecycle tenant scope", `status=${hiddenLifecycle.status}`);

  const voidOperationId = `w4-void-${stamp}`;
  const voidBody = {
    operationId: voidOperationId,
    expectedVersion: 0,
    reason: "Received duplicate lot in error",
  };
  const voided = await req(`/batches/${voidBatchId}/void`, {
    method: "POST",
    token: owner.token,
    body: voidBody,
  });
  const voidResult = lifecycleData(voided);
  if (
    voided.status === 200 &&
    voidResult.batch?.status === "VOIDED" &&
    voidResult.batch?.quantityOnHand === 0 &&
    voidResult.batch?.version === 1 &&
    voidResult.event?.quantityBaseChange === -7 &&
    voidResult.event?.quantityAfter === 0 &&
    voidResult.event?.reasonCode === "BATCH_VOID" &&
    voidResult.revision?.action === "VOID" &&
    !voidResult.idempotent
  ) {
    pass("Never-sold batch voided with compensating event and revision");
  } else {
    fail("Void transition", JSON.stringify(voided.body));
  }

  const replayVoid = await req(`/batches/${voidBatchId}/void`, {
    method: "POST",
    token: owner.token,
    body: voidBody,
  });
  const [voidRevisionCount, voidEventCount, receiveCount] = await Promise.all([
    prisma.batchRevision.count({ where: { operationId: voidOperationId } }),
    prisma.inventoryEvent.count({ where: { eventId: voidOperationId } }),
    prisma.inventoryEvent.count({
      where: { batchId: voidBatchId, type: "RECEIVE" },
    }),
  ]);
  replayVoid.status === 200 &&
  lifecycleData(replayVoid).idempotent &&
  voidRevisionCount === 1 &&
  voidEventCount === 1 &&
  receiveCount === 1
    ? pass("Void replay is idempotent and RECEIVE history remains")
    : fail(
        "Void replay/history",
        `${replayVoid.status}/${voidRevisionCount}/${voidEventCount}/${receiveCount}`,
      );

  const afterVoidFefo = await req(`/products/${productId}/fefo-batch`, {
    token: owner.token,
  });
  record(afterVoidFefo.body.data)?.id === retireBatchId
    ? pass("VOIDED batch excluded from FEFO")
    : fail("Post-void FEFO", JSON.stringify(afterVoidFefo.body));

  const voidedSale = await req("/sales/ingest", {
    method: "POST",
    token: owner.token,
    body: saleBody(
      `w4-voided-online-${stamp}`,
      owner.storeId,
      productId,
      voidBatchId,
    ),
  });
  voidedSale.status === 409 && /voided.*refresh catalog/i.test(String(voidedSale.body.message))
    ? pass("Explicit sale against VOIDED batch rejected actionably")
    : fail("Voided sale rejection", JSON.stringify(voidedSale.body));

  const saleEventId = `w4-sale-${stamp}`;
  const sale = await req("/sales/ingest", {
    method: "POST",
    token: owner.token,
    body: saleBody(saleEventId, owner.storeId, productId, retireBatchId),
  });
  [200, 201].includes(sale.status)
    ? pass("Sale reference created on second batch")
    : fail("Create lifecycle test sale", JSON.stringify(sale.body));

  const soldBeforeLifecycle = await prisma.batch.findUniqueOrThrow({
    where: { id: retireBatchId },
  });
  const soldVoid = await req(`/batches/${retireBatchId}/void`, {
    method: "POST",
    token: owner.token,
    body: {
      operationId: `w4-sold-void-${stamp}`,
      expectedVersion: soldBeforeLifecycle.version,
      reason: "Sold batch must not be voided",
    },
  });
  soldVoid.status === 409 && /retire/i.test(String(soldVoid.body.message))
    ? pass("Sold batch cannot be voided (409)")
    : fail("Sold batch void rejection", JSON.stringify(soldVoid.body));

  const retireOperationId = `w4-retire-${stamp}`;
  const retireBody = {
    operationId: retireOperationId,
    expectedVersion: soldBeforeLifecycle.version,
    reason: "Remove sold lot from available inventory",
  };
  const retired = await req(`/batches/${retireBatchId}/retire`, {
    method: "POST",
    token: owner.token,
    body: retireBody,
  });
  const retireResult = lifecycleData(retired);
  if (
    retired.status === 200 &&
    retireResult.batch?.status === "RETIRED" &&
    retireResult.batch?.quantityOnHand === 0 &&
    retireResult.batch?.version === soldBeforeLifecycle.version + 1 &&
    retireResult.event?.quantityBaseChange === -soldBeforeLifecycle.quantityOnHand &&
    retireResult.event?.reasonCode === "BATCH_RETIRE" &&
    retireResult.revision?.action === "RETIRE"
  ) {
    pass("Sold batch retired with remaining stock removed atomically");
  } else {
    fail("Retire transition", JSON.stringify(retired.body));
  }

  const replayRetire = await req(`/batches/${retireBatchId}/retire`, {
    method: "POST",
    token: owner.token,
    body: retireBody,
  });
  lifecycleData(replayRetire).idempotent
    ? pass("Retire replay is idempotent")
    : fail("Retire replay", JSON.stringify(replayRetire.body));

  const preserved = await prisma.batch.findUniqueOrThrow({
    where: { id: retireBatchId },
    include: {
      _count: { select: { saleItems: true, inventoryEvents: true } },
    },
  });
  preserved._count.saleItems === 1 && preserved._count.inventoryEvents >= 3
    ? pass("Retire preserves SaleItem and inventory history")
    : fail(
        "Retire history preservation",
        `sales=${preserved._count.saleItems} events=${preserved._count.inventoryEvents}`,
      );

  const rejectedSale = await req("/sales/ingest", {
    method: "POST",
    token: owner.token,
    body: saleBody(
      `w4-retired-online-${stamp}`,
      owner.storeId,
      productId,
      retireBatchId,
    ),
  });
  rejectedSale.status === 409 && /retired.*refresh catalog/i.test(String(rejectedSale.body.message))
    ? pass("Explicit online sale against RETIRED batch rejected actionably")
    : fail("Retired online sale rejection", JSON.stringify(rejectedSale.body));

  const syncEventId = `w4-retired-sync-${stamp}`;
  const rejectedSync = await req("/sync/ingest", {
    method: "POST",
    token: owner.token,
    body: {
      events: [
        {
          event_id: syncEventId,
          entity_type: "sale",
          action: "create",
          payload: saleBody(
            syncEventId,
            owner.storeId,
            productId,
            retireBatchId,
          ),
        },
      ],
    },
  });
  const syncResults = record(rejectedSync.body.data)?.results;
  const firstSyncResult = Array.isArray(syncResults) ? record(syncResults[0]) : null;
  rejectedSync.status === 200 &&
  firstSyncResult?.status === "rejected" &&
  /retired.*refresh catalog/i.test(String(firstSyncResult?.message))
    ? pass("Offline queued sale receives actionable rejection")
    : fail("Retired sync rejection", JSON.stringify(rejectedSync.body));

  const [noFefo, activeList, deleteAttempt] = await Promise.all([
    req(`/products/${productId}/fefo-batch`, { token: owner.token }),
    req(`/batches?productId=${productId}&limit=100&offset=0`, {
      token: cashier.token,
    }),
    req(`/batches/${retireBatchId}`, {
      method: "DELETE",
      token: owner.token,
    }),
  ]);
  const listed = Array.isArray(activeList.body.data) ? activeList.body.data : [];
  noFefo.status === 404 && listed.length === 0
    ? pass("Non-ACTIVE batches excluded from FEFO and POS batch list")
    : fail("Lifecycle list exclusion", `${noFefo.status}/${listed.length}`);
  deleteAttempt.status === 404
    ? pass("No hard-delete batch route exists")
    : fail("Hard-delete route absence", `status=${deleteAttempt.status}`);

  const retiredCorrection = await req(`/batches/${retireBatchId}/corrections`, {
    method: "POST",
    token: owner.token,
    body: {
      operationId: `w4-retired-correction-${stamp}`,
      expectedVersion: preserved.version,
      reason: "Inactive lot cannot be corrected",
      sellPerBase: 3,
    },
  });
  const retiredAdjustment = await req(`/batches/${retireBatchId}/adjustments`, {
    method: "POST",
    token: owner.token,
    body: {
      eventId: `w4-retired-adjustment-${stamp}`,
      expectedVersion: preserved.version,
      quantityChange: 1,
      reasonCode: "OTHER",
    },
  });
  retiredCorrection.status === 409 && retiredAdjustment.status === 409
    ? pass("Retired batch cannot be corrected or restocked")
    : fail(
        "Inactive mutation rejection",
        `${retiredCorrection.status}/${retiredAdjustment.status}`,
      );

  await req(`/products/${productId}`, {
    method: "PATCH",
    token: owner.token,
    body: { isActive: false },
  });

  const failed = results.filter((result) => !result.ok);
  console.log(`\nResults: ${results.length - failed.length}/${results.length} PASS`);
  if (failed.length) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
