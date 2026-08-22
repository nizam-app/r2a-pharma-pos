/**
 * Milestone 6 Batch BI smoke — Audit + FEFO APIs and ingest hook.
 *
 * Usage (server must already be running):
 *   npm run smoke:m6bi -w @r2a/server
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { prisma } from "@r2a/database";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
dotenv.config({ path: path.join(repoRoot, ".env") });

const BASE = (process.env.BASE_URL || "http://localhost:8787").replace(/\/$/, "");
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
    body: { email, password: SEED.password, tenantSlug: SEED.tenantSlug },
  });
  const data = asRecord(response.body.data);
  const user = asRecord(data?.user);
  return {
    status: response.status,
    body: response.body,
    token: typeof data?.accessToken === "string" ? data.accessToken : null,
    userId: typeof user?.id === "string" ? user.id : null,
    storeId: typeof user?.storeId === "string" ? user.storeId : null,
  };
}

async function main(): Promise<void> {
  console.log(`M6BI smoke → ${API}\n`);

  const health = await req("/health");
  if (health.status === 200 && asRecord(health.body.data)?.ok === true) {
    pass("1. Health envelope");
  } else {
    fail("1. Health envelope", JSON.stringify(health.body));
    return finish();
  }

  const [owner, manager, cashier] = await Promise.all([
    login(SEED.ownerEmail),
    login(SEED.managerEmail),
    login(SEED.cashierEmail),
  ]);
  if (owner.status === 200 && owner.token && owner.storeId) pass("2a. Owner login");
  else {
    fail("2a. Owner login", JSON.stringify(owner.body));
    return finish();
  }
  if (manager.status === 200 && manager.token) pass("2b. Manager login");
  else {
    fail("2b. Manager login", JSON.stringify(manager.body));
    return finish();
  }
  if (cashier.status === 200 && cashier.token) pass("2c. Cashier login");
  else {
    fail("2c. Cashier login", JSON.stringify(cashier.body));
    return finish();
  }

  const cashierOwnerAudit = await req("/owner/audits", { token: cashier.token });
  if (cashierOwnerAudit.status === 403) pass("3. Cashier blocked from owner audit routes");
  else fail("3. Cashier blocked from owner audit routes", `status=${cashierOwnerAudit.status}`);

  const cashierStart = await req("/audits/start", {
    method: "POST",
    token: cashier.token,
    body: { locationLabel: "Smoke Shelf" },
  });
  if (cashierStart.status === 403) pass("4. Cashier blocked from stock audit start");
  else fail("4. Cashier blocked from stock audit start", `status=${cashierStart.status}`);

  const start = await req("/audits/start", {
    method: "POST",
    token: manager.token,
    body: { locationLabel: `Smoke Shelf ${Date.now()}`, notes: "M6BI smoke" },
  });
  const audit = asRecord(start.body.data);
  const auditId = typeof audit?.id === "string" ? audit.id : null;
  if (start.status === 201 && auditId) pass("5. Manager starts audit", auditId);
  else {
    fail("5. Manager starts audit", JSON.stringify(start.body));
    return finish();
  }

  const products = await req("/products?q=Napa&limit=1", { token: manager.token });
  const product = Array.isArray(products.body.data) ? asRecord(products.body.data[0]) : null;
  const productId = typeof product?.id === "string" ? product.id : null;
  if (!productId) {
    fail("6. Seed product available", JSON.stringify(products.body));
    return finish();
  }
  pass("6. Seed product available", String(product.name));

  const batches = await req(`/batches?productId=${productId}&limit=20`, { token: manager.token });
  const batchRows = Array.isArray(batches.body.data)
    ? batches.body.data.map(asRecord).filter(Boolean) as Record<string, unknown>[]
    : [];
  const stockBatches = batchRows
    .filter((row) => Number(row.quantityOnHand) > 1)
    .sort((a, b) => String(a.expiryDate).localeCompare(String(b.expiryDate)));
  const countedBatch = stockBatches[0];
  const overrideBatch = stockBatches[1];
  if (!countedBatch || !overrideBatch) {
    fail("7. Two in-stock batches available for audit/FEFO smoke", JSON.stringify(batchRows));
    return finish();
  }
  pass("7. Two in-stock batches available for audit/FEFO smoke");

  const countedQty = Number(countedBatch.quantityOnHand) - 1;
  const lines = await req(`/audits/${auditId}/lines`, {
    method: "POST",
    token: manager.token,
    body: { lines: [{ batchId: countedBatch.id, countedQty }] },
  });
  if (lines.status === 200 && asRecord(lines.body.data)?.id === auditId) pass("8. Manager saves audit lines");
  else fail("8. Manager saves audit lines", JSON.stringify(lines.body));

  const submit = await req(`/audits/${auditId}/submit`, {
    method: "POST",
    token: manager.token,
    body: { notes: "Submit smoke variance" },
  });
  const submitted = asRecord(submit.body.data);
  if (submit.status === 200 && submitted?.status === "VARIANCE_FOUND") pass("9. Manager submits variance audit");
  else fail("9. Manager submits variance audit", JSON.stringify(submit.body));

  const dashboard = await req("/owner/audit/dashboard", { token: owner.token });
  if (dashboard.status === 200 && asRecord(dashboard.body.data)?.kpis) pass("10. Owner audit dashboard returns KPIs");
  else fail("10. Owner audit dashboard returns KPIs", JSON.stringify(dashboard.body));

  const list = await req("/owner/audits?limit=5", { token: owner.token });
  if (list.status === 200 && Array.isArray(list.body.data)) pass("11. Owner audit list returns rows");
  else fail("11. Owner audit list returns rows", JSON.stringify(list.body));

  const detail = await req(`/owner/audits/${auditId}`, { token: owner.token });
  if (detail.status === 200 && asRecord(detail.body.data)?.id === auditId) pass("12. Owner audit detail returns lines/activity");
  else fail("12. Owner audit detail returns lines/activity", JSON.stringify(detail.body));

  const review = await req(`/owner/audits/${auditId}/review`, {
    method: "POST",
    token: owner.token,
    body: { decision: "KEEP_VARIANCE", notes: "Reviewed by smoke" },
  });
  if (review.status === 200 && asRecord(review.body.data)?.reviewedByUserId) pass("13. Owner reviews audit");
  else fail("13. Owner reviews audit", JSON.stringify(review.body));

  const eventId = `m6bi-fefo-${Date.now()}`;
  const sale = await req("/sales/ingest", {
    method: "POST",
    token: cashier.token,
    body: {
      eventId,
      storeId: owner.storeId,
      subtotal: 1.2,
      discount: 0,
      total: 1.2,
      items: [
        {
          productId,
          batchId: overrideBatch.id,
          unitType: "PIECE",
          unitQty: 1,
          quantityBase: 1,
          unitPrice: 1.2,
          lineTotal: 1.2,
          fefoOverride: true,
          fefoAuthorizedByName: "Smoke Manager",
        },
      ],
      payments: [{ method: "CASH", amount: 1.2 }],
    },
  });
  const saleData = asRecord(sale.body.data);
  if ((sale.status === 201 || sale.status === 200) && saleData?.id) pass("14. FEFO override sale ingested");
  else {
    fail("14. FEFO override sale ingested", JSON.stringify(sale.body));
    return finish();
  }

  const violation = await prisma.fefoViolationRecord.findFirst({
    where: { tenantId: String(saleData.tenantId), saleId: String(saleData.id), status: "OPEN" },
    orderBy: { createdAt: "desc" },
  });
  if (violation) pass("15. Ingest hook created OPEN FEFO violation", violation.id);
  else {
    fail("15. Ingest hook created OPEN FEFO violation");
    return finish();
  }

  const correct = await req(`/owner/fefo-violations/${violation.id}/correct`, {
    method: "POST",
    token: owner.token,
    body: { correctionNote: "Smoke correction applied" },
  });
  if (correct.status === 200 && asRecord(correct.body.data)?.status === "CORRECTED") {
    pass("16. Owner corrects FEFO violation");
  } else {
    fail("16. Owner corrects FEFO violation", JSON.stringify(correct.body));
  }

  finish();
}

function finish(): void {
  const failed = results.filter((result) => !result.ok);
  console.log(`\nM6BI smoke summary: ${results.length - failed.length}/${results.length} passed`);
  void prisma.$disconnect();
  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  void prisma.$disconnect();
  process.exit(1);
});
