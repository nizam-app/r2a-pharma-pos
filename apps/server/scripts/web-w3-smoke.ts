/** Owner Web Missing Features W3 live smoke — batch corrections/adjustments. */

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
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name: string, detail = "") {
  results.push({ name, ok: false, detail });
  console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
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
    status: response.status,
    token: typeof data?.accessToken === "string" ? data.accessToken : null,
    tenantId: typeof user?.tenantId === "string" ? user.tenantId : null,
    storeId: typeof user?.storeId === "string" ? user.storeId : null,
  };
}

function metaIdempotent(response: { body: Record<string, unknown> }): boolean {
  return record(response.body.meta)?.idempotent === true;
}

async function main() {
  console.log(`Web missing features W3 smoke → ${API}\n`);
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
      name: `W3 Test Product ${stamp}`,
      sku: `W3-SKU-${stamp}`,
      units: [{ unitType: "PIECE", factorToBase: 1 }],
    },
  });
  const productId = record(createProduct.body.data)?.id;
  if (createProduct.status !== 201 || typeof productId !== "string") {
    throw new Error(`Could not create W3 product: ${JSON.stringify(createProduct.body)}`);
  }

  const createBatch = await req("/batches", {
    method: "POST",
    token: owner.token,
    body: {
      productId,
      storeId: owner.storeId,
      batchNumber: `W3-BATCH-${stamp}`,
      expiryDate: "2029-12-31",
      quantityOnHand: 20,
      costPerBase: 1,
      sellPerBase: 2,
      supplierName: "W3 Supplier A",
      returnStatus: "NOT_ELIGIBLE",
    },
  });
  const batch = record(createBatch.body.data);
  const batchId = typeof batch?.id === "string" ? batch.id : null;
  if (createBatch.status !== 201 || !batchId || batch?.version !== 0 || batch?.status !== "ACTIVE") {
    throw new Error(`Could not create versioned W3 batch: ${JSON.stringify(createBatch.body)}`);
  }
  pass("Versioned ACTIVE batch created", batchId);

  const ownerDetail = await req(`/owner/batches/${batchId}`, { token: owner.token });
  const detail = record(ownerDetail.body.data);
  if (
    ownerDetail.status === 200 &&
    detail?.version === 0 &&
    detail?.canVoid === true &&
    detail?.supplierName === "W3 Supplier A" &&
    detail?.returnStatus === "NOT_ELIGIBLE" &&
    Array.isArray(detail?.adjustments) &&
    Array.isArray(detail?.revisions)
  ) {
    pass("OWNER batch detail includes management context");
  } else {
    fail("OWNER batch detail", JSON.stringify(ownerDetail.body));
  }

  const cashierDetail = await req(`/owner/batches/${batchId}`, { token: cashier.token });
  cashierDetail.status === 403
    ? pass("Cashier owner-batch detail rejected (403)")
    : fail("Cashier owner-batch detail", `status=${cashierDetail.status}`);

  const otherTenantBatch = await prisma.batch.findFirst({
    where: { tenantId: { not: owner.tenantId } },
    select: { id: true },
  });
  const hiddenId = otherTenantBatch?.id ?? `missing-${stamp}`;
  const hiddenDetail = await req(`/owner/batches/${hiddenId}`, { token: owner.token });
  hiddenDetail.status === 404
    ? pass("Other-tenant/missing batch is hidden (404)")
    : fail("Tenant-scoped batch detail", `status=${hiddenDetail.status}`);

  const cashierCorrection = await req(`/batches/${batchId}/corrections`, {
    method: "POST",
    token: cashier.token,
    body: {
      operationId: `w3-cashier-correction-${stamp}`,
      expectedVersion: 0,
      reason: "Cashier must be denied",
      sellPerBase: 3,
    },
  });
  const cashierAdjustment = await req(`/batches/${batchId}/adjustments`, {
    method: "POST",
    token: cashier.token,
    body: {
      eventId: `w3-cashier-adjust-${stamp}`,
      expectedVersion: 0,
      quantityChange: 1,
      reasonCode: "OTHER",
    },
  });
  cashierCorrection.status === 403 && cashierAdjustment.status === 403
    ? pass("Cashier correction and adjustment rejected (403)")
    : fail("Cashier mutation RBAC", `${cashierCorrection.status}/${cashierAdjustment.status}`);

  const correctionOperationId = `w3-correction-${stamp}`;
  const correctionBody = {
    operationId: correctionOperationId,
    expectedVersion: 0,
    reason: "Correct initial receiving prices",
    costPerBase: 1.25,
    sellPerBase: 2.5,
    supplierName: "W3 Supplier B",
    returnStatus: "ELIGIBLE",
  };
  const correction = await req(`/batches/${batchId}/corrections`, {
    method: "POST",
    token: owner.token,
    body: correctionBody,
  });
  const correctedBatch = record(record(correction.body.data)?.batch);
  const correctedRevision = record(record(correction.body.data)?.revision);
  const beforeSnapshot = record(correctedRevision?.before);
  const afterSnapshot = record(correctedRevision?.after);
  if (
    correction.status === 200 &&
    correctedBatch?.version === 1 &&
    correctedBatch?.costPerBase === 1.25 &&
    correctedBatch?.sellPerBase === 2.5 &&
    correctedBatch?.supplierName === "W3 Supplier B" &&
    correctedBatch?.returnStatus === "ELIGIBLE" &&
    beforeSnapshot?.supplierName === "W3 Supplier A" &&
    beforeSnapshot?.returnStatus === "NOT_ELIGIBLE" &&
    afterSnapshot?.supplierName === "W3 Supplier B" &&
    afterSnapshot?.returnStatus === "ELIGIBLE" &&
    !metaIdempotent(correction)
  ) {
    pass("Audited batch correction snapshots supplier/return metadata");
  } else {
    fail("Price correction", JSON.stringify(correction.body));
  }

  const replayCorrection = await req(`/batches/${batchId}/corrections`, {
    method: "POST",
    token: owner.token,
    body: correctionBody,
  });
  const revisionCount = await prisma.batchRevision.count({
    where: { operationId: correctionOperationId },
  });
  replayCorrection.status === 200 && metaIdempotent(replayCorrection) && revisionCount === 1
    ? pass("Correction replay is idempotent")
    : fail("Correction replay", `status=${replayCorrection.status} revisions=${revisionCount}`);

  const staleCorrection = await req(`/batches/${batchId}/corrections`, {
    method: "POST",
    token: owner.token,
    body: {
      operationId: `w3-stale-correction-${stamp}`,
      expectedVersion: 0,
      reason: "Stale correction should fail",
      sellPerBase: 3,
    },
  });
  staleCorrection.status === 409
    ? pass("Stale correction rejected (409)")
    : fail("Stale correction", `status=${staleCorrection.status}`);

  const adjustmentEventId = `w3-adjust-${stamp}`;
  const adjustmentBody = {
    eventId: adjustmentEventId,
    expectedVersion: 1,
    quantityChange: 5,
    reasonCode: "COUNT_CORRECTION",
    note: "Counted five additional pieces",
  };
  const adjustment = await req(`/batches/${batchId}/adjustments`, {
    method: "POST",
    token: owner.token,
    body: adjustmentBody,
  });
  const adjustedBatch = record(record(adjustment.body.data)?.batch);
  if (
    adjustment.status === 200 &&
    adjustedBatch?.quantityOnHand === 25 &&
    adjustedBatch?.version === 2 &&
    !metaIdempotent(adjustment)
  ) {
    pass("Signed adjustment atomically updates quantity/version");
  } else {
    fail("Signed adjustment", JSON.stringify(adjustment.body));
  }

  const replayAdjustment = await req(`/batches/${batchId}/adjustments`, {
    method: "POST",
    token: owner.token,
    body: adjustmentBody,
  });
  const adjustmentCount = await prisma.inventoryEvent.count({
    where: { eventId: adjustmentEventId },
  });
  replayAdjustment.status === 200 && metaIdempotent(replayAdjustment) && adjustmentCount === 1
    ? pass("Adjustment replay is idempotent")
    : fail("Adjustment replay", `status=${replayAdjustment.status} events=${adjustmentCount}`);

  const negative = await req(`/batches/${batchId}/adjustments`, {
    method: "POST",
    token: owner.token,
    body: {
      eventId: `w3-negative-${stamp}`,
      expectedVersion: 2,
      quantityChange: -999,
      reasonCode: "COUNT_CORRECTION",
    },
  });
  negative.status === 409
    ? pass("Negative-stock adjustment rejected (409)")
    : fail("Negative-stock adjustment", `status=${negative.status}`);

  const concurrentAdjustmentBody = {
    eventId: `w3-concurrent-adjust-${stamp}`,
    expectedVersion: 2,
    quantityChange: 2,
    reasonCode: "COUNT_CORRECTION",
  };
  const [concurrentAdjustment, concurrentSale] = await Promise.all([
    req(`/batches/${batchId}/adjustments`, {
      method: "POST",
      token: owner.token,
      body: concurrentAdjustmentBody,
    }),
    req("/sales/ingest", {
      method: "POST",
      token: owner.token,
      body: {
        eventId: `w3-concurrent-sale-${stamp}`,
        storeId: owner.storeId,
        subtotal: 2.5,
        discount: 0,
        total: 2.5,
        items: [
          {
            productId,
            batchId,
            unitType: "PIECE",
            unitQty: 1,
            quantityBase: 1,
            unitPrice: 2.5,
            lineTotal: 2.5,
          },
        ],
        payments: [{ method: "CASH", amount: 2.5 }],
      },
    }),
  ]);
  const adjustmentApplied = concurrentAdjustment.status === 200;
  const latest = await prisma.batch.findUniqueOrThrow({ where: { id: batchId } });
  const expectedQty = 25 - 1 + (adjustmentApplied ? 2 : 0);
  if (
    [200, 409].includes(concurrentAdjustment.status) &&
    [200, 201].includes(concurrentSale.status) &&
    latest.quantityOnHand === expectedQty
  ) {
    pass("Concurrent sale/adjustment preserves exact stock", `qty=${latest.quantityOnHand}`);
  } else {
    fail(
      "Concurrent sale/adjustment",
      `adjust=${concurrentAdjustment.status} sale=${concurrentSale.status} qty=${latest.quantityOnHand} expected=${expectedQty}`,
    );
  }

  const managerAdjustment = await req(`/batches/${batchId}/adjustments`, {
    method: "POST",
    token: manager.token,
    body: {
      eventId: `w3-manager-adjust-${stamp}`,
      expectedVersion: latest.version,
      quantityChange: 1,
      reasonCode: "OTHER",
      note: "Manager permission smoke",
    },
  });
  managerAdjustment.status === 200
    ? pass("Manager signed adjustment allowed")
    : fail("Manager signed adjustment", `status=${managerAdjustment.status}`);

  const finalDetail = await req(`/owner/batches/${batchId}`, { token: owner.token });
  const finalData = record(finalDetail.body.data);
  if (
    finalDetail.status === 200 &&
    finalData?.canVoid === false &&
    Array.isArray(finalData?.adjustments) &&
    finalData.adjustments.length >= 2 &&
    Array.isArray(finalData?.revisions) &&
    finalData.revisions.length === 1
  ) {
    pass("Owner detail returns sale usage and correction/adjustment history");
  } else {
    fail("Final owner batch detail", JSON.stringify(finalDetail.body));
  }

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
