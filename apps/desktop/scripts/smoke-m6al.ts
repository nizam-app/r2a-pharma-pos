/**
 * smoke-m6al.ts
 * Milestone 6 Batch AL (POS Create Customer) smoke test.
 * Run: npm run smoke:m6al -w @r2a/desktop
 *
 * Verifies static keyboard navigation guards and live customer registration API flows.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE =
  process.env.BASE_URL?.replace(/\/$/, "") ||
  process.env.VITE_API_BASE_URL?.replace(/\/$/, "") ||
  "http://127.0.0.1:8787";

const OWNER_EMAIL = "owner@demo.local";
const CASHIER_EMAIL = "cashier@demo.local";
const SEED_PASSWORD = "ChangeMe123!";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "..", "src");

function readSrc(rel: string): string {
  return readFileSync(join(SRC, rel), "utf8");
}

type Envelope<T> = {
  status: string;
  message: string;
  data?: T;
};

type AuthData = {
  accessToken: string;
  user?: { email?: string; role?: string };
};

type CustomerData = {
  id: string;
  name: string;
  phone: string;
  status: string;
  source: string;
};

type PhoneCheckResult = {
  exists: boolean;
  customer: any;
};

async function api<T>(
  path: string,
  opts: { method?: string; body?: unknown; token?: string } = {},
): Promise<{ data: T; status: number }> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const json = (await res.json()) as Envelope<T>;
  return { data: json.data as T, status: res.status };
}

async function login(email: string): Promise<string> {
  const { data } = await api<AuthData>("/api/v1/auth/login", {
    method: "POST",
    body: { email, password: SEED_PASSWORD },
  });
  assert(data.accessToken, `Failed to login as ${email}`);
  return data.accessToken;
}

function checkStaticGuards(): void {
  const selectCustomer = readSrc("features/pos/SelectCustomerModal.tsx");

  assert(
    selectCustomer.includes('event.key === "Tab"') && selectCustomer.includes("event.preventDefault()"),
    "SelectCustomerModal must block Tab navigation default behavior",
  );

  assert(
    selectCustomer.includes('event.key === "F3"') && selectCustomer.includes("handleOpenCreate()"),
    "SelectCustomerModal must support F3 hotkey to open Create form",
  );

  assert(
    selectCustomer.includes('mode === "create"') && selectCustomer.includes('mode === "search"'),
    "SelectCustomerModal must toggle between search and create modes",
  );

  assert(
    selectCustomer.includes('ArrowDown') && selectCustomer.includes('ArrowUp') && selectCustomer.includes('ArrowLeft') && selectCustomer.includes('ArrowRight'),
    "SelectCustomerModal must support full arrow navigation",
  );

  assert(
    selectCustomer.includes("/api/v1/customers/phone-check"),
    "SelectCustomerModal must check phone availability",
  );

  console.log("  ✓ static: keyboard nav, tab blocking, F3 hotkey, mode toggle verified");
}

async function checkLiveFlows(): Promise<void> {
  // Test if server is up
  try {
    const health = await api<any>("/health");
    if (health.status !== 200) {
      console.log("  ⚠ Cloud API not reachable. Skipping live tests.");
      return;
    }
  } catch {
    console.log("  ⚠ Cloud API offline. Skipping live tests.");
    return;
  }

  console.log("  → Cloud API is reachable. Running live integration tests...");

  const cashierToken = await login(CASHIER_EMAIL);
  const ownerToken = await login(OWNER_EMAIL);

  const phoneNum = `017${Math.floor(10000000 + Math.random() * 90000000)}`;

  // 1. Phone Check - should be available
  const checkRes = await api<PhoneCheckResult>(`/api/v1/customers/phone-check?phone=${phoneNum}`, {
    token: cashierToken,
  });
  assert(checkRes.status === 200, "Phone check API response must be 200");
  assert(checkRes.data.exists === false, "Phone must be available");

  // 2. Cashier create -> PENDING_APPROVAL
  const cashierCreate = await api<CustomerData>("/api/v1/customers", {
    method: "POST",
    body: { name: "Cashier Customer", phone: phoneNum, source: "POS_REGISTRATION" },
    token: cashierToken,
  });
  assert(cashierCreate.status === 201, `Cashier create status expected 201 got ${cashierCreate.status}`);
  assert(cashierCreate.data.status === "PENDING_APPROVAL", `Expected PENDING_APPROVAL got ${cashierCreate.data.status}`);
  assert(cashierCreate.data.source === "POS_REGISTRATION", "Expected POS_REGISTRATION source");

  // 3. Cashier check again -> duplicate
  const checkRes2 = await api<PhoneCheckResult>(`/api/v1/customers/phone-check?phone=${phoneNum}`, {
    token: cashierToken,
  });
  assert(checkRes2.data.exists === true, "Phone must now be duplicate/registered");

  // 4. Duplicate create -> 409
  const dupCreate = await api<any>("/api/v1/customers", {
    method: "POST",
    body: { name: "Duplicate Customer", phone: phoneNum, source: "POS_REGISTRATION" },
    token: cashierToken,
  });
  assert(dupCreate.status === 409, `Duplicate phone should return 409, got ${dupCreate.status}`);

  // 5. Owner create -> ACTIVE immediately
  const ownerPhone = `018${Math.floor(10000000 + Math.random() * 90000000)}`;
  const ownerCreate = await api<CustomerData>("/api/v1/customers", {
    method: "POST",
    body: { name: "Owner Customer", phone: ownerPhone, source: "POS_REGISTRATION" },
    token: ownerToken,
  });
  assert(ownerCreate.status === 201, `Owner create status expected 201 got ${ownerCreate.status}`);
  assert(ownerCreate.data.status === "ACTIVE", `Expected ACTIVE status got ${ownerCreate.data.status}`);

  console.log("  ✓ live: phone check, cashier pending creation, owner active creation, 409 duplicate checks verified");
}

async function main(): Promise<void> {
  console.log("smoke:m6al — POS Create Customer (Batch AL)\n");
  checkStaticGuards();
  await checkLiveFlows();
  console.log("\nPASS — smoke:m6al");
}

main().catch((err) => {
  console.error("\nFAIL — smoke:m6al");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
