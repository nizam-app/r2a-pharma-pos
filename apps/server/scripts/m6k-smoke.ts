/**
 * Milestone 6 Batch K smoke — Owner product details API.
 *
 * Usage (server must already be running):
 *   npm run smoke:m6k -w @r2a/server
 *
 * Live API: owner 200 on GET /owner/products/:productId with Napa lots,
 * FEFO rank (sellable by expiry), units, events. Cashier/Manager 403.
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
  const token =
    typeof data?.accessToken === "string" ? data.accessToken : null;
  const user = asRecord(data?.user);
  const storeId = typeof user?.storeId === "string" ? user.storeId : null;
  return { token, storeId, status: res.status, body: res.body };
}

async function main(): Promise<void> {
  console.log(`M6K smoke → ${API}\n`);

  const routerPath = path.join(
    __dirname,
    "../src/modules/owner/owner.router.ts",
  );
  const routerSrc = fs.readFileSync(routerPath, "utf8");
  if (
    routerSrc.includes('restrictTo("OWNER")') &&
    routerSrc.includes("/products/:productId") &&
    routerSrc.includes("productDetail")
  ) {
    pass("1. Source restrictTo OWNER on GET /owner/products/:productId");
  } else {
    fail("1. Source restrictTo OWNER on GET /owner/products/:productId");
  }

  const health = await req("/health");
  const healthData = asRecord(health.body.data);
  if (health.status === 200 && healthData?.ok === true) {
    pass("2. Health envelope");
  } else {
    fail("2. Health envelope", JSON.stringify(health.body));
    return finish();
  }

  const owner = await login(SEED.ownerEmail);
  if (owner.status === 200 && owner.token) {
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

  const unauth = await req("/owner/products/any");
  if (unauth.status === 401) {
    pass("4. Unauthenticated GET /owner/products/:id is 401");
  } else {
    fail(
      "4. Unauthenticated GET /owner/products/:id is 401",
      JSON.stringify({ status: unauth.status }),
    );
  }

  const list = await req("/owner/inventory?q=NAPA-500&limit=10", {
    token: owner.token!,
  });
  const listData = asRecord(list.body.data);
  const items = Array.isArray(listData?.items) ? listData.items : [];
  const napa = items.map(asRecord).find((row) => {
    const sku = typeof row?.sku === "string" ? row.sku : "";
    return sku === "NAPA-500";
  });
  const productId = typeof napa?.productId === "string" ? napa.productId : null;
  if (list.status === 200 && productId) {
    pass("5. Resolve Napa productId from inventory", productId);
  } else {
    fail("5. Resolve Napa productId from inventory", JSON.stringify(list.body));
    return finish();
  }

  const cashierDet = await req(`/owner/products/${productId}`, {
    token: cashier.token!,
  });
  const managerDet = await req(`/owner/products/${productId}`, {
    token: manager.token!,
  });
  if (cashierDet.status === 403 && managerDet.status === 403) {
    pass("6. Cashier/Manager GET /owner/products/:id is 403");
  } else {
    fail(
      "6. Cashier/Manager GET /owner/products/:id is 403",
      JSON.stringify({
        cashier: cashierDet.status,
        manager: managerDet.status,
      }),
    );
  }

  const detail = await req(`/owner/products/${productId}`, {
    token: owner.token!,
  });
  const data = asRecord(detail.body.data);
  const batches = Array.isArray(data?.batches) ? data.batches : [];
  const units = Array.isArray(data?.units) ? data.units : [];
  const events = Array.isArray(data?.events) ? data.events : [];
  const kpis = asRecord(data?.kpis);
  const fefo = asRecord(data?.fefo);
  const lotNums = batches
    .map(asRecord)
    .map((lot) => (typeof lot?.batchNumber === "string" ? lot.batchNumber : ""))
    .filter(Boolean);
  const rank1 = batches.map(asRecord).find((lot) => lot?.fefoRank === 1);
  const expired = batches
    .map(asRecord)
    .find((lot) => lot?.batchNumber === "NP23010");
  const unitTypes = units
    .map(asRecord)
    .map((u) => (typeof u?.unitType === "string" ? u.unitType : ""))
    .filter(Boolean);

  if (
    detail.status === 200 &&
    data?.sku === "NAPA-500" &&
    typeof data?.id === "string" &&
    data.id === productId &&
    typeof kpis?.currentStock === "number" &&
    typeof kpis?.stockCostValue === "number" &&
    lotNums.includes("NP23091") &&
    lotNums.includes("NP24031") &&
    lotNums.includes("NP24052") &&
    lotNums.includes("NP23010") &&
    typeof rank1?.batchNumber === "string" &&
    rank1.batchNumber === fefo?.batchNumber &&
    rank1?.lifecycleStatus === "ACTIVE" &&
    typeof rank1?.version === "number" &&
    expired?.fefoRank == null &&
    unitTypes.includes("PIECE") &&
    unitTypes.includes("STRIP") &&
    unitTypes.includes("BOX") &&
    Array.isArray(events)
  ) {
    pass(
      "7. Owner GET /owner/products/:id 200 with Napa lots + FEFO rank",
      `stock=${kpis?.currentStock} fefo=${rank1?.batchNumber} events=${events.length}`,
    );
  } else {
    fail(
      "7. Owner GET /owner/products/:id 200 with Napa lots + FEFO rank",
      JSON.stringify(detail.body),
    );
  }

  const missing = await req("/owner/products/does-not-exist", {
    token: owner.token!,
  });
  if (missing.status === 404) {
    pass("8. Missing product is 404");
  } else {
    fail("8. Missing product is 404", JSON.stringify({ status: missing.status }));
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
