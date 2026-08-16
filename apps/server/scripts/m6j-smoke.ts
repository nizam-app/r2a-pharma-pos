/**
 * Milestone 6 Batch J smoke — Owner inventory list API.
 *
 * Usage (server must already be running):
 *   npm run smoke:m6j -w @r2a/server
 *
 * Live API: owner 200 on GET /owner/inventory; cashier/manager 403.
 * Napa from seed appears with live qty + cost/sell/margin.
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
  console.log(`M6J smoke → ${API}\n`);

  const routerPath = path.join(
    __dirname,
    "../src/modules/owner/owner.router.ts",
  );
  const routerSrc = fs.readFileSync(routerPath, "utf8");
  if (
    routerSrc.includes('restrictTo("OWNER")') &&
    routerSrc.includes("/inventory") &&
    routerSrc.includes("ownerInventoryQuerySchema")
  ) {
    pass("1. Source restrictTo OWNER on GET /owner/inventory");
  } else {
    fail("1. Source restrictTo OWNER on GET /owner/inventory");
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

  const cashierInv = await req("/owner/inventory", { token: cashier.token });
  const managerInv = await req("/owner/inventory", { token: manager.token });
  if (cashierInv.status === 403 && managerInv.status === 403) {
    pass("4. Cashier/Manager GET /owner/inventory is 403");
  } else {
    fail(
      "4. Cashier/Manager GET /owner/inventory is 403",
      JSON.stringify({
        cashier: cashierInv.status,
        manager: managerInv.status,
      }),
    );
  }

  const list = await req("/owner/inventory?tab=all&limit=25&offset=0", {
    token: owner.token,
  });
  const data = asRecord(list.body.data);
  const items = Array.isArray(data?.items) ? data.items : [];
  const tabs = asRecord(data?.tabs);
  const summary = asRecord(data?.summary);
  const attention = asRecord(data?.attention);
  const meta = asRecord(list.body.meta);
  const napa = items.map(asRecord).find((row) => {
    const name = typeof row?.name === "string" ? row.name : "";
    return name.toLowerCase().includes("napa");
  });
  const napaQty =
    typeof napa?.quantityOnHand === "number" ? napa.quantityOnHand : null;

  if (
    list.status === 200 &&
    typeof meta?.total === "number" &&
    (meta.total as number) >= 1 &&
    typeof tabs?.all === "number" &&
    typeof tabs?.low === "number" &&
    typeof tabs?.out === "number" &&
    typeof tabs?.expiring30 === "number" &&
    typeof tabs?.expiring90 === "number" &&
    typeof tabs?.expired === "number" &&
    typeof summary?.costValue === "number" &&
    typeof attention?.expiringStockValue90d === "number" &&
    napa &&
    napaQty != null &&
    napaQty > 0 &&
    typeof napa.costPerBase === "number" &&
    typeof napa.sellPerBase === "number" &&
    typeof napa.marginPct === "number"
  ) {
    pass(
      "5. Owner GET /owner/inventory 200 with Napa qty + cost",
      `napaQty=${napaQty} cost=${napa.costPerBase} sell=${napa.sellPerBase}`,
    );
  } else {
    fail(
      "5. Owner GET /owner/inventory 200 with Napa qty + cost",
      JSON.stringify(list.body),
    );
  }

  const search = await req("/owner/inventory?q=NAPA-500&limit=10", {
    token: owner.token,
  });
  const searchData = asRecord(search.body.data);
  const searchItems = Array.isArray(searchData?.items) ? searchData.items : [];
  const searchHit = searchItems.map(asRecord).some((row) => {
    const sku = typeof row?.sku === "string" ? row.sku : "";
    return sku === "NAPA-500";
  });
  if (search.status === 200 && searchHit) {
    pass("6. Search SKU NAPA-500 hits Napa");
  } else {
    fail("6. Search SKU NAPA-500 hits Napa", JSON.stringify(search.body));
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
