/**
 * Milestone 4 Batch B smoke — POST /api/v1/sync/ingest.
 *
 * Usage (server must already be running, e.g. npm run dev -w @r2a/server):
 *   npm run smoke:m4b -w @r2a/server
 *   $env:BASE_URL="http://127.0.0.1:8787"; npm run smoke:m4b -w @r2a/server
 *
 * Prefers seeded demo-pharmacy. Does NOT reset the database.
 * Does not call desktop / worker / App.tsx.
 */

const BASE = (process.env.BASE_URL || "http://localhost:8787").replace(/\/$/, "");
const API = `${BASE}/api/v1`;

const SEED = {
  ownerEmail: process.env.SEED_OWNER_EMAIL || "owner@demo.local",
  cashierEmail: process.env.SEED_CASHIER_EMAIL || "cashier@demo.local",
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
  if (Array.isArray(obj)) return obj.some(hasCost);
  if (Object.prototype.hasOwnProperty.call(obj, "costPerBase")) return true;
  if (Object.prototype.hasOwnProperty.call(obj, "margin")) return true;
  if (Object.prototype.hasOwnProperty.call(obj, "profit")) return true;
  return Object.values(obj).some(hasCost);
}

function saleEvent(eventId, storeId, productId, { qty = 1, unitPrice = 1.2, subtotal, total } = {}) {
  const lineTotal = qty * unitPrice;
  const sub = subtotal ?? lineTotal;
  const tot = total ?? sub;
  return {
    event_id: eventId,
    entity_type: "sale",
    action: "create",
    payload: {
      eventId,
      storeId,
      subtotal: sub,
      discount: 0,
      total: tot,
      items: [
        {
          productId,
          unitType: "PIECE",
          unitQty: qty,
          quantityBase: qty,
          unitPrice,
          lineTotal,
        },
      ],
      payments: [{ method: "CASH", amount: tot }],
    },
  };
}

