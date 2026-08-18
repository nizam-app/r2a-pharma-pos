/** Owner Web Missing Features W6 live smoke - signed desktop adjustment contract. */

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
    storeId: typeof user?.storeId === "string" ? user.storeId : null,
  };
}

function mutationBatch(response: { body: Record<string, unknown> }) {
  return record(record(response.body.data)?.batch);
}

async function main() {
  console.log(`Web missing features W6 smoke -> ${API}\n`);
  const owner = await login(process.env.SEED_OWNER_EMAIL || "owner@demo.local");
  const manager = await login(process.env.SEED_MANAGER_EMAIL || "manager@demo.local");
  const cashier = await login(process.env.SEED_CASHIER_EMAIL || "cashier@demo.local");
  if (!owner.token || !owner.storeId || !manager.token || !cashier.token) {
    throw new Error("Seed Owner/Manager/Cashier login failed");
  }
  pass("Seed role logins");

  const stamp = Date.now();
  const createProduct = await req("/products", {
    method: "POST",
    token: owner.token,
    body: {
      name: `W6 Test Product ${stamp}`,
      sku: `W6-SKU-${stamp}`,
      units: [{ unitType: "PIECE", factorToBase: 1 }],
    },
  });
  const productId = record(createProduct.body.data)?.id;
  if (createProduct.status !== 201 || typeof productId !== "string") {
    throw new Error(`Could not create W6 product: ${JSON.stringify(createProduct.body)}`);
  }

  const createBatch = await req("/batches", {
    method: "POST",
    token: owner.token,
    body: {
      productId,
      storeId: owner.storeId,
      batchNumber: `W6-BATCH-${stamp}`,
      expiryDate: "2030-12-31",
      quantityOnHand: 10,
      costPerBase: 1,
      sellPerBase: 2,
    },
  });
  const createdBatch = record(createBatch.body.data);
  const batchId = typeof createdBatch?.id === "string" ? createdBatch.id : null;
  if (createBatch.status !== 201 || !batchId || createdBatch?.version !== 0) {
    throw new Error(`Could not create W6 batch: ${JSON.stringify(createBatch.body)}`);
  }
  pass("Versioned batch fixture created", batchId);

  const legacyPatch = await req(`/batches/${batchId}`, {
    method: "PATCH",
    token: owner.token,
    body: { quantityOnHand: 99 },
  });
  const afterLegacy = await prisma.batch.findUniqueOrThrow({ where: { id: batchId } });
  legacyPatch.status === 400 &&
  afterLegacy.quantityOnHand === 10 &&
  afterLegacy.version === 0
    ? pass("Legacy absolute quantity PATCH rejected without mutation")
    : fail(
        "Legacy absolute quantity PATCH",
        `${legacyPatch.status}/qty=${afterLegacy.quantityOnHand}/v=${afterLegacy.version}`,
      );

  const eventId = `w6-owner-adjust-${stamp}`;
  const ownerBody = {
    eventId,
    expectedVersion: 0,
    quantityChange: 4,
    reasonCode: "COUNT_CORRECTION",
    note: "W6 signed desktop contract smoke",
  };
  const ownerAdjustment = await req(`/batches/${batchId}/adjustments`, {
    method: "POST",
    token: owner.token,
    body: ownerBody,
  });
  const ownerBatch = mutationBatch(ownerAdjustment);
  const event = await prisma.inventoryEvent.findUnique({ where: { eventId } });
  if (
    ownerAdjustment.status === 200 &&
    ownerBatch?.quantityOnHand === 14 &&
    ownerBatch?.version === 1 &&
    event?.quantityBaseChange === 4 &&
    event.quantityAfter === 14 &&
    event.reasonCode === "COUNT_CORRECTION"
  ) {
    pass("Owner signed adjustment records delta, result, reason, and version");
  } else {
    fail("Owner signed adjustment", JSON.stringify(ownerAdjustment.body));
  }

  const replay = await req(`/batches/${batchId}/adjustments`, {
    method: "POST",
    token: owner.token,
    body: ownerBody,
  });
  const replayCount = await prisma.inventoryEvent.count({ where: { eventId } });
  record(replay.body.meta)?.idempotent === true && replayCount === 1
    ? pass("Transport retry with the same eventId is idempotent")
    : fail("Adjustment replay", `${replay.status}/events=${replayCount}`);

  const changedReplay = await req(`/batches/${batchId}/adjustments`, {
    method: "POST",
    token: owner.token,
    body: { ...ownerBody, quantityChange: 5 },
  });
  changedReplay.status === 409
    ? pass("Reused eventId with changed payload rejected (409)")
    : fail("Changed-payload eventId reuse", `status=${changedReplay.status}`);

  const stale = await req(`/batches/${batchId}/adjustments`, {
    method: "POST",
    token: owner.token,
    body: {
      eventId: `w6-stale-${stamp}`,
      expectedVersion: 0,
      quantityChange: 1,
      reasonCode: "OTHER",
    },
  });
  stale.status === 409
    ? pass("Stale desktop version rejected without retry (409)")
    : fail("Stale version rejection", `status=${stale.status}`);

  const negative = await req(`/batches/${batchId}/adjustments`, {
    method: "POST",
    token: owner.token,
    body: {
      eventId: `w6-negative-${stamp}`,
      expectedVersion: 1,
      quantityChange: -99,
      reasonCode: "DAMAGE",
    },
  });
  negative.status === 409
    ? pass("Negative-result adjustment rejected (409)")
    : fail("Negative-result rejection", `status=${negative.status}`);

  const managerAdjustment = await req(`/batches/${batchId}/adjustments`, {
    method: "POST",
    token: manager.token,
    body: {
      eventId: `w6-manager-${stamp}`,
      expectedVersion: 1,
      quantityChange: -2,
      reasonCode: "DAMAGE",
    },
  });
  const managerBatch = mutationBatch(managerAdjustment);
  managerAdjustment.status === 200 &&
  managerBatch?.quantityOnHand === 12 &&
  managerBatch?.version === 2
    ? pass("Manager signed adjustment allowed")
    : fail("Manager signed adjustment", JSON.stringify(managerAdjustment.body));

  const concurrentEventId = `w6-concurrent-${stamp}`;
  const concurrentBody = {
    eventId: concurrentEventId,
    expectedVersion: 2,
    quantityChange: 1,
    reasonCode: "COUNT_CORRECTION",
  };
  const [concurrentA, concurrentB] = await Promise.all([
    req(`/batches/${batchId}/adjustments`, {
      method: "POST",
      token: owner.token,
      body: concurrentBody,
    }),
    req(`/batches/${batchId}/adjustments`, {
      method: "POST",
      token: owner.token,
      body: concurrentBody,
    }),
  ]);
  const concurrentBatch = await prisma.batch.findUniqueOrThrow({
    where: { id: batchId },
  });
  const concurrentEventCount = await prisma.inventoryEvent.count({
    where: { eventId: concurrentEventId },
  });
  if (
    concurrentA.status === 200 &&
    concurrentB.status === 200 &&
    concurrentBatch.quantityOnHand === 13 &&
    concurrentBatch.version === 3 &&
    concurrentEventCount === 1
  ) {
    pass("Concurrent same-event transport retries apply exactly once");
  } else {
    fail(
      "Concurrent same-event retries",
      `${concurrentA.status}/${concurrentB.status}/qty=${concurrentBatch.quantityOnHand}/v=${concurrentBatch.version}/events=${concurrentEventCount}`,
    );
  }

  const cashierAdjustment = await req(`/batches/${batchId}/adjustments`, {
    method: "POST",
    token: cashier.token,
    body: {
      eventId: `w6-cashier-${stamp}`,
      expectedVersion: 3,
      quantityChange: 1,
      reasonCode: "OTHER",
    },
  });
  cashierAdjustment.status === 403
    ? pass("Cashier signed adjustment rejected (403)")
    : fail("Cashier adjustment RBAC", `status=${cashierAdjustment.status}`);

  const hidden = await req(`/batches/missing-${stamp}/adjustments`, {
    method: "POST",
    token: owner.token,
    body: {
      eventId: `w6-hidden-${stamp}`,
      expectedVersion: 0,
      quantityChange: 1,
      reasonCode: "OTHER",
    },
  });
  hidden.status === 404
    ? pass("Missing/cross-tenant adjustment target hidden (404)")
    : fail("Adjustment tenant scope", `status=${hidden.status}`);

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
