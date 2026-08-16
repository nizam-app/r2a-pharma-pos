/**
 * Milestone 6 Batch L smoke — Add Product API.
 *
 * Usage (server must already be running):
 *   npm run smoke:m6l -w @r2a/server
 *
 * Live API:
 * 1. Owner can create product via POST /api/v1/products with extended fields.
 * 2. New product has 0 initial batches and 0 on-hand stock.
 * 3. GET /owner/products/:id reflects the created product and 0 stock.
 * 4. Duplicate SKU / Barcode returns 409.
 * 5. Cashier role cannot create products (403).
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
  console.log(`M6L smoke → ${API}\n`);

  // 1. Log in as owner and cashier
  const owner = await login(SEED.ownerEmail);
  if (!owner.token) {
    fail("Owner login", `status=${owner.status}`);
    process.exit(1);
  }
  pass("Owner login", "got access token");

  const cashier = await login(SEED.cashierEmail);
  if (!cashier.token) {
    fail("Cashier login", `status=${cashier.status}`);
    process.exit(1);
  }
  pass("Cashier login", "got access token");

  // 2. Attempt creation by cashier (should 403)
  const ts = Date.now();
  const testSku = `SKU-TEST-${ts}`;
  const testBarcode = `BC-TEST-${ts}`;

  const cashierCreate = await req("/products", {
    method: "POST",
    token: cashier.token,
    body: {
      name: `Cashier Try ${ts}`,
      sku: testSku,
      units: [{ unitType: "PIECE", factorToBase: 1 }],
    },
  });

  if (cashierCreate.status === 403) {
    pass("Cashier POST /products rejected (403)", "RBAC guard active");
  } else {
    fail("Cashier POST /products", `expected 403, got ${cashierCreate.status}`);
  }

  // 3. Create product by Owner with all extended fields
  const createPayload = {
    name: `Test Medicine ${ts}`,
    genericName: "Paracetamol + Caffeine",
    manufacturer: "Beximco Pharmaceuticals Ltd.",
    strength: "500 mg + 65 mg",
    form: "Tablet",
    sku: testSku,
    barcode: testBarcode,
    category: "Analgesic & Antipyretic",
    description: "Smoke test catalog drug",
    requiresPrescription: true,
    coldChain: true,
    storageNotes: "Store below 25C in dry place",
    reorderLevel: 50,
    units: [
      { unitType: "PIECE", factorToBase: 1, label: "Piece" },
      { unitType: "STRIP", factorToBase: 10, label: "Strip" },
      { unitType: "BOX", factorToBase: 100, label: "Box" },
    ],
  };

  const createRes = await req("/products", {
    method: "POST",
    token: owner.token,
    body: createPayload,
  });

  if (createRes.status !== 201) {
    fail("Owner POST /products", `status=${createRes.status} body=${JSON.stringify(createRes.body)}`);
    process.exit(1);
  }

  const createdData = asRecord(createRes.body.data);
  const createdId = typeof createdData?.id === "string" ? createdData.id : null;
  if (!createdId) {
    fail("Owner POST /products response", "Missing product id in data");
    process.exit(1);
  }
  pass("Owner POST /products (201)", `Created product id: ${createdId}`);

  // 4. Verify duplicate SKU / Barcode 409
  const dupRes = await req("/products", {
    method: "POST",
    token: owner.token,
    body: {
      name: `Duplicate Try ${ts}`,
      sku: testSku,
      units: [{ unitType: "PIECE", factorToBase: 1 }],
    },
  });

  if (dupRes.status === 409) {
    pass("Duplicate SKU rejected with 409 Conflict", "Tenant uniqueness preserved");
  } else {
    fail("Duplicate SKU", `expected 409, got ${dupRes.status}`);
  }

  // 5. Query Owner Product Details to verify initial stock is 0 and fields saved
  const detailRes = await req(`/owner/products/${createdId}`, {
    token: owner.token,
  });

  if (detailRes.status !== 200) {
    fail(`GET /owner/products/${createdId}`, `status=${detailRes.status}`);
    process.exit(1);
  }

  const detailData = asRecord(detailRes.body.data);
  const kpis = asRecord(detailData?.kpis);
  const batches = Array.isArray(detailData?.batches) ? detailData.batches : null;
  const units = Array.isArray(detailData?.units) ? detailData.units : null;

  if (kpis?.currentStock === 0 && batches?.length === 0) {
    pass("Initial inventory verified", "0 pcs stock, 0 batches (no batch created)");
  } else {
    fail("Initial inventory", `expected 0 stock/batches, got stock=${kpis?.currentStock} batches=${batches?.length}`);
  }

  if (
    detailData?.coldChain === true &&
    detailData?.requiresPrescription === true &&
    detailData?.reorderLevel === 50 &&
    units?.length === 3
  ) {
    pass("Extended fields & packaging hierarchy persisted", "Rx=true, coldChain=true, reorderLevel=50, 3 units");
  } else {
    fail("Extended fields", JSON.stringify(detailData));
  }

  // Summary
  const failed = results.filter((r) => !r.ok);
  console.log(`\nResults: ${results.length - failed.length}/${results.length} PASS`);
  if (failed.length > 0) {
    console.error("Some checks failed!");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