async function main() {
  console.log(`M4B smoke → ${API}\n`);

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
    return finish();
  }

  // 2. Login owner + cashier
  const ownerLogin = await req("/auth/login", {
    method: "POST",
    body: {
      email: SEED.ownerEmail,
      password: SEED.password,
      tenantSlug: SEED.tenantSlug,
    },
  });
  const ownerToken = ownerLogin.body?.data?.accessToken;
  const storeId = ownerLogin.body?.data?.user?.storeId;
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
  const cashierToken = cashierLogin.body?.data?.accessToken;
  if (cashierLogin.status === 200 && cashierToken) {
    pass("2b. Cashier login", SEED.cashierEmail);
  } else {
    fail("2b. Cashier login", JSON.stringify(cashierLogin.body));
    return finish();
  }

  const search = await req("/products?q=Napa&limit=5", { token: ownerToken });
  const productId = search.body?.data?.[0]?.id;
  if (!productId) {
    fail("2c. Seed Napa product", JSON.stringify(search.body));
    return finish();
  }

  const fefo = await req(`/products/${productId}/fefo-batch`, { token: ownerToken });
  const fefoBatchId = fefo.body?.data?.id;
  const qtyBefore = fefo.body?.data?.quantityOnHand;
  if (!fefoBatchId || typeof qtyBefore !== "number") {
    fail("2d. FEFO batch", JSON.stringify(fefo.body));
    return finish();
  }

  // 3. Owner POST one valid sale event → accepted; stock down
  const eventId = `m4b-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const accepted = await req("/sync/ingest", {
    method: "POST",
    token: ownerToken,
    body: { events: [saleEvent(eventId, storeId, productId, { qty: 1 })] },
  });
  const acceptedRow = accepted.body?.data?.results?.[0];
  if (
    accepted.status === 200 &&
    accepted.body?.status === "success" &&
    acceptedRow?.status === "accepted" &&
    acceptedRow?.eventId === eventId
  ) {
    pass("3a. Owner ingest accepted", `eventId=${eventId}`);
  } else {
    fail("3a. Owner ingest accepted", JSON.stringify(accepted.body));
  }

  const batchAfterAccept = await req(`/batches/${fefoBatchId}`, { token: ownerToken });
  const qtyAfterAccept = batchAfterAccept.body?.data?.quantityOnHand;
  if (qtyAfterAccept === qtyBefore - 1) {
    pass("3b. Stock decremented once", `${qtyBefore} → ${qtyAfterAccept}`);
  } else {
    fail("3b. Stock decremented once", `${qtyBefore} → ${qtyAfterAccept}`);
  }

  // 4. Repeat same event_id → duplicate; stock unchanged
  const dup = await req("/sync/ingest", {
    method: "POST",
    token: ownerToken,
    body: { events: [saleEvent(eventId, storeId, productId, { qty: 1 })] },
  });
  const dupRow = dup.body?.data?.results?.[0];
  if (dup.status === 200 && dupRow?.status === "duplicate" && dupRow?.eventId === eventId) {
    pass("4a. Duplicate event_id");
  } else {
    fail("4a. Duplicate event_id", JSON.stringify(dup.body));
  }

  const batchAfterDup = await req(`/batches/${fefoBatchId}`, { token: ownerToken });
  const qtyAfterDup = batchAfterDup.body?.data?.quantityOnHand;
  if (qtyAfterDup === qtyAfterAccept) {
    pass("4b. Stock unchanged on duplicate", `${qtyAfterDup}`);
  } else {
    fail("4b. Stock unchanged on duplicate", `${qtyAfterAccept} → ${qtyAfterDup}`);
  }

  // 5. Unknown entity_type → rejected (envelope allows stock_delta; server rejects per event)
  const unknown = await req("/sync/ingest", {
    method: "POST",
    token: ownerToken,
    body: {
      events: [
        {
          event_id: `m4b-unsupported-${Date.now()}`,
          entity_type: "stock_delta",
          action: "create",
          payload: { quantityChange: -1 },
        },
      ],
    },
  });
  const unknownRow = unknown.body?.data?.results?.[0];
  if (
    unknown.status === 200 &&
    unknownRow?.status === "rejected" &&
    typeof unknownRow?.message === "string" &&
    /unsupported entity_type\/action/i.test(unknownRow.message)
  ) {
    pass("5. Unsupported entity_type rejected");
  } else {
    fail("5. Unsupported entity_type rejected", JSON.stringify(unknown.body));
  }

  // 6. Poison payload (bad totals) → rejected; later valid event in same batch still accepted
  const poisonId = `m4b-poison-${Date.now()}`;
  const laterId = `m4b-later-${Date.now()}`;
  const mixed = await req("/sync/ingest", {
    method: "POST",
    token: ownerToken,
    body: {
      events: [
        saleEvent(poisonId, storeId, productId, {
          qty: 1,
          unitPrice: 1.2,
          subtotal: 99,
          total: 99,
        }),
        saleEvent(laterId, storeId, productId, { qty: 1 }),
      ],
    },
  });
  const poisonRow = mixed.body?.data?.results?.[0];
  const laterRow = mixed.body?.data?.results?.[1];
  if (
    mixed.status === 200 &&
    poisonRow?.status === "rejected" &&
    poisonRow?.eventId === poisonId &&
    laterRow?.status === "accepted" &&
    laterRow?.eventId === laterId
  ) {
    pass("6. Poison rejected; later event accepted", poisonRow.message || "");
  } else {
    fail("6. Poison + later accepted", JSON.stringify(mixed.body));
  }

  const batchAfterMixed = await req(`/batches/${fefoBatchId}`, { token: ownerToken });
  const qtyAfterMixed = batchAfterMixed.body?.data?.quantityOnHand;
  if (qtyAfterMixed === qtyAfterDup - 1) {
    pass("6b. Poison did not decrement; later did", `${qtyAfterDup} → ${qtyAfterMixed}`);
  } else {
    fail("6b. Mixed-batch stock", `${qtyAfterDup} → ${qtyAfterMixed}`);
  }

  // 7. Cashier token: ingest works; response items/batches omit costPerBase
  const cashierEventId = `m4b-cashier-${Date.now()}`;
  const cashierIngest = await req("/sync/ingest", {
    method: "POST",
    token: cashierToken,
    body: { events: [saleEvent(cashierEventId, storeId, productId, { qty: 1 })] },
  });
  const cashierRow = cashierIngest.body?.data?.results?.[0];
  const cashierSale = cashierRow?.sale;
  const cashierItems = cashierSale?.items;
  if (
    cashierIngest.status === 200 &&
    cashierRow?.status === "accepted" &&
    Array.isArray(cashierItems) &&
    cashierItems.length >= 1 &&
    cashierItems[0]?.batch &&
    !hasCost(cashierIngest.body)
  ) {
    pass("7. Cashier ingest; no costPerBase on nested batches");
  } else {
    fail("7. Cashier ingest / margin omit", JSON.stringify(cashierIngest.body));
  }

  // 8. No token → 401
  const unauth = await req("/sync/ingest", {
    method: "POST",
    body: { events: [saleEvent(`m4b-unauth-${Date.now()}`, storeId, productId)] },
  });
  if (unauth.status === 401) {
    pass("8. No token → 401");
  } else {
    fail("8. No token → 401", JSON.stringify(unauth));
  }

  // Extra: invalid batch wrapper (empty events) → 400, not 200
  const empty = await req("/sync/ingest", {
    method: "POST",
    token: ownerToken,
    body: { events: [] },
  });
  if (empty.status === 400) {
    pass("8b. Empty events → 400");
  } else {
    fail("8b. Empty events → 400", JSON.stringify(empty));
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
