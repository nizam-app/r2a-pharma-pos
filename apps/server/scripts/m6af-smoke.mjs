/**
 * Milestone 6 exit smoke — Batch AF (Role-aware customers + owner customer management).
 *
 * Usage (server must already be running, e.g. npm run dev -w @r2a/server):
 *   node apps/server/scripts/m6af-smoke.mjs
 *   set BASE_URL=http://localhost:8787 && node apps/server/scripts/m6af-smoke.mjs
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

function uniquePhone() {
  const ts = Date.now().toString();
  return `01${ts.slice(-9)}`;
}

async function main() {
  console.log(`M6AF smoke → ${API}\n`);

  // 1. Login as seeded owner (fallback register tenant)
  let ownerToken = null;
  let storeId = null;
  let tenantSlug = SEED.tenantSlug;

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
    pass("1. Seeded owner login", SEED.email);
  } else {
    const slug = `m6af-${Date.now()}`;
    tenantSlug = slug;
    const reg = await req("/auth/register", {
      method: "POST",
      body: {
        name: "M6AF Smoke Owner",
        email: `owner-${slug}@example.com`,
        password: "ChangeMe123!",
        tenantName: "M6AF Smoke Pharmacy",
        tenantSlug: slug,
        storeName: "Main",
      },
    });
    if (reg.status === 201 && reg.body?.data?.accessToken) {
      ownerToken = reg.body.data.accessToken;
      storeId = reg.body.data.user.storeId;
      pass("1. Owner auth (temp tenant)", slug);
    } else {
      fail("1. Owner auth", JSON.stringify(reg.body));
      return finish();
    }
  }

  // 2. POST /customers as Owner → 201, ACTIVE, OWNER_CREATED
  const ownerPhone = uniquePhone();
  const ownerCreate = await req("/customers", {
    method: "POST",
    token: ownerToken,
    body: {
      name: "Owner Created Customer",
      phone: ownerPhone,
      email: "owner-cust@example.com",
      address: "123 Owner St",
    },
  });
  if (
    ownerCreate.status === 201 &&
    ownerCreate.body?.data?.status === "ACTIVE" &&
    ownerCreate.body?.data?.source === "OWNER_CREATED"
  ) {
    pass("2. Owner POST /customers → ACTIVE + OWNER_CREATED", ownerPhone);
  } else {
    fail(
      "2. Owner POST /customers",
      `status=${ownerCreate.status} body=${JSON.stringify(ownerCreate.body)}`,
    );
  }

  // 3. Create a cashier for role tests
  const cashierEmail = `cashier-af-${Date.now()}@example.com`;
  const staff = await req("/users", {
    method: "POST",
    token: ownerToken,
    body: {
      email: cashierEmail,
      password: "ChangeMe123!",
      name: "AF Smoke Cashier",
      role: "CASHIER",
      storeId,
    },
  });
  const cashierId = staff.body?.data?.id;

  // 4. Login as casher
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
    pass("4. Cashier login");
  } else {
    fail("4. Cashier login", JSON.stringify(cashLogin.body));
  }

  // 5. POST /customers as Cashier → 201, PENDING_APPROVAL, POS_REGISTRATION
  const cashPhone = uniquePhone();
  const cashCreate = await req("/customers", {
    method: "POST",
    token: cashierToken,
    body: {
      name: "Cashier Registered Customer",
      phone: cashPhone,
      address: "Should Be Stripped",
      email: "cash@example.com",
    },
  });
  if (
    cashCreate.status === 201 &&
    cashCreate.body?.data?.status === "PENDING_APPROVAL" &&
    cashCreate.body?.data?.source === "POS_REGISTRATION" &&
    !cashCreate.body?.data?.address
  ) {
    pass("5. Cashier POST /customers → PENDING + POS_REGISTRATION, extras stripped");
  } else {
    fail(
      "5. Cashier POST /customers",
      `status=${cashCreate.status} data=${JSON.stringify(cashCreate.body?.data)}`,
    );
  }

  // 6. GET /customers as Cashier → Active only (excludes pending)
  const search = await req("/customers?q=Customer&limit=50", {
    token: cashierToken,
  });
  const hasOwnerCust = search.body?.data?.some(
    (c) => c.phone === ownerPhone,
  );
  const hasCashCust = search.body?.data?.some((c) => c.phone === cashPhone);
  if (
    search.status === 200 &&
    Array.isArray(search.body?.data) &&
    hasOwnerCust &&
    !hasCashCust
  ) {
    pass("6. GET /customers Active-only (owner-cust present, cashier-pending hidden)");
  } else {
    fail(
      "6. GET /customers Active-only",
      `status=${search.status} hasOwner=${hasOwnerCust} hasCash=${hasCashCust}`,
    );
  }

  // 7. GET /customers/phone-check
  const phoneCheck = await req(`/customers/phone-check?phone=${ownerPhone}`, {
    token: cashierToken,
  });
  if (
    phoneCheck.status === 200 &&
    phoneCheck.body?.data?.exists === true &&
    phoneCheck.body?.data?.customer?.status === "ACTIVE"
  ) {
    pass("7. GET /customers/phone-check finds active customer");
  } else {
    fail(
      "7. GET /customers/phone-check",
      `status=${phoneCheck.status} body=${JSON.stringify(phoneCheck.body)}`,
    );
  }

  // 8. GET /owner/customers as Cashier → 403
  const ownerListBlock = await req("/owner/customers", {
    token: cashierToken,
  });
  if (ownerListBlock.status === 403) {
    pass("8. Cashier blocked from GET /owner/customers");
  } else {
    fail(
      "8. Cashier blocked from GET /owner/customers",
      `status=${ownerListBlock.status}`,
    );
  }

  // 9. GET /owner/customers as Owner → 200 with KPIs + items + pending in list
  const ownerList = await req("/owner/customers?limit=50", {
    token: ownerToken,
  });
  if (
    ownerList.status === 200 &&
    ownerList.body?.data &&
    ownerList.body?.meta?.kpis &&
    Array.isArray(ownerList.body?.data) &&
    ownerList.body.data.some((c) => c.phone === cashPhone)
  ) {
    pass(
      "9. Owner GET /owner/customers — KPIs + list includes pending",
      `kpis=${JSON.stringify(ownerList.body.meta.kpis)}`,
    );
  } else {
    fail(
      "9. Owner GET /owner/customers",
      `status=${ownerList.status} body=${JSON.stringify(ownerList.body)}`,
    );
  }

  // 10. GET /owner/customers/:id as Owner → 200 with profile + audit + purchaseHistory + loyaltyActivity
  const pendingId = ownerList.body?.data?.find((c) => c.phone === cashPhone)?.id;
  const ownerDetail = await req(`/owner/customers/${pendingId}`, {
    token: ownerToken,
  });
  if (
    ownerDetail.status === 200 &&
    ownerDetail.body?.data?.profile &&
    ownerDetail.body?.data?.audit &&
    ownerDetail.body?.data?.purchaseHistory &&
    ownerDetail.body?.data?.loyaltyActivity
  ) {
    pass(
      "10. Owner GET /owner/customers/:id — profile + audit + purchaseHistory + loyaltyActivity",
    );
  } else {
    fail(
      "10. Owner GET /owner/customers/:id",
      `status=${ownerDetail.status} data=${JSON.stringify(ownerDetail.body?.data)}`,
    );
  }

  // 11. POST /owner/customers/:id/approve as Owner → 200, status ACTIVE
  const approve = await req(`/owner/customers/${pendingId}/approve`, {
    method: "POST",
    token: ownerToken,
    body: { name: "Approved Name", phone: cashPhone },
  });
  if (
    approve.status === 200 &&
    approve.body?.data?.status === "ACTIVE" &&
    approve.body?.data?.approvedAt
  ) {
    pass("11. Owner approve pending customer → ACTIVE");
  } else {
    fail(
      "11. Owner approve",
      `status=${approve.status} body=${JSON.stringify(approve.body)}`,
    );
  }

  // 12. Create a second pending customer (for reject test)
  const rejectPhone = uniquePhone();
  const rejectCreate = await req("/customers", {
    method: "POST",
    token: cashierToken,
    body: { name: "Reject Target", phone: rejectPhone },
  });
  let rejectId = null;
  if (rejectCreate.status === 201) {
    rejectId = rejectCreate.body?.data?.id;
  } else {
    fail("12. Create second pending customer for reject", JSON.stringify(rejectCreate.body));
  }

  // 13. POST /owner/customers/:id/reject as Owner → 200, status REJECTED
  const reject = await req(`/owner/customers/${rejectId}/reject`, {
    method: "POST",
    token: ownerToken,
    body: { rejectionNote: "Test rejection" },
  });
  if (
    reject.status === 200 &&
    reject.body?.data?.status === "REJECTED" &&
    reject.body?.data?.rejectedAt
  ) {
    pass("13. Owner reject customer → REJECTED");
  } else {
    fail(
      "13. Owner reject",
      `status=${reject.status} body=${JSON.stringify(reject.body)}`,
    );
  }

  // 14. Verify rejected customers are excluded from owner list (even with status=REJECTED)
  const hiddenList = await req(
    `/owner/customers?limit=100&status=REJECTED`,
    { token: ownerToken },
  );
  const stillVisible =
    hiddenList.body?.data?.some((c) => c.id === rejectId) ?? false;
  if (!stillVisible) {
    pass("14. Rejected customer hidden from owner directory");
  } else {
    fail("14. Rejected customer hidden", "still visible in list");
  }

  // 15. Approve a rejected customer → 404 (not pending)
  const reApprove = await req(`/owner/customers/${rejectId}/approve`, {
    method: "POST",
    token: ownerToken,
    body: {},
  });
  if (reApprove.status === 404) {
    pass("15. Approve non-pending customer → 404");
  } else {
    fail(
      "15. Approve non-pending customer → 404",
      `got status=${reApprove.status}`,
    );
  }

  // 16. PATCH /customers/:id still requires Owner/Manager (cashier 403)
  const cashPatchBlock = await req(`/customers/${pendingId}`, {
    method: "PATCH",
    token: cashierToken,
    body: { name: "Cashier Edit Attempt" },
  });
  if (cashPatchBlock.status === 403) {
    pass("16. Cashier blocked from PATCH /customers/:id");
  } else {
    fail(
      "16. Cashier blocked from PATCH",
      `got status=${cashPatchBlock.status}`,
    );
  }

  finish();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
