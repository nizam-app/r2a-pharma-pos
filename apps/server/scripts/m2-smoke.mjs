/**
 * Milestone 2 exit smoke checklist (Batch H).
 *
 * Usage (server must already be running, e.g. npm run dev -w @r2a/server):
 *   node apps/server/scripts/m2-smoke.mjs
 *   set BASE_URL=http://localhost:8787 && node apps/server/scripts/m2-smoke.mjs
 *
 * Prefers seeded owner (demo-pharmacy). Falls back to a temporary register tenant
 * if seed login fails — does NOT reset the database.
 */

const BASE = (process.env.BASE_URL || "http://localhost:8787").replace(/\/$/, "");
const API = `${BASE}/api/v1`;

const SEED = {
  email: process.env.SEED_OWNER_EMAIL || "owner@demo.local",
  password: process.env.SEED_OWNER_PASSWORD || "ChangeMe123!",
  tenantSlug: "demo-pharmacy",
};

const results = [];

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function req(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
}

function hasCost(obj) {
  if (!obj || typeof obj !== "object") return false;
  if (Object.prototype.hasOwnProperty.call(obj, "costPerBase")) return true;
  if (Object.prototype.hasOwnProperty.call(obj, "margin")) return true;
  if (Object.prototype.hasOwnProperty.call(obj, "profit")) return true;
  return false;
}

