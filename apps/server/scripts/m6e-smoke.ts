/**
 * Milestone 6 Batch E smoke — GET /sales list + detail.
 *
 * Usage (server must already be running):
 *   npm run smoke:m6e -w @r2a/server
 *
 * Live API: owner list/detail 200 with cost; cashier/manager 200 without cost keys;
 * 401 without token. Does not start Owner web sales UI (Batch H).
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

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
  managerEmail: process.env.SEED_MANAGER_EMAIL || "manager@demo.local",
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

const COST_KEYS = new Set([
  "costPerBase",
  "costPerBaseAtSale",
  "cogs",
  "lineCogs",
  "saleCogs",
  "netProfit",
  "margin",
  "lineMargin",
  "marginPercent",
]);

function findCostKeys(value: unknown, path = "$"): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => findCostKeys(item, `${path}[${i}]`));
  }
  const rec = asRecord(value);
  if (!rec) return [];
  const hits: string[] = [];
  for (const [key, nested] of Object.entries(rec)) {
    if (COST_KEYS.has(key)) hits.push(`${path}.${key}`);
    hits.push(...findCostKeys(nested, `${path}.${key}`));
  }
  return hits;
}

async function login(email: string): Promise<{
  token: string | null;
  storeId: string | null;
  userId: string | null;
  status: number;
  body: Record<string, unknown>;
}> {
  const res = await req("/auth/login", {
    method: "POST",
    body: {
      email,
      password: SEED.password,
      tenantSlug: SEED.tenantSlug,
    },
  });
  const data = asRecord(res.body.data);
  const user = asRecord(data?.user);
  return {
    token: typeof data?.accessToken === "string" ? data.accessToken : null,
    storeId: typeof user?.storeId === "string" ? user.storeId : null,
    userId: typeof user?.id === "string" ? user.id : null,
    status: res.status,
    body: res.body,
  };
}

async function main(): Promise<void> {
  console.log(`M6E smoke → ${API}\n`);

  const health = await req("/health");
  const healthData = asRecord(health.body.data);
  if (health.status === 200 && healthData?.ok === true) {
    pass("1. Health envelope");
  } else {
    fail("1. Health envelope", JSON.stringify(health.body));
    return finish();
  }

  const unauth = await req("/sales?limit=5");
  if (unauth.status === 401) {
    pass("2. GET /sales without token is 401");
  } else {
    fail("2. GET /sales without token is 401", `status=${unauth.status}`);
  }

  const owner = await login(SEED.ownerEmail);
  if (owner.status === 200 && owner.token && owner.storeId) {
    pass("3a. Owner login", SEED.ownerEmail);
  } else {
    fail("3a. Owner login", JSON.stringify(owner.body));
    return finish();
  }

  const cashier = await login(SEED.cashierEmail);
  if (cashier.status === 200 && cashier.token) {
    pass("3b. Cashier login", SEED.cashierEmail);
  } else {
    fail("3b. Cashier login", JSON.stringify(cashier.body));
    return finish();
  }

  const manager = await login(SEED.managerEmail);
  if (manager.status === 200 && manager.token) {
    pass("3c. Manager login", SEED.managerEmail);
  } else {
    fail("3c. Manager login", JSON.stringify(manager.body));
    return finish();
  }

  const search = await req("/products?q=Napa&limit=5", { token: owner.token });
  const products = Array.isArray(search.body.data) ? search.body.data : [];
  const product = asRecord(products[0]);
  const productId = typeof product?.id === "string" ? product.id : null;
  if (productId) {
    pass("4a. Seed Napa product", productId);
  } else {
    fail("4a. Seed Napa product", JSON.stringify(search.body));
    return finish();
  }

  const batches = await req(
    `/batches?productId=${productId}&storeId=${owner.storeId}&limit=20`,
    { token: owner.token },
  );
  const batchRows = Array.isArray(batches.body.data) ? batches.body.data : [];
  const inStock = batchRows
    .map(asRecord)
    .filter(
      (b): b is Record<string, unknown> =>
        b != null &&
        typeof b.quantityOnHand === "number" &&
        b.quantityOnHand >= 1,
    );
  const sellBatch = inStock[0] ?? asRecord(batchRows[0]);
  const batchId = typeof sellBatch?.id === "string" ? sellBatch.id : null;
  const costPerBase =
    typeof sellBatch?.costPerBase === "number" ? sellBatch.costPerBase : null;
  const unitPrice =
    typeof sellBatch?.sellPerBase === "number" ? sellBatch.sellPerBase : 1.2;
  if (batchId && costPerBase != null) {
    pass("4b. In-stock batch + cost", `cost=${costPerBase}`);
  } else {
    fail("4b. In-stock batch + cost", JSON.stringify(batches.body));
    return finish();
  }

  const stamp = Date.now();
  const createdCust = await req("/customers", {
    method: "POST",
    token: owner.token,
    body: {
      name: "M6E Smoke Customer",
      phone: `018${String(stamp).slice(-8)}`,
    },
  });
  const cust = asRecord(createdCust.body.data);
  const customerId = typeof cust?.id === "string" ? cust.id : null;
  if (createdCust.status === 201 && customerId) {
    pass("4c. Smoke customer created", customerId);
  } else {
    fail("4c. Smoke customer created", JSON.stringify(createdCust.body));
    return finish();
  }

  const eventId = `m6e-sale-${stamp}`;
  const ingest = await req("/sales/ingest", {
    method: "POST",
    token: owner.token,
    body: {
      eventId,
      storeId: owner.storeId,
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
  const ingested = asRecord(ingest.body.data);
  const saleId = typeof ingested?.id === "string" ? ingested.id : null;
  const receiptNo =
    typeof ingested?.receiptNo === "string" ? ingested.receiptNo : null;
  if ((ingest.status === 201 || ingest.status === 200) && saleId && receiptNo) {
    pass("4d. Ingest fixture sale", receiptNo);
  } else {
    fail("4d. Ingest fixture sale", JSON.stringify(ingest.body));
    return finish();
  }

  const ownerList = await req("/sales?limit=25", { token: owner.token });
  const ownerRows = Array.isArray(ownerList.body.data) ? ownerList.body.data : [];
  const ownerMeta = asRecord(ownerList.body.meta);
  const ownerHit = ownerRows.map(asRecord).find((row) => row?.id === saleId);
  const ownerHitLine = Array.isArray(ownerHit?.items)
    ? asRecord(ownerHit.items[0])
    : null;
  if (
    ownerList.status === 200 &&
    ownerList.body.status === "success" &&
    typeof ownerMeta?.total === "number" &&
    ownerMeta.total >= 1 &&
    ownerHit &&
    ownerHit.receiptNo === receiptNo &&
    typeof ownerHit.cogs === "number" &&
    typeof ownerHit.netProfit === "number" &&
    ownerHitLine?.costPerBaseAtSale === costPerBase &&
    typeof ownerHitLine.lineCogs === "number"
  ) {
    pass(
      "5. Owner GET /sales 200 with cost",
      `total=${ownerMeta.total} cogs=${ownerHit.cogs}`,
    );
  } else {
    fail("5. Owner GET /sales 200 with cost", JSON.stringify(ownerList.body));
  }

  const cashierList = await req("/sales?limit=25", { token: cashier.token });
  const cashierHits = findCostKeys(cashierList.body.data);
  const cashierMeta = asRecord(cashierList.body.meta);
  const cashierRows = Array.isArray(cashierList.body.data)
    ? cashierList.body.data
    : [];
  const cashierHit = cashierRows.map(asRecord).find((row) => row?.id === saleId);
  if (
    cashierList.status === 200 &&
    typeof cashierMeta?.total === "number" &&
    cashierHit &&
    cashierHits.length === 0
  ) {
    pass("6. Cashier GET /sales 200 without cost keys");
  } else {
    fail(
      "6. Cashier GET /sales 200 without cost keys",
      JSON.stringify({
        status: cashierList.status,
        costKeys: cashierHits,
        hasSale: Boolean(cashierHit),
      }),
    );
  }

  const managerList = await req("/sales?limit=25", { token: manager.token });
  const managerHits = findCostKeys(managerList.body.data);
  if (managerList.status === 200 && managerHits.length === 0) {
    pass("7. Manager GET /sales 200 without cost keys");
  } else {
    fail(
      "7. Manager GET /sales 200 without cost keys",
      JSON.stringify({ status: managerList.status, costKeys: managerHits }),
    );
  }

  const ownerDetail = await req(`/sales/${saleId}`, { token: owner.token });
  const ownerSale = asRecord(ownerDetail.body.data);
  const ownerLine = Array.isArray(ownerSale?.items)
    ? asRecord(ownerSale.items[0])
    : null;
  const ownerProduct = asRecord(ownerLine?.product);
  const ownerCustomer = asRecord(ownerSale?.customer);
  const ownerCashier = asRecord(ownerSale?.cashier);
  if (
    ownerDetail.status === 200 &&
    ownerSale?.id === saleId &&
    ownerSale.receiptNo === receiptNo &&
    ownerCustomer?.name === "M6E Smoke Customer" &&
    typeof ownerCashier?.name === "string" &&
    ownerProduct?.name &&
    ownerLine?.fefoOverride === true &&
    ownerSale.loyaltyEarned === 1 &&
    ownerLine.costPerBaseAtSale === costPerBase &&
    typeof ownerSale.cogs === "number" &&
    typeof ownerSale.netProfit === "number"
  ) {
    pass("8. Owner GET /sales/:id includes names, loyalty, FEFO, cost");
  } else {
    fail(
      "8. Owner GET /sales/:id includes names, loyalty, FEFO, cost",
      JSON.stringify(ownerDetail.body),
    );
  }

  const cashierDetail = await req(`/sales/${saleId}`, { token: cashier.token });
  const cashierSale = asRecord(cashierDetail.body.data);
  const cashierCostHits = findCostKeys(cashierDetail.body.data);
  if (
    cashierDetail.status === 200 &&
    cashierSale?.id === saleId &&
    cashierCostHits.length === 0
  ) {
    pass("9. Cashier GET /sales/:id 200 without cost keys");
  } else {
    fail(
      "9. Cashier GET /sales/:id 200 without cost keys",
      JSON.stringify({
        status: cashierDetail.status,
        costKeys: cashierCostHits,
      }),
    );
  }

  const byReceipt = await req(`/sales/${encodeURIComponent(receiptNo)}`, {
    token: owner.token,
  });
  if (byReceipt.status === 404) {
    pass("10. GET /sales/:id is Sale.id (receiptNo is 404)");
  } else {
    fail(
      "10. GET /sales/:id is Sale.id (receiptNo is 404)",
      `status=${byReceipt.status}`,
    );
  }

  await finish();
}

async function finish(): Promise<void> {
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
