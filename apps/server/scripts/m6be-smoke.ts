/**
 * Milestone 6 Batch BE smoke — Owner Sales Report API + Zod.
 *
 * Usage (server must already be running):
 *   npm run smoke:m6be -w @r2a/server
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { ownerSalesReportResponseSchema } from "@r2a/shared-types";

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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

async function req(
  pathname: string,
  opts: { method?: string; body?: unknown; token?: string } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const response = await fetch(`${API}${pathname}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: response.status, body: body as Record<string, unknown> };
}

async function login(email: string) {
  const response = await req("/auth/login", {
    method: "POST",
    body: {
      email,
      password: SEED.password,
      tenantSlug: SEED.tenantSlug,
    },
  });
  const data = asRecord(response.body.data);
  const user = asRecord(data?.user);
  return {
    status: response.status,
    body: response.body,
    token: typeof data?.accessToken === "string" ? data.accessToken : null,
    storeId: typeof user?.storeId === "string" ? user.storeId : null,
  };
}

async function main(): Promise<void> {
  console.log(`M6BE smoke → ${API}\n`);

  const reportsPage = fs.readFileSync(
    path.join(
      repoRoot,
      "apps/web/src/features/reports/ReportsDashboardPage.tsx",
    ),
    "utf8",
  );
  if (reportsPage.includes("/reports/sales")) {
    pass("1. Reports dashboard Sales View Report wired after BF");
  } else {
    fail("1. Reports dashboard Sales View Report wired after BF");
  }

  const health = await req("/health");
  if (health.status === 200 && asRecord(health.body.data)?.ok === true) {
    pass("2. Health envelope");
  } else {
    fail("2. Health envelope", JSON.stringify(health.body));
    return finish();
  }

  const unauth = await req("/owner/reports/sales");
  if (unauth.status === 401) {
    pass("3. Unauthenticated report is 401");
  } else {
    fail("3. Unauthenticated report is 401", `status=${unauth.status}`);
  }

  const [owner, manager, cashier] = await Promise.all([
    login(SEED.ownerEmail),
    login(SEED.managerEmail),
    login(SEED.cashierEmail),
  ]);
  if (owner.status === 200 && owner.token && owner.storeId) {
    pass("4a. Owner login", SEED.ownerEmail);
  } else {
    fail("4a. Owner login", JSON.stringify(owner.body));
    return finish();
  }
  if (manager.status === 200 && manager.token) {
    pass("4b. Manager login", SEED.managerEmail);
  } else {
    fail("4b. Manager login", JSON.stringify(manager.body));
    return finish();
  }
  if (cashier.status === 200 && cashier.token) {
    pass("4c. Cashier login", SEED.cashierEmail);
  } else {
    fail("4c. Cashier login", JSON.stringify(cashier.body));
    return finish();
  }

  const [managerReport, cashierReport] = await Promise.all([
    req("/owner/reports/sales", { token: manager.token }),
    req("/owner/reports/sales", { token: cashier.token }),
  ]);
  if (managerReport.status === 403 && cashierReport.status === 403) {
    pass("5. Manager/Cashier report access is 403");
  } else {
    fail(
      "5. Manager/Cashier report access is 403",
      JSON.stringify({ manager: managerReport.status, cashier: cashierReport.status }),
    );
  }

  const ownerReport = await req("/owner/reports/sales", { token: owner.token });
  const parsed = ownerSalesReportResponseSchema.safeParse(ownerReport.body.data);
  if (ownerReport.status === 200 && parsed.success) {
    pass(
      "6. Owner report response matches Zod",
      `${parsed.data.dailyBars.length} daily bars`,
    );
  } else {
    fail(
      "6. Owner report response matches Zod",
      parsed.success ? JSON.stringify(ownerReport.body) : parsed.error.message,
    );
    return finish();
  }

  const data = parsed.data;
  const paymentTotal = data.paymentSummary.CASH + data.paymentSummary.CARD + data.paymentSummary.MFS;
  if (Math.abs(paymentTotal - data.paymentSummary.total) < 0.01) {
    pass("7. Payment summary totals CASH/CARD/MFS only");
  } else {
    fail("7. Payment summary totals CASH/CARD/MFS only", JSON.stringify(data.paymentSummary));
  }

  const storeReport = await req(`/owner/reports/sales?storeId=${owner.storeId}`, {
    token: owner.token,
  });
  const storeData = asRecord(storeReport.body.data);
  const storeRange = asRecord(storeData?.range);
  if (storeReport.status === 200 && storeRange?.storeId === owner.storeId) {
    pass("8. Optional storeId filter is tenant-scoped");
  } else {
    fail("8. Optional storeId filter is tenant-scoped", JSON.stringify(storeReport.body));
  }

  const badRange = await req("/owner/reports/sales?from=2026-02-01&to=2026-01-01", {
    token: owner.token,
  });
  if (badRange.status === 400) {
    pass("9. Invalid date range is 400");
  } else {
    fail("9. Invalid date range is 400", `status=${badRange.status}`);
  }

  finish();
}

function finish(): void {
  const failed = results.filter((result) => !result.ok);
  console.log(`\nM6BE smoke summary: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