async function main() {
  console.log(`M2 smoke → ${API}\n`);

  // 1. Health
  const health = await req("/health");
  if (
    health.status === 200 &&
    health.body?.status === "success" &&
    health.body?.data?.ok === true
  ) {
    pass("1. Health envelope", `message=${health.body.message}`);
  } else {
    fail("1. Health envelope", JSON.stringify(health));
  }

  // 2. Login as seeded owner (fallback register)
  let ownerToken = null;
  let storeId = null;
  let tenantSlug = SEED.tenantSlug;
  let usedSeed = true;

  const login = await req("/auth/login", {
    method: "POST",
    body: {
      email: SEED.email,
      password: SEED.password,
      tenantSlug: SEED.tenantSlug,
    },
  });

  if (login.status === 200 && login.body?.data?.accessToken) {
    ownerToken = login.body.data.accessToken;
    storeId = login.body.data.user.storeId;
    pass("2. Seeded owner login", SEED.email);
  } else {
    usedSeed = false;
    const slug = `m2-smoke-${Date.now()}`;
    tenantSlug = slug;
    const reg = await req("/auth/register", {
      method: "POST",
      body: {
        name: "M2 Smoke Owner",
        email: `owner-${slug}@example.com`,
        password: "ChangeMe123!",
        tenantName: "M2 Smoke Pharmacy",
        tenantSlug: slug,
        storeName: "Main",
      },
    });
    if (reg.status === 201 && reg.body?.data?.accessToken) {
      ownerToken = reg.body.data.accessToken;
      storeId = reg.body.data.user.storeId;
      pass(
        "2. Owner auth (seed login failed — registered temp tenant)",
        slug,
      );
    } else {
      fail("2. Owner auth", JSON.stringify(reg.body));
      return finish();
    }
  }

  // Ensure product+batch exist for FEFO/sale when using temp tenant
  let productId = null;
  if (!usedSeed) {
    const product = await req("/products", {
      method: "POST",
      token: ownerToken,
      body: {
        name: "Napa 500mg",
        genericName: "Paracetamol",
        sku: `SMOKE-${Date.now()}`,
        units: [
          { unitType: "PIECE", factorToBase: 1 },
          { unitType: "STRIP", factorToBase: 10 },
        ],
      },
    });
    productId = product.body?.data?.id;
    await req("/batches", {
      method: "POST",
      token: ownerToken,
      body: {
        productId,
        storeId,
        batchNumber: "SMOKE-1",
        expiryDate: "2027-06-30",
        quantityOnHand: 200,
        costPerBase: 0.8,
        sellPerBase: 1.2,
      },
    });
  } else {
    const search = await req("/products?q=Napa&limit=5", { token: ownerToken });
    productId = search.body?.data?.[0]?.id;
    if (!productId) {
      fail("4. Search products", "seed Napa not found");
    }
  }

  // 3. Create cashier
  const cashierEmail = `cashier-smoke-${Date.now()}@example.com`;
  const staff = await req("/users", {
    method: "POST",
    token: ownerToken,
    body: {
      email: cashierEmail,
      password: "ChangeMe123!",
      name: "Smoke Cashier",
      role: "CASHIER",
      storeId,
    },
  });
  if (staff.status === 201 && staff.body?.data?.role === "CASHIER") {
    pass("3. Create cashier via POST /users");
  } else {
    fail("3. Create cashier via POST /users", JSON.stringify(staff.body));
  }

  // 4. Search products
  const search = await req("/products?q=Napa&limit=10", { token: ownerToken });
  if (
    search.status === 200 &&
    search.body?.status === "success" &&
    Array.isArray(search.body.data) &&
    search.body.data.length >= 1
  ) {
    productId = productId || search.body.data[0].id;
    pass("4. Search products", `count=${search.body.data.length}`);
  } else if (!productId) {
    fail("4. Search products", JSON.stringify(search.body));
  } else {
    pass("4. Search products", "using created product");
  }

  // 5. FEFO
  const fefo = await req(`/products/${productId}/fefo-batch`, {
    token: ownerToken,
  });
  if (
    fefo.status === 200 &&
    fefo.body?.data?.quantityOnHand > 0 &&
    fefo.body?.data?.expiryDate
  ) {
    pass(
      "5. FEFO batch",
      `qty=${fefo.body.data.quantityOnHand} exp=${String(fefo.body.data.expiryDate).slice(0, 10)}`,
    );
  } else {
    fail("5. FEFO batch", JSON.stringify(fefo.body));
  }

  const qtyBefore = fefo.body?.data?.quantityOnHand;
  const fefoBatchId = fefo.body?.data?.id;

  // 6. Ingest sale (omit batchId → FEFO)
  const eventId = `m2-smoke-${Date.now()}`;
  const ingestBody = {
    eventId,
    storeId,
    subtotal: 2.4,
    discount: 0,
    total: 2.4,
    items: [
      {
        productId,
        unitType: "PIECE",
        unitQty: 2,
        quantityBase: 2,
        unitPrice: 1.2,
        lineTotal: 2.4,
      },
    ],
    payments: [{ method: "CASH", amount: 2.4 }],
  };

  const ingest = await req("/sales/ingest", {
    method: "POST",
    token: ownerToken,
    body: ingestBody,
  });
  if (
    ingest.status === 201 &&
    ingest.body?.meta?.idempotent === false &&
    ingest.body?.data?.items?.[0]?.batchId
  ) {
    pass("6. Sale ingest (FEFO fill)", `sale=${ingest.body.data.id}`);
  } else {
    fail("6. Sale ingest (FEFO fill)", JSON.stringify(ingest.body));
  }

  // 7. Re-ingest idempotent
  const again = await req("/sales/ingest", {
    method: "POST",
    token: ownerToken,
    body: ingestBody,
  });
  if (
    again.status === 200 &&
    again.body?.message === "Sale already ingested" &&
    again.body?.meta?.idempotent === true &&
    again.body?.data?.id === ingest.body?.data?.id
  ) {
    pass("7. Idempotent re-ingest");
  } else {
    fail("7. Idempotent re-ingest", JSON.stringify(again.body));
  }

  // Confirm stock not double-decremented
  if (fefoBatchId) {
    const batchAfter = await req(`/batches/${fefoBatchId}`, {
      token: ownerToken,
    });
    const qtyAfter = batchAfter.body?.data?.quantityOnHand;
    if (qtyBefore != null && qtyAfter === qtyBefore - 2) {
      pass("7b. Stock decremented once", `${qtyBefore} → ${qtyAfter}`);
    } else {
      fail("7b. Stock decremented once", `${qtyBefore} → ${qtyAfter}`);
    }
  }

  // 8. Cashier login + margin redaction + RBAC
  const cashLogin = await req("/auth/login", {
    method: "POST",
    body: {
      email: cashierEmail,
      password: "ChangeMe123!",
      tenantSlug,
    },
  });
  const cashierToken = cashLogin.body?.data?.accessToken;
  if (cashLogin.status === 200 && cashierToken) {
    pass("8a. Cashier login");
  } else {
    fail("8a. Cashier login", JSON.stringify(cashLogin.body));
    return finish();
  }

  const cashFefo = await req(`/products/${productId}/fefo-batch`, {
    token: cashierToken,
  });
  const cashBatch = cashFefo.body?.data;
  if (
    cashFefo.status === 200 &&
    cashBatch &&
    !hasCost(cashBatch) &&
    typeof cashBatch.sellPerBase === "number"
  ) {
    pass("8b. Cashier no costPerBase; sellPerBase present");
  } else {
    fail("8b. Cashier margin redaction", JSON.stringify(cashBatch));
  }

  const priceBlock = await req(`/batches/${fefoBatchId}`, {
    method: "PATCH",
    token: cashierToken,
    body: { costPerBase: 0.01 },
  });
  if (priceBlock.status === 403) {
    pass("8c. Cashier blocked from price edit");
  } else {
    fail("8c. Cashier blocked from price edit", JSON.stringify(priceBlock.body));
  }

  const userBlock = await req("/users", {
    method: "POST",
    token: cashierToken,
    body: {
      email: `blocked-${Date.now()}@example.com`,
      password: "ChangeMe123!",
      role: "CASHIER",
    },
  });
  if (userBlock.status === 403) {
    pass("8d. Cashier blocked from creating users");
  } else {
    fail("8d. Cashier blocked from creating users", JSON.stringify(userBlock.body));
  }

  // Cashier cannot PATCH customers or use signed stock adjustments.
  let customerId = null;
  let customerName = null;
  const custSearch = await req("/customers?limit=5", { token: ownerToken });
  if (
    custSearch.status === 200 &&
    Array.isArray(custSearch.body?.data) &&
    custSearch.body.data[0]?.id
  ) {
    customerId = custSearch.body.data[0].id;
    customerName = custSearch.body.data[0].name;
  } else {
    const createdCust = await req("/customers", {
      method: "POST",
      token: ownerToken,
      body: { name: "M5 Smoke Customer", phone: `015${Date.now().toString().slice(-8)}` },
    });
    customerId = createdCust.body?.data?.id;
    customerName = createdCust.body?.data?.name;
  }

  const cashCustPatch = await req(`/customers/${customerId}`, {
    method: "PATCH",
    token: cashierToken,
    body: { name: "Cashier Must Not Edit" },
  });
  if (cashCustPatch.status === 403) {
    pass("8e. Cashier blocked from PATCH customer");
  } else {
    fail(
      "8e. Cashier blocked from PATCH customer",
      JSON.stringify(cashCustPatch.body),
    );
  }

  const cashQtyPatch = await req(`/batches/${fefoBatchId}/adjustments`, {
    method: "POST",
    token: cashierToken,
    body: {
      eventId: `m2-cashier-adjust-${Date.now()}`,
      expectedVersion: cashBatch.version,
      quantityChange: 1,
      reasonCode: "OTHER",
    },
  });
  if (cashQtyPatch.status === 403) {
    pass("8f. Cashier blocked from signed stock adjustment");
  } else {
    fail(
      "8f. Cashier blocked from signed stock adjustment",
      JSON.stringify(cashQtyPatch.body),
    );
  }

  const ownerCustPatch = await req(`/customers/${customerId}`, {
    method: "PATCH",
    token: ownerToken,
    body: { name: customerName || "M5 Smoke Customer" },
  });
  if (
    ownerCustPatch.status === 200 &&
    ownerCustPatch.body?.data?.id === customerId
  ) {
    pass("8g. Owner PATCH customer");
  } else {
    fail("8g. Owner PATCH customer", JSON.stringify(ownerCustPatch.body));
  }

  // Explicit batchId ingest path (owner)
  const event2 = `m2-smoke-explicit-${Date.now()}`;
  const explicit = await req("/sales/ingest", {
    method: "POST",
    token: ownerToken,
    body: {
      eventId: event2,
      storeId,
      subtotal: 1.2,
      discount: 0,
      total: 1.2,
      items: [
        {
          productId,
          batchId: fefoBatchId,
          unitType: "PIECE",
          unitQty: 1,
          quantityBase: 1,
          unitPrice: 1.2,
          lineTotal: 1.2,
        },
      ],
      payments: [{ method: "CARD", amount: 1.2 }],
    },
  });
  if (explicit.status === 201) {
    pass("6b. Sale ingest with explicit batchId");
  } else {
    fail("6b. Sale ingest with explicit batchId", JSON.stringify(explicit.body));
  }

  finish();
}

function finish() {
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
