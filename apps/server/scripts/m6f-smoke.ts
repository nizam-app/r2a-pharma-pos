/**
 * Milestone 6 Batch F smoke — Owner dashboard / inventory-summary / expiry APIs.
 *
 * Usage (server must already be running):
 *   npm run smoke:m6f -w @r2a/server
 *
 * Live API: owner 200 on all three; cashier/manager 403. Does not start Dashboard UI (Batch G).
 */

import fs from "node:fs";
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

async function login(email: string): Promise<{
  token: string | null;
  storeId: string | null;
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
    status: res.status,
    body: res.body,
  };
}

async function main(): Promise<void> {
  console.log(`M6F smoke → ${API}\n`);

  const routerPath = path.join(
    __dirname,
    "../src/modules/owner/owner.router.ts",
  );
  const routerSrc = fs.readFileSync(routerPath, "utf8");
  if (
    routerSrc.includes('restrictTo("OWNER")') &&
    routerSrc.includes("/dashboard") &&
    routerSrc.includes("/inventory-summary") &&
    routerSrc.includes("/expiry")
  ) {
    pass("1. Source restrictTo OWNER on all three routes");
  } else {
    fail("1. Source restrictTo OWNER on all three routes");
  }

  const health = await req("/health");
  const healthData = asRecord(health.body.data);
  if (health.status === 200 && healthData?.ok === true) {
    pass("2. Health envelope");
  } else {
    fail("2. Health envelope", JSON.stringify(health.body));
    return finish();
  }

  const unauth = await req("/owner/dashboard");
  if (unauth.status === 401) {
    pass("3. GET /owner/dashboard without token is 401");
  } else {
    fail("3. GET /owner/dashboard without token is 401", `status=${unauth.status}`);
  }

  const owner = await login(SEED.ownerEmail);
  if (owner.status === 200 && owner.token && owner.storeId) {
    pass("4a. Owner login", SEED.ownerEmail);
  } else {
    fail("4a. Owner login", JSON.stringify(owner.body));
    return finish();
  }

  const cashier = await login(SEED.cashierEmail);
  if (cashier.status === 200 && cashier.token) {
    pass("4b. Cashier login", SEED.cashierEmail);
  } else {
    fail("4b. Cashier login", JSON.stringify(cashier.body));
    return finish();
  }

  const manager = await login(SEED.managerEmail);
  if (manager.status === 200 && manager.token) {
    pass("4c. Manager login", SEED.managerEmail);
  } else {
    fail("4c. Manager login", JSON.stringify(manager.body));
    return finish();
  }

  const cashierDash = await req("/owner/dashboard", { token: cashier.token });
  const cashierSum = await req("/owner/inventory-summary", {
    token: cashier.token,
  });
  const cashierExp = await req("/owner/expiry", { token: cashier.token });
  if (
    cashierDash.status === 403 &&
    cashierSum.status === 403 &&
    cashierExp.status === 403
  ) {
    pass("5. Cashier GET /owner/* is 403");
  } else {
    fail(
      "5. Cashier GET /owner/* is 403",
      JSON.stringify({
        dashboard: cashierDash.status,
        summary: cashierSum.status,
        expiry: cashierExp.status,
      }),
    );
  }

  const managerDash = await req("/owner/dashboard", { token: manager.token });
  const managerSum = await req("/owner/inventory-summary", {
    token: manager.token,
  });
  const managerExp = await req("/owner/expiry", { token: manager.token });
  if (
    managerDash.status === 403 &&
    managerSum.status === 403 &&
    managerExp.status === 403
  ) {
    pass("6. Manager GET /owner/* is 403");
  } else {
    fail(
      "6. Manager GET /owner/* is 403",
      JSON.stringify({
        dashboard: managerDash.status,
        summary: managerSum.status,
        expiry: managerExp.status,
      }),
    );
  }

  const search = await req("/products?q=Napa&limit=5", { token: owner.token });
  const products = Array.isArray(search.body.data) ? search.body.data : [];
  const product = asRecord(products[0]);
  const productId = typeof product?.id === "string" ? product.id : null;
  if (productId) {
    pass("7a. Seed Napa product", productId);
  } else {
    fail("7a. Seed Napa product", JSON.stringify(search.body));
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
  const unitPrice =
    typeof sellBatch?.sellPerBase === "number" ? sellBatch.sellPerBase : 1.2;
  if (batchId) {
    pass("7b. In-stock batch", batchId);
  } else {
    fail("7b. In-stock batch", JSON.stringify(batches.body));
    return finish();
  }

  const stamp = Date.now();
  const eventId = `m6f-sale-${stamp}`;
  const ingest = await req("/sales/ingest", {
    method: "POST",
    token: owner.token,
    body: {
      eventId,
      storeId: owner.storeId,
      subtotal: unitPrice,
      discount: 0,
      total: unitPrice,
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
          fefoAuthorizedByName: "M6F Smoke",
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
    pass("7c. Ingest fixture sale", receiptNo);
  } else {
    fail("7c. Ingest fixture sale", JSON.stringify(ingest.body));
    return finish();
  }

  const expiredBatchNo = `M6F-EXP-${stamp}`;
  const createdLot = await req("/batches", {
    method: "POST",
    token: owner.token,
    body: {
      productId,
      storeId: owner.storeId,
      batchNumber: expiredBatchNo,
      expiryDate: "2024-01-15",
      quantityOnHand: 7,
      costPerBase: 1.1,
      sellPerBase: unitPrice,
    },
  });
  const createdLotData = asRecord(createdLot.body.data);
  if (createdLot.status === 201 && createdLotData?.id) {
    pass("7d. Expired lot fixture", expiredBatchNo);
  } else {
    fail("7d. Expired lot fixture", JSON.stringify(createdLot.body));
    return finish();
  }

  const dash = await req("/owner/dashboard", { token: owner.token });
  const dashData = asRecord(dash.body.data);
  const kpis = asRecord(dashData?.kpis);
  const today = asRecord(kpis?.today);
  const vs = asRecord(kpis?.vsYesterday);
  const period = asRecord(kpis?.period);
  const range = asRecord(dashData?.range);
  const bars = Array.isArray(dashData?.dailyBars) ? dashData.dailyBars : [];
  const healthInv = asRecord(dashData?.inventoryHealth);
  const fefo = asRecord(dashData?.fefoOverrides);
  const recent = Array.isArray(dashData?.recentSales)
    ? dashData.recentSales
    : [];
  const recentHit = recent.map(asRecord).find((row) => row?.id === saleId);
  if (
    dash.status === 200 &&
    dash.body.status === "success" &&
    typeof range?.from === "string" &&
    typeof range?.to === "string" &&
    typeof today?.sales === "number" &&
    typeof today?.netProfit === "number" &&
    typeof today?.txnCount === "number" &&
    typeof today?.avgSale === "number" &&
    vs &&
    typeof period?.sales === "number" &&
    bars.length === 7 &&
    typeof healthInv?.lowStock === "number" &&
    typeof healthInv?.outOfStock === "number" &&
    typeof fefo?.today === "number" &&
    fefo.today >= 1 &&
    typeof fefo.week === "number" &&
    typeof dashData?.expiringStockValue === "number" &&
    recentHit &&
    recentHit.receiptNo === receiptNo
  ) {
    pass(
      "8. Owner GET /owner/dashboard 200",
      `todayTxn=${today.txnCount} bars=${bars.length} fefoToday=${fefo.today}`,
    );
  } else {
    fail("8. Owner GET /owner/dashboard 200", JSON.stringify(dash.body));
  }

  const summary = await req("/owner/inventory-summary", { token: owner.token });
  const sumData = asRecord(summary.body.data);
  const totals = asRecord(sumData?.totals);
  if (
    summary.status === 200 &&
    typeof totals?.productCount === "number" &&
    totals.productCount >= 5 &&
    typeof totals.onHandPieces === "number" &&
    typeof totals.costValue === "number" &&
    totals.costValue > 0 &&
    typeof sumData?.lowStockCount === "number" &&
    typeof sumData?.outOfStockCount === "number" &&
    typeof sumData?.expiring30dCount === "number" &&
    typeof sumData?.expiring90dCount === "number" &&
    typeof sumData?.expiredCount === "number" &&
    (sumData.expiredCount as number) >= 1
  ) {
    pass(
      "9. Owner GET /owner/inventory-summary 200",
      `products=${totals.productCount} cost=${totals.costValue} expired=${sumData.expiredCount}`,
    );
  } else {
    fail(
      "9. Owner GET /owner/inventory-summary 200",
      JSON.stringify(summary.body),
    );
  }

  const expired = await req("/owner/expiry?bucket=expired", {
    token: owner.token,
  });
  const expiredData = asRecord(expired.body.data);
  const expiredCounts = asRecord(expiredData?.counts);
  const expiredRows = Array.isArray(expiredData?.rows) ? expiredData.rows : [];
  const expiredHit = expiredRows
    .map(asRecord)
    .find((row) => row?.batchNumber === expiredBatchNo);
  const hasSupplier = expiredRows.some((row) => {
    const rec = asRecord(row);
    return rec != null && ("supplier" in rec || "returnEligibility" in rec);
  });
  if (
    expired.status === 200 &&
    expiredData?.bucket === "expired" &&
    typeof expiredCounts?.expired === "number" &&
    (expiredCounts.expired as number) >= 1 &&
    typeof expiredCounts["0_30"] === "number" &&
    typeof expiredCounts["31_60"] === "number" &&
    typeof expiredCounts["61_90"] === "number" &&
    expiredHit &&
    typeof expiredHit.productName === "string" &&
    typeof expiredHit.fefoRank === "number" &&
    typeof expiredHit.costValue === "number" &&
    !hasSupplier
  ) {
    pass(
      "10. Owner GET /owner/expiry?bucket=expired",
      `${expiredBatchNo} rank=${expiredHit.fefoRank}`,
    );
  } else {
    fail(
      "10. Owner GET /owner/expiry?bucket=expired",
      JSON.stringify(expired.body),
    );
  }

  const near = await req("/owner/expiry?bucket=0_30", { token: owner.token });
  const nearData = asRecord(near.body.data);
  const nearRows = Array.isArray(nearData?.rows) ? nearData.rows : [];
  const nearHit = nearRows
    .map(asRecord)
    .find((row) => row?.batchNumber === "NP23091");
  if (near.status === 200 && nearHit) {
    pass("11. Owner GET /owner/expiry?bucket=0_30 includes NP23091");
  } else {
    fail(
      "11. Owner GET /owner/expiry?bucket=0_30 includes NP23091",
      JSON.stringify(near.body),
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
